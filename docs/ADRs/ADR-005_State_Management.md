# ADR-005: State Management

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

Tauri's IPC bridge is fundamentally different from Dexie's `useLiveQuery()`, which V1 relied on for automatic reactivity. In V1, writing to IndexedDB automatically re-rendered every subscribed component. In V2, writing to SQLite via `invoke()` notifies nobody. When a daily log entry is saved, the analytics dashboard has no idea its data is stale unless something tells it to refetch.

This means state management in LTU must solve four distinct problems:

**Problem 1 — Async query state.** Every database read is an async IPC call. Every component that fetches data needs loading, error, and data states. Without structure, this is reimplemented ad hoc in every component.

**Problem 2 — Cache invalidation.** After saving a daily log entry and its edit cascade, multiple query consumers are stale: score trends, streak history, habit completion rates, the daily log view itself. Something must know which queries to invalidate and trigger their refetch.

**Problem 3 — Write coordination.** The edit cascade (recompute + streak chain walk) is a multi-step database operation. A second write arriving while the cascade is running would produce a race condition on streak values.

**Problem 4 — UI state.** Selected date, sidebar open/close, active analytics tab — ephemeral state that lives in the component tree and never touches the database.

V1 addressed none of these explicitly. Analytics hooks were monolithic because cross-component invalidation required coupling. This is the pattern ADR-005 exists to prevent.

---

## Options Considered

### Option A: Raw Hooks — `useEffect` + `useState`

Each component manages its own async state manually. Cache invalidation requires prop-drilled callbacks or a custom event bus.

**Problem:** Reinvents loading/error state everywhere. Cross-component invalidation (save daily log → dashboard refetches) has no clean solution without a global event bus, which is exactly what a state management library is. This is V1's pattern — it produced monolithic analytics hooks because the only way to share invalidation logic was to put everything in one hook.

### Option B: Zustand Only

Global store holds query results and async state. Components subscribe to slices.

**Problem:** Zustand is a client-state library. It has no native concept of query lifecycle (loading/stale/error), no built-in cache invalidation by key, and no deduplication of concurrent requests. Building async query management on top of Zustand produces a custom implementation of TanStack Query, but worse.

### Option C: TanStack Query Only

Treats the Tauri IPC bridge as a "server." Every query has a cache key and a fetch function. Mutations invalidate keys on success. Loading and error states are built in.

**Problem:** TanStack Query has no clean solution for pure UI state (selected date, sidebar open/close). Forcing ephemeral UI state into a query key is awkward. Using it for client-only state it wasn't designed for produces unnecessary complexity.

### Option D: TanStack Query + Zustand ← **Selected**

TanStack Query owns all server state (IPC queries and mutations). Zustand owns pure UI state (no persistence, no IPC). Each library does what it was designed for.

---

## Decision

**Option D: TanStack Query for server state, Zustand for UI state.**

The split is clean and follows the canonical React architecture for apps with a data layer: TanStack Query manages the async data lifecycle; Zustand manages ephemeral UI state that doesn't need to survive a component unmount.

In practice, LTU's UI state is minimal — primarily the currently selected date (which drives most query keys) and modal/sidebar open states. If this stays small, Zustand stays small. It can be introduced incrementally; start with `useState` in components and migrate to Zustand only when state needs to be shared across the tree.

---

## Sub-Decisions

### SD1: Stale Time — `Infinity` with Explicit Mutation Invalidation

**Decision:** All TanStack Query queries use `staleTime: Infinity`. Queries refetch only when explicitly invalidated by a mutation's `onSuccess` handler. Automatic refetch on window focus is disabled globally.

**Rationale:** SQLite is local. There is no external process, no network, no background sync that can modify the database while the app is running. Data becomes stale only when *this app* writes it — which is always triggered by a user action that produces a mutation. Auto-refetch on window focus would cause unnecessary IPC calls with zero benefit.

**Global TanStack Query configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,    // Data in cache is valid until explicitly invalidated
      retry: 1,                 // Retry once on IPC failure, then surface error
    },
  },
})
```

**Exception:** `refetchOnMount: false` means if a component unmounts and remounts (e.g., navigating away and back), it uses cached data without refetching. This is correct — the cache is invalidated by mutations, not by navigation. If the data hasn't changed, the cached value is still valid.

### SD2: Write Coordination — Cascade Runs Entirely in Rust

**Decision:** The edit cascade (recompute edited day + streak chain walk) runs entirely inside a single Rust Tauri command, within one SQLite transaction. The TypeScript mutation calls `invoke('save_daily_log', { entry })` and awaits the fully completed result. The cascade is not orchestrated from TypeScript.

**Rationale:** The cascade involves sequential reads and writes across multiple `daily_log` rows with a convergence condition (walk until stored values match recomputed values). This must be atomic — a partial cascade that is interrupted produces inconsistent streak values across the history. SQLite transactions guarantee atomicity only when the entire operation runs within one transaction on the Rust side. If TypeScript orchestrated the cascade as a series of sequential `invoke()` calls, each call would be a separate transaction, and a failure mid-walk would leave the database in a partially updated state.

**Consequence for TypeScript layer:** The mutation's `onSuccess` handler fires only after the cascade is fully complete and the database is in a consistent state. It does not need to orchestrate any recomputation — it only needs to invalidate the right query keys.

**Race condition prevention:** TanStack Query mutations are sequential by default for the same mutation key. A second save triggered while the Rust cascade is running will queue behind it. No additional locking is required at the TypeScript layer.

**Tauri command contract:**
```
invoke('save_daily_log', { entry: DailyLogEntry }) → Promise<void>
  // Internally (Rust):
  // 1. Begin transaction
  // 2. Upsert daily_log row with new habit/vice values
  // 3. Recompute 5 scores for edited date
  // 4. Walk streak chain forward until convergence
  // 5. Commit transaction
  // 6. Return Ok(())
  // On any error: Rollback, return Err(message)
