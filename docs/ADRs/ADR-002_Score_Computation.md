# ADR-002: Score Computation Model

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

The scoring engine produces five values for each daily log entry: `positive_score`, `vice_penalty`, `base_score`, `streak`, and `final_score`. A fundamental design question is whether these values are **stored** (computed once, written to the database, and read back) or **derived** (recomputed on every read from raw habit and vice data).

A secondary question is whether changing scoring configuration — multipliers, penalties, thresholds — should retroactively update historical scores or only affect future computations.

A third question is how the `weekly_review` score snapshot relates to live data when past entries are edited after the review is saved.

V1 had no explicit position on any of these. `WeeklyReview` stored a `scoreSnapshot` array, but live analytics queried scores that could diverge from it. There was no documented decision about which was authoritative.

---

## Options Considered

### Option A: Derived Scores — Recomputed on Every Read

Scores are never stored. Every time a view needs a score, it queries the raw habit/vice columns and runs the scoring formula. Config changes immediately affect all historical scores.

**Genuine advantages:**
- No stored data can become stale or inconsistent
- Config changes propagate everywhere instantly
- No cascade logic required on edit

**Problems:**
- `streak` cannot be computed without yesterday's streak — making it fundamentally sequential. A "recompute on read" approach for streak requires walking the entire history from Day 1 on every query. At 365 days of data, this is 365 sequential reads before rendering the dashboard.
- Historical score meaning changes silently when config is tuned. A 75% from January becomes a different 75% in June if you've adjusted multipliers.
- Analytics require consistent historical baselines. If you tune the vice cap from 40% to 35% in March, did your February scores improve? They shouldn't — but they would under this model.

### Option B: Frozen Scores — Stored at Computation Time ← **Selected**

All five scores are computed once (when the daily log entry is saved or edited) and written as columns on the `daily_log` row. They are read back directly — no recomputation on read. Config changes are prospective only.

### Option C: Hybrid — Derived for Display, Stored for History

Show live-recomputed scores in the UI for "today," store frozen scores for historical dates. Adds a boundary condition: when exactly does a score transition from live to frozen?

**Problem:** This boundary is arbitrary and introduces a class of bug where the score you see today is different from the score the dashboard will show tomorrow for the same entry. Complexity without benefit.

---

## Decision

**Option B: All five scores frozen at computation time.**

The streak's sequential dependency alone makes Option A impractical. But the deeper reason is philosophical: scores are **measurements**, not **views**. A measurement taken in January under January's rules should not change because you updated a multiplier in March. The scoring model encodes value judgments (DS2 in SCORING_SPEC.md) — those judgments evolve over time, and the historical record should reflect what was actually measured under the rules that were in effect.

---

## Sub-Decisions

### SD1: Config Changes — Prospective Only

**Decision:** Changing any value in `app_config` or `habit_config` (multipliers, penalties, thresholds, points) does not trigger recomputation of historical scores. Past scores remain as computed. Future computations use new values.

**Rationale:** Historical scores are the longitudinal record of your behavior under a consistent ruleset. Retroactive recomputation would make it impossible to reason about improvement over time — did your score go up because your behavior improved, or because you loosened the target fraction?

**Consequence:** After a config change, the analytics dashboard will show a visible discontinuity on the date of the change. This is correct behavior, not a bug. It is honest about what happened.

### SD2: Edit Cascade — Recompute Edited Day + Walk Streak Chain Forward

**Decision:** When a `daily_log` entry is edited, recompute that day's five scores using current config, then walk forward through subsequent days recomputing only `streak` and `final_score` until stored values converge with recomputed values.

**Rationale:** `positive_score`, `vice_penalty`, and `base_score` are independent per day — only the edited day's raw inputs changed. `streak` and `final_score` have sequential dependencies: day N's streak depends on day N-1's streak. The forward walk propagates the change through the streak chain. The convergence condition (stop when stored values match recomputed values) bounds the walk — it terminates at the next streak-breaking day, not at the end of history.

**Algorithm (summary):**
```
onEdit(date d):
  recompute all 5 scores for d using current config
  walk d+1, d+2, ... until:
    recomputed streak == stored streak AND
    recomputed finalScore == stored finalScore
    → stop (convergence)
  update streak + finalScore only for intermediate days
```

Full algorithm specified in SCORING_SPEC.md Section 6.1.

### SD3: Weekly Review Snapshot — Snapshot is Authoritative for the Review Page

**Decision:** `weekly_review.score_snapshot` (a JSON array of 7 `final_score` values) is captured at review save time and never updated. It is the authoritative source for the weekly review page. The analytics dashboard uses live `daily_log` scores.

**Rationale:** The weekly review is a ritual artifact. The reflection fields ("biggest win," "biggest challenge") were written in the context of the scores visible at review time. If past entries are edited after the review is saved, the snapshot and the live scores will diverge. This divergence is correct — it means "you reviewed this week under these scores, then later revised the data." The snapshot records what the week meant to you at the time of reflection.

**Rule:** The analytics dashboard reads `daily_log.final_score` for all trend and aggregate calculations. The weekly review page reads `weekly_review.score_snapshot` for its display. These are two different things serving two different purposes. They are not expected to agree after historical edits.

**UI requirement:** The weekly review page displays `snapshot_date` as metadata (e.g., "Reviewed Sunday Feb 16 at 11:42 PM"). No divergence warning, no "refresh snapshot" button. The snapshot is the record.

---

## Consequences

**What this enables:**
- Score reads are O(1) — a single column read from `daily_log`, no recomputation
- Dashboard rendering requires no scoring logic — just SQL aggregates over stored columns
- Historical scores are stable and comparable across time
- The scoring engine is a pure function that runs exactly once per save/edit event

**What this constrains:**
- Config changes produce a visible discontinuity in historical analytics. This must be communicated clearly in the Settings UI ("Changing this value will not affect past scores").
- The edit cascade logic (streak chain walk) must be implemented correctly — it is the only place where stored scores are rewritten. A bug here produces silently incorrect streak values.
- `weekly_review.score_snapshot` and `daily_log.final_score` are allowed to diverge after historical edits. The app layer must never attempt to "reconcile" them automatically.
- The scoring engine must be 100% test-covered (Vitest) because it is the sole authority on what values get frozen. A scoring bug that reaches production cannot be corrected retroactively without a manual data migration.

**What must be decided in future ADRs:**
- How the React layer reads stored scores and handles the async IPC boundary (ADR-005)
- How the 24-hour correction window for relapse/urge entries interacts with the edit cascade (ADR-006)

---

## References

- `DATA_MODEL.md` — D2 (Stored Scores), D3 (Edit Cascade), D4 (Config Prospective Only)
- `SCORING_SPEC.md` — Section 6 (Cascade Specification), DS2, DS3, DS4
- V1 lesson: *"Score snapshots vs live computation — WeeklyReview stores snapshots that diverge from live data when past entries are edited. Need an explicit decision: immutable audit records or computed views?"*
