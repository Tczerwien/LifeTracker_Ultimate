# ADR-006: Correction Window for Relapse and Urge Entries

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

`relapse_entry` and `urge_entry` are incident records — detailed logs of behavioral events used for trigger analysis, time-of-day pattern detection, and technique effectiveness tracking. They are distinct from the vice counts on `daily_log` (e.g., `porn = 2`), which are the values that feed the scoring engine.

Two tensions exist:

**Tension 1 — Correction vs. narrative revision.** These entries are filled in late at night, sometimes tired, after an emotionally difficult event. Wrong dropdown selections and typos are common and should be correctable. But the analytical value of these records depends on their integrity — if entries can be freely edited days or weeks later, trigger analysis and time-of-day patterns become unreliable.

**Tension 2 — Edit window vs. score interaction.** Editing a `relapse_entry` row (fixing a trigger, correcting a time) does not affect `daily_log` columns or computed scores. The vice count on `daily_log` and the detailed incident record in `relapse_entry` are separate. Editing the incident record is a data quality fix, not a scoring event.

DATA_MODEL D6 established the 24-hour correction window decision. This ADR specifies the enforcement mechanics, UI behavior, and the precise boundary between what the window covers and what it doesn't.

---

## Decision

**`relapse_entry` and `urge_entry` rows are editable within 24 hours of `created_at`, then permanently locked. Enforced at the application layer. Editing these entries does not interact with the scoring engine or the edit cascade.**

---

## Sub-Decisions

### SD1: What the Window Covers — Incident Records Only

**Decision:** The 24-hour correction window applies exclusively to `relapse_entry` and `urge_entry` rows. It does not apply to any other entity.

**Explicit boundary:**

| Entity | Editable? | Notes |
|---|---|---|
| `relapse_entry` | Within 24h of `created_at` only | Covered by this ADR |
| `urge_entry` | Within 24h of `created_at` only | Covered by this ADR |
| `daily_log` | Always editable | Score recompute + cascade per ADR-002 |
| `journal` | Always editable | No score interaction |
| `study_session` | Always editable | No score interaction |
| `application` | Always editable (archived, not deleted) | Status changes append-only (DATA_MODEL D5) |

**Critical clarification:** Editing the vice count on `daily_log` (e.g., reducing `porn` from 2 to 1) is a `daily_log` edit — always permitted, triggers the edit cascade. This is completely separate from editing the associated `relapse_entry` incident record. A user can correct their score any time; they can correct the detailed incident record only within 24 hours.

### SD2: Enforcement — Application Layer

**Decision:** The lock is enforced at the application layer, not the database layer. SQLite has no time-based write constraint. The app checks `NOW - created_at > 24 hours` before exposing any edit affordance.

**Defense-in-depth:** The Tauri command for updating a `relapse_entry` or `urge_entry` performs the same check on the Rust side before executing the UPDATE. A request to edit a locked entry returns an error even if somehow the UI affordance was bypassed.

**Rust command contract:**
```
invoke('update_relapse_entry', { id, fields }) → Promise<void>
  // Internally (Rust):
  // 1. SELECT created_at FROM relapse_entry WHERE id = ?
  // 2. If NOW - created_at > 24 hours → return Err("Entry locked after 24-hour correction window")
  // 3. Otherwise → UPDATE relapse_entry SET ... WHERE id = ?
  // 4. Return Ok(())
```

Same pattern for `update_urge_entry`.

### SD3: UI Behavior — No Edit Affordance After Window Closes

**Decision:** After the 24-hour window closes, the edit button is not rendered. The entry is visible and all fields are readable, but no edit affordance exists. No explanation modal, no disabled button, no tooltip.

**Rationale:** The absence of an edit button is self-documenting for a personal app used by a single developer who designed the locking rule. An explanation modal (Option C) adds navigation overhead for a constraint the user already knows. A visible-but-disabled button (Option A) implies the action might become available, which it won't.

**Within the 24-hour window:** Standard edit button is present. Clicking opens the entry in an edit form. On save, `last_modified` is updated. The `created_at` timestamp is never changed — it anchors the lock window.

**Entry list display:** The list of relapse/urge entries does not visually distinguish locked from unlocked entries. There is no lock icon, no color difference. The presence or absence of the edit button is the only signal.

### SD4: No Score Interaction

**Decision:** Editing a `relapse_entry` or `urge_entry` within the correction window does not trigger a score recompute or the edit cascade.

**Rationale:** These tables have no columns on `daily_log`. The scoring engine receives vice counts from `daily_log` only (e.g., `porn INTEGER`, `weed INTEGER`). `relapse_entry` stores contextual metadata about the incident — trigger, location, device, emotional state, technique used. None of these fields feed the scoring formula.

**If a user needs to correct a vice count that affects their score:** That is a `daily_log` edit, not a `relapse_entry` edit. The user updates the vice count on the daily log entry for that date. The edit cascade runs. The relapse incident record is a separate concern.

**TanStack Query invalidation on successful edit:**
```typescript
onSuccess: () => {
  // Invalidate only the relapse/urge list for that date
  queryClient.invalidateQueries({ queryKey: ['relapse-entries', date] })
  // No score, streak, or daily-log invalidation
}
```

### SD5: `created_at` is the Lock Anchor — Not `date`

**Decision:** The 24-hour window is measured from `created_at` (ISO 8601 datetime of insertion), not from the `date` field (the calendar date of the incident).

**Rationale:** A user may log a relapse incident at 11:45 PM on Monday. `date = Monday`, `created_at = Monday 23:45`. They should be able to correct it at 10:00 AM on Tuesday — which is within 24 hours of creation but on a different calendar date. Using `date` as the anchor would lock the entry at midnight, giving as little as 15 minutes to correct an entry logged late at night.

**Edge case — retroactive logging:** A user may log a relapse that happened two days ago. `date = Saturday`, `created_at = Monday`. The 24-hour window runs from Monday's `created_at`. The entry locks Tuesday at the same time it was created Monday. The stale `date` does not affect the window.

---

## Consequences

**What this enables:**
- Same-night correction of wrong dropdown selections without enabling retroactive narrative revision
- Trigger analysis and time-of-day pattern analytics remain trustworthy — entries can't be edited to obscure patterns after the fact
- The scoring engine is completely isolated from this ADR — no new cascade logic, no score interaction
- The Zustand `selectedDate` and TanStack Query key hierarchy are unaffected — relapse/urge mutations invalidate only their own keys

**What this constrains:**
- After 24 hours, an incorrect `relapse_entry` cannot be corrected through the UI. This is a deliberate trade-off between data integrity and flexibility. For a behavioral analysis tool, integrity wins.
- The application layer (Rust command) is the authoritative enforcement point. The UI check (`created_at > 24h → don't render edit button`) is a UX convenience, not the security boundary.
- `created_at` must be set accurately at insertion time and must never be editable. Any migration that modifies `created_at` retroactively would silently reopen locked entries.

---

## References

- `DATA_MODEL.md` — D6 (Relapse/Urge Immutability — 24-Hour Correction Window)
- `ADR-002` — SD2 (Edit cascade applies to `daily_log` only — not incident records)
- `ADR-005` — SD3 (Mutation invalidation pattern — relapse mutations invalidate relapse keys only)