```

### SD3: Mutation Invalidation Pattern

**Decision:** Each mutation's `onSuccess` handler invalidates a defined set of query keys. Invalidation is explicit and scoped — not a blanket "invalidate everything."

**Query key hierarchy:**
```typescript
// Daily log
['daily-log', date]           // Single day entry
['daily-log', 'list']         // All entries (analytics)

// Scores and streaks
['score-trend']               // Daily final scores over time
['streak-history']            // Streak values over time
['weekly-review', weekStart]  // Specific week review

// Habit analytics
['habit-completion-rates']    // Per-habit completion %
['correlation-data']          // Raw rows for correlation engine

// Study, applications, relapses — isolated, invalidated only by their own mutations
['study-sessions', date]
['applications']
['relapse-entries', date]
```

**`save_daily_log` mutation invalidates:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['daily-log'] })
  queryClient.invalidateQueries({ queryKey: ['score-trend'] })
  queryClient.invalidateQueries({ queryKey: ['streak-history'] })
  queryClient.invalidateQueries({ queryKey: ['habit-completion-rates'] })
  queryClient.invalidateQueries({ queryKey: ['correlation-data'] })
}
```

**Other mutations invalidate only their own keys** — a new study session does not invalidate daily log queries.

**Rule:** When adding a new mutation, explicitly document which query keys it invalidates in a comment above the `onSuccess` handler. This is a code review checklist item — an undocumented invalidation set is a staleness bug waiting to happen.

### SD4: Zustand Store Scope — UI State Only

**Decision:** The Zustand store holds only ephemeral UI state. It never holds data fetched from the database, never duplicates TanStack Query cache values.

**Initial Zustand store contents:**
```typescript
interface UIStore {
  selectedDate: string         // Currently viewed date (YYYY-MM-DD), drives most query keys
  sidebarOpen: boolean         // Sidebar collapsed/expanded state
  activeAnalyticsSection: string | null  // Which analytics section is expanded
  
  setSelectedDate: (date: string) => void
  setSidebarOpen: (open: boolean) => void
  setActiveAnalyticsSection: (section: string | null) => void
}
```

**Rule:** If a piece of state comes from the database, it lives in TanStack Query. If it's purely about what the user is looking at right now and has no database representation, it lives in Zustand. If you're unsure, it's probably Zustand — the store should stay small.

### SD5: Error Handling

**Decision:** TanStack Query's built-in error state surfaces IPC failures. Mutations that fail (including cascade failures) display an inline error message and do not update the UI. No optimistic updates.

**Rationale for no optimistic updates:** LTU's writes are local SQLite operations. Sub-10ms round-trips make optimistic updates a complexity cost with no UX benefit — the user will not perceive the latency. The simpler model is: write → await confirmation → update UI. If the write fails, the UI stays as-is with an error message.

---

## Consequences

**What this enables:**
- Cross-component cache invalidation is handled by TanStack Query's key hierarchy — no prop drilling, no custom event bus
- Loading and error states are consistent across all data-fetching components — built into `useQuery`
- The edit cascade cannot produce a partially consistent database state — the Rust transaction guarantees atomicity
- Lazy loading per analytics section (ADR-003 SD1) composes naturally — each section's `useQuery` fires on mount with its own loading state
- `staleTime: Infinity` means zero unnecessary IPC calls during normal navigation

**What this constrains:**
- Every Tauri command that performs a write must complete its full operation (including cascade) before returning. Long-running cascades (edge case: editing a very old entry with years of streak history to walk) block the mutation until complete. In practice, the walk terminates quickly at the next streak-breaking day — this is not a real bottleneck.
- Query key design is a first-class concern. A poorly scoped key (too broad → unnecessary refetches; too narrow → staleness bugs) is the primary failure mode of this architecture. The key hierarchy in SD3 is the canonical reference — deviate from it deliberately, not accidentally.
- Zustand store must stay disciplined. The temptation to cache database-derived values in Zustand "for convenience" produces the same split-brain problem V1 had with `WeeklyReview` snapshots diverging from live data. If it came from the database, it belongs in TanStack Query.

**What must be decided in future ADRs:**
- How the 24-hour correction window for relapse/urge entries interacts with the Rust cascade and mutation invalidation (ADR-006)

---

## References

- `ADR-001` — SD3 (IPC bridge is async; all database access through Tauri commands)
- `ADR-002` — SD2 (Edit cascade: recompute edited day + streak chain walk)
- `ADR-003` — SD1 (Lazy loading per analytics section)
- `SCORING_SPEC.md` — Section 6.1 (Cascade algorithm — sequential reads/writes requiring atomicity)
- V1 lesson: *"Decisions were 'arrived at' not 'decided' — flat hooks, monolithic analytics. None wrong, but none deliberately chosen."*
- V1 lesson: *"AI-assisted development biases toward accretion — 8 enhancement sessions all added code. Nobody prompted 'what should we delete?'"*
