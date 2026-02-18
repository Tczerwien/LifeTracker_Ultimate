# ADR-003: Analytics Architecture

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

The LTU analytics dashboard surfaces behavioral patterns from data across multiple entities: daily habit logs, study sessions, job applications, relapse entries, and computed scores. The architecture question is where query complexity lives — in SQL, in TypeScript, or in pre-computed aggregate tables — and when queries execute relative to user navigation.

The analytics inventory (from PRODUCT_BRIEF.md) breaks into three tiers by complexity:

**Tier 1 — Simple aggregates:** Score trends, 7/30-day moving averages, habit completion rates, vice frequency, study hours, pipeline conversion rates. Standard SQL GROUP BY and window functions over date-filtered rows.

**Tier 2 — Sequential/window queries:** Streak history, day-of-week patterns, calendar heatmap, pipeline velocity (average days between status transitions). Requires ordered scans and date arithmetic, but still well within SQL's domain.

**Tier 3 — Correlation engine:** Which habits correlate most strongly with high `final_score`. Requires computing Pearson's r across 13 habits × N days of data. Multi-pass math with intermediate aggregates — possible in SQL but difficult to write, test, and debug through a string-based query API.

Estimated data volumes at peak usage (4 years daily): ~1,500 `daily_log` rows, ~500 study sessions, ~200 job applications, ~100 relapse entries. SQLite at these volumes is fast. The architecture question is about **correctness and maintainability**, not performance.

---

## Options Considered

### Option A: Pure Real-Time SQL

All analytics computed in SQL at render time. Correlation math expressed as nested SQL with `SUM`, `AVG`, `SQRT`, and multiple subqueries.

**Genuine advantage:** Always reflects current data. No synchronization problem.

**Problem:** Pearson's r in SQL across 13 habits is unmaintainable — especially written and debugged as string literals through Tauri's IPC bridge. Testing requires a populated database, not unit tests. Query logic is scattered across hooks with no isolation boundary.

### Option B: SQL for Aggregates, TypeScript Engine for Correlation ← **Selected**

Tier 1 and Tier 2 analytics run as SQL queries. The Tier 3 correlation engine loads raw `daily_log` rows into TypeScript and computes Pearson's r as a pure function.

### Option C: Pre-Computed Aggregate Tables

Background process updates aggregate tables (`habit_stats`, `score_aggregates`, `correlation_cache`) on every `daily_log` write. Analytics views read from cache tables.

**Genuine advantage:** Analytics reads are trivially fast. Could support future alerting ("score declining for 5 days").

**Problems:**
- Every write gains a second responsibility: update primary table AND invalidate/recompute all affected aggregates. A missed invalidation produces silently stale analytics.
- The edit cascade from ADR-002 (streak chain walk) already makes writes non-trivial. Pre-computation adds another layer to that cascade.
- Pearson's r invalidation across 13 habits when a past entry is edited is non-trivial to reason about correctly.
- Building a cache invalidation system for a personal app with 1,500 rows is premature optimization solving a performance problem that doesn't exist.

---

## Decision

**Option B: SQL for Tier 1 and Tier 2 analytics. TypeScript pure function for the correlation engine. Lazy loading per analytics section.**

Pre-computation (Option C) adds write complexity and a correctness risk that are not justified at LTU's data volumes. The synchronization problem — keeping aggregate caches consistent with live data through edits and cascade recomputes — is harder to get right than the problem it solves.

SQL handles aggregates, GROUP BY, window functions, and date arithmetic well. TypeScript handles iterative math, intermediate state, and unit testing well. The architecture uses each where it is stronger.

---

## Sub-Decisions

### SD1: Query Execution — Lazy Per Section

**Decision:** Analytics queries execute when their section is first rendered or expanded — not all at once on dashboard navigation.

**Rationale:** The analytics dashboard contains 8–10 independent views. Firing all queries simultaneously on navigation creates a burst of concurrent async IPC calls to the Tauri backend. Lazy loading scopes each query to when the user actually views that section.

**Implementation pattern:** Each analytics section is an independent component with its own data-fetching hook. The hook fires its query on mount. Sections not yet scrolled into view have not mounted and have not queried.

**Not a performance optimization** — at LTU's data volumes, all queries are fast. This is about not hammering the IPC bridge unnecessarily and keeping each section's data lifecycle independent.

### SD2: Correlation Engine — Architecture

**Decision:** The correlation engine is a pure TypeScript function in `src/engine/correlation.ts`. It accepts an array of `DailyLogRow` objects and returns a sorted array of `{ habit: string, r: number, pValue?: number }`.

**Inputs:** Raw `daily_log` rows (subset of columns: habit values + `final_score`) for the configured date window.

**Output:** Pearson's r coefficient for each active habit against `final_score`, sorted descending by absolute r value.

**Properties:**
- No database access. No React. No side effects.
- Fully unit-testable with mock row arrays in Vitest.
- The data-fetching hook handles the window query and passes rows to the engine. The engine knows nothing about SQL or config.

**Pearson's r formula:**
```
r(X, Y) = [n·ΣXY − ΣX·ΣY] / sqrt([n·ΣX² − (ΣX)²] · [n·ΣY² − (ΣY)²])
```
Where X = habit values (0/1 for checkbox, numeric for dropdown), Y = `final_score` for the same day.

**Edge cases the engine must handle:**
- Habit with zero variance (all 0s or all 1s across the window) → r = 0, not NaN
- Window with fewer than 7 data points → return `{ r: null, insufficient_data: true }` per habit. The UI renders a "Need more data" placeholder rather than a misleading coefficient.
- Retired habits in historical rows → excluded from computation (consistent with DS9 in SCORING_SPEC.md)

### SD3: Correlation Window — Configurable, Default 90 Days

**Decision:** The correlation engine's lookback window is a user-configurable parameter stored in `app_config`. Default: 90 days. Minimum: 30 days. Maximum: `'all-time'` (no date filter applied).

**Rationale:** 90 days provides enough data points for Pearson's r to be statistically meaningful while keeping the in-memory payload bounded (~90 rows × ~200 bytes = ~18KB). The all-time option is available for users who want to see lifetime patterns after significant data accumulates.

**`app_config` field:** `correlation_window_days` — `INTEGER` or the sentinel value `0` meaning all-time.

**UI:** Settings page exposes this as a dropdown: `30 days / 60 days / 90 days (default) / 180 days / 1 year / All time`. The analytics section header displays the active window: "Habit Correlations (last 90 days)."

**Note for CONFIG_SCHEMA.md (Conversation 6):** `correlation_window_days` requires validation. Valid values: `{0, 30, 60, 90, 180, 365}`. The sentinel value `0` = all-time. Any other value is invalid and should be rejected with a validation error.

### SD4: Analytics Do Not Write

**Decision:** The analytics layer is read-only. No analytics query, hook, or engine function writes to the database.

**Rationale:** Separates concerns cleanly. All writes flow through the data entry layer (daily log save, relapse log, etc.) and the edit cascade (ADR-002 SD2). Analytics cannot accidentally trigger recomputation or modify stored scores.

---

## Consequences

**What this enables:**
- The correlation engine is fully unit-testable without a database — mock row arrays in, coefficients out
- Analytics sections have independent data lifecycles — a slow query in one section doesn't block others
- The write path remains simple: insert/update primary table, trigger edit cascade if needed. No aggregate invalidation.
- SQL queries for Tier 1/2 analytics are isolated in dedicated query functions, not scattered across component hooks

**What this constrains:**
- The correlation engine loads raw rows into memory. At all-time with 4+ years of data, this is ~1,500 rows × ~200 bytes = ~300KB. Not a real constraint, but sets a ceiling on the approach.
- No pre-computed aggregates means no background alerting capability in V1 (e.g., "your score has declined for 5 consecutive days"). If that feature is added later, it will require a separate architecture decision.
- The `correlation_window_days` config parameter must be specified and validated in CONFIG_SCHEMA.md. An invalid value (e.g., `45`) would silently use an arbitrary window — must be caught at the validation layer.
- Lazy loading per section requires each analytics component to manage its own loading state. The UI must render a skeleton/loading state for each section independently.

**What must be decided in future ADRs:**
- How the React layer manages async IPC query state and loading indicators (ADR-005)

---

## References

- `PRODUCT_BRIEF.md` — Analytics & Insights section (Tier 4)
- `DATA_MODEL.md` — D2 (Frozen Scores), D3 (Edit Cascade)
- `SCORING_SPEC.md` — DS9 (Retired habits excluded from scoring)
- `ADR-002` — SD2 (Edit cascade writes only to `daily_log` — analytics must not interfere)
- V1 lesson: *"Monolithic analytics hooks — all added code, nobody prompted 'what should we delete?' Analytics logic scattered across hooks with no isolation boundary."*
