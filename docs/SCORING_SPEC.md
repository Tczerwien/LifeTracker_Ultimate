# Life Tracker Ultimate — Scoring Engine Specification

> V2 Rebuild | February 2026
> Mathematical formulas, edge case truth table, and test vectors for the two-pool scoring engine.
> This document is the authoritative reference for implementing and testing the scoring engine.

---

## Table of Contents

1. [Design Decisions (Scoring)](#1-design-decisions-scoring)
2. [Definitions & Notation](#2-definitions--notation)
3. [Scoring Pipeline](#3-scoring-pipeline)
   - [3.1 MaxWeighted Computation](#31-maxweighted-computation)
   - [3.2 Positive Score](#32-positive-score)
   - [3.3 Vice Penalty](#33-vice-penalty)
   - [3.4 Base Score](#34-base-score)
   - [3.5 Streak](#35-streak)
   - [3.6 Final Score](#36-final-score)
4. [Function Contract](#4-function-contract)
5. [Edge Case Truth Table](#5-edge-case-truth-table)
6. [Cascade Specification](#6-cascade-specification)
7. [Test Vectors](#7-test-vectors)
8. [Appendix: Seed Data Reference](#8-appendix-seed-data-reference)

---

## 1. Design Decisions (Scoring)

These decisions were made during specification planning (Conversation 3). Each is referenced by ID throughout this document.

| ID | Decision | Rationale |
|----|----------|-----------|
| DS1 | `points` is the authoritative max for all habits. For dropdown habits, the Settings UI auto-syncs `points = max(options_json)` on save. The scoring engine only reads `points`, never `options_json`. | Single source of truth. Validation prevents config mismatch. Engine stays simple. |
| DS2 | Vice penalty is multiplicative: `baseScore = positiveScore × (1 - vicePenalty)`. | Vices scale with effort. Protecting good days is part of the incentive design. A productive day with a relapse still scores higher than a lazy day without one. |
| DS3 | Streak threshold applies to `baseScore`, not `finalScore`. | No flywheel. Every day earns streak qualification independently. The streak bonus is a reward, not a crutch. |
| DS4 | Day 1 streak is unconditionally 0. | When no previous `daily_log` entry exists, `streak = 0` regardless of score. Streak bonus begins on Day 2 at earliest. |
| DS5 | Pure scoring function. | The engine receives pre-resolved numeric values only. Dropdown text → number resolution is an app-layer concern. Contract: `(numbers in) → (numbers out)`. |
| DS6 | Gaps break streaks. | If no `daily_log` row exists for the previous calendar day, `previousStreak = 0`. Streak means consecutive calendar days of tracking. |
| DS7 | Zero `maxWeighted` guard. | If `maxWeighted = 0` (all habits retired), `positiveScore = 0`. Settings UI also prevents retiring the last active habit. Defense in depth. |
| DS8 | Phone tiers are mutually exclusive. | Pay the highest qualifying tier only, not the sum. Below all tiers = no penalty. |
| DS9 | Retired habits excluded from both numerator and denominator. | Prospective only. May shift what it takes to hit 100% positive — acknowledged consequence. |
| DS10 | Scoring engine trusts its inputs. | No validation in the engine. App layer validates before calling. Spec states this assumption explicitly. |

---

## 2. Definitions & Notation

### Sets

| Symbol | Definition |
|--------|-----------|
| **H** | Set of all active good habits (`habit_config` rows where `pool = 'good'` AND `is_active = 1`) |
| **V** | Set of all active vices (`habit_config` rows where `pool = 'vice'` AND `is_active = 1`) |

### Per-Habit Functions (Good Habits)

| Symbol | Definition |
|--------|-----------|
| **p(h)** | Points for habit h. Read from `habit_config.points`. Always > 0 for good habits. For dropdown habits, guaranteed to equal `max(options_json)` by Settings UI validation (DS1). |
| **v(h)** | Selected value for habit h on the current day. Checkbox: 0 or 1. Dropdown: the numeric option value (pre-resolved by app layer, DS5). Range: `[0, p(h)]`. |
| **cat(h)** | Category of habit h. One of: `Productivity`, `Health`, `Growth`. |
| **m(c)** | Category multiplier for category c. Read from `app_config`. `m(Productivity) = 1.5`, `m(Health) = 1.3`, `m(Growth) = 1.0` by default. Always > 0. |

### Per-Vice Functions

| Symbol | Definition |
|--------|-----------|
| **penalty(v)** | Penalty value for vice v. Read from `habit_config.penalty`. Range: [0, 1.0]. |
| **mode(v)** | Penalty mode for vice v. One of: `flat`, `per_instance`, `tiered`. |
| **val(v)** | Recorded value for vice v on the current day. Checkbox: 0 or 1. Number (porn): integer ≥ 0. Number (phone_use): integer minutes ≥ 0. |

### Scoring Parameters (from `app_config`)

| Symbol | Field | Default | Valid Range |
|--------|-------|---------|-------------|
| **tf** | `target_fraction` | 0.85 | (0, 1.0] |
| **vc** | `vice_cap` | 0.40 | [0, 1.0] |
| **st** | `streak_threshold` | 0.65 | [0, 1.0] |
| **sb** | `streak_bonus_per_day` | 0.01 | [0, 0.1] |
| **mb** | `max_streak_bonus` | 0.10 | [0, 0.5] |
| **t1** | `phone_t1_min` | 61 | [0, 1440] |
| **t2** | `phone_t2_min` | 181 | [0, 1440] |
| **t3** | `phone_t3_min` | 301 | [0, 1440] |

Invariant enforced at app layer: `t1 < t2 < t3`.

### Phone Tier Penalties (from `app_config` via `habit_config` tiers)

| Symbol | Tier | Default |
|--------|------|---------|
| **pt1** | `phone_t1` penalty | 0.03 |
| **pt2** | `phone_t2` penalty | 0.07 |
| **pt3** | `phone_t3` penalty | 0.12 |

Note: Phone tier penalty values (`pt1`, `pt2`, `pt3`) are stored in `app_config` as `phone_t1_penalty`, `phone_t2_penalty`, `phone_t3_penalty`. The app layer reads them alongside the threshold values and passes them to the scoring engine as named parameters in `ScoringConfig.phonePenalties`.

---

## 3. Scoring Pipeline

```
habitValues{} + viceValues{} + config{}
        │
        ▼
 ┌─────────────────┐
 │ 3.1 MaxWeighted  │  Σ(p(h) × m(cat(h)))  for all h ∈ H
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ 3.2 PositiveScore│  min(1.0, WeightedSum / (MaxWeighted × tf))
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ 3.3 VicePenalty  │  min(vc, Σ triggered penalties)
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ 3.4 BaseScore    │  PositiveScore × (1 - VicePenalty)
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ 3.5 Streak       │  based on BaseScore ≥ st (DS3)
 └────────┬────────┘
          │
          ▼
 ┌─────────────────┐
 │ 3.6 FinalScore   │  min(1.0, BaseScore × (1 + min(Streak × sb, mb)))
 └────────┬────────┘
          │
          ▼
    { positiveScore, vicePenalty, baseScore, streak, finalScore }
```

---

### 3.1 MaxWeighted Computation

MaxWeighted is the theoretical maximum weighted score if every active good habit is completed at its highest value.

```
MaxWeighted = Σ  p(h) × m(cat(h))    for all h ∈ H
```

With default seed data (13 active habits):

| Category | Habits | Points Sum | Multiplier | Weighted |
|----------|--------|-----------|------------|----------|
| Productivity | schoolwork(3), personal_project(3), classes(2), job_search(2) | 10 | 1.5 | 15.0 |
| Health | gym(3), sleep_7_9h(2), wake_8am(1), supplements(1), meal_quality(3), stretching(1) | 11 | 1.3 | 14.3 |
| Growth | meditate(1), read(1), social(2) | 4 | 1.0 | 4.0 |
| **Total** | | **25** | | **33.3** |

```
Target = MaxWeighted × tf = 33.3 × 0.85 = 28.305
```

**Recomputation rule:** MaxWeighted is computed dynamically from active `habit_config` rows at scoring time. When habits are added or retired, future MaxWeighted changes. Past scores are not recomputed (prospective only, D4/DS9).

**Guard (DS7):** If `H = ∅` (no active habits), then `MaxWeighted = 0` and `PositiveScore = 0`. Skip the division.

---

### 3.2 Positive Score

Measures how much of the achievable positive potential was hit today.

```
WeightedSum = Σ  v(h) × m(cat(h))    for all h ∈ H

PositiveScore = min(1.0, WeightedSum / (MaxWeighted × tf))
```

If `MaxWeighted = 0`: `PositiveScore = 0` (DS7).

**Domain:** `PositiveScore ∈ [0.0, 1.0]`

**Value resolution (app layer, DS5):**

The `daily_log` column stores raw values (0/1 for checkboxes, text keys for dropdowns). The app layer resolves these to scoring values before calling the engine:

- **Checkbox habit** — column = 1 (completed): `v(h) = p(h)`. Column = 0 (not completed): `v(h) = 0`.
  Example: `schoolwork` (points=3) completed → `v(h) = 3`, contribution = `3 × 1.5 = 4.5`.
- **Dropdown habit** — text key resolved to numeric option value: `v(h) = option_value`.
  Example: `meal_quality` = "Good" → `v(h) = 2`, contribution = `2 × 1.3 = 2.6`.

The scoring engine receives only resolved numeric values:
- `v(h) ∈ {0, p(h)}` for checkbox habits
- `v(h) ∈ [0, p(h)]` for dropdown habits (where `p(h) = max(option_values)` per DS1)

**Example (all habits completed at max):**

```
WeightedSum = (3+3+2+2)×1.5 + (3+2+1+1+3+1)×1.3 + (1+1+2)×1.0 = 15.0 + 14.3 + 4.0 = 33.3
PositiveScore = min(1.0, 33.3 / 28.305) = min(1.0, 1.1766) = 1.0
```

**Example (partial day — 6 habits at max, 2 dropdowns at mid):**

```
WeightedSum = (3+3)×1.5 + (3+2+2)×1.3 + (1+0.5)×1.0 = 9.0 + 9.1 + 1.5 = 19.6
PositiveScore = min(1.0, 19.6 / 28.305) = min(1.0, 0.6925) = 0.6925
```

---

### 3.3 Vice Penalty

Each active vice contributes a penalty based on its `penalty_mode`. Penalties sum, then are capped by `vice_cap`.

```
VicePenalty = min(vc, Σ  penalty_contribution(v)    for all v ∈ V)
```

**Penalty contribution by mode:**

**`flat` mode** (checkbox vices: masturbate, weed, skip_class, binged_content, gaming_1h, past_12am, late_wake):

```
penalty_contribution(v) = {
    penalty(v)    if val(v) = 1  (checked)
    0             if val(v) = 0  (unchecked)
}
```

**`per_instance` mode** (porn):

```
penalty_contribution(v) = val(v) × penalty(v)
```

Where `val(v)` is the instance count (integer ≥ 0). Example: 2 instances × 0.25 = 0.50 → capped at `vc` = 0.40.

**`tiered` mode** (phone_use):

```
penalty_contribution(v) = {
    pt3    if val(v) ≥ t3
    pt2    if val(v) ≥ t2
    pt1    if val(v) ≥ t1
    0      if val(v) < t1
}
```

Tiers are mutually exclusive (DS8). The highest qualifying tier applies. Evaluated top-down: check t3 first, then t2, then t1.

**Domain:** `VicePenalty ∈ [0.0, vc]` (default: `[0.0, 0.40]`)

**Example (porn=1, past_12am=1, phone=200min):**

```
penalties = 0.25 + 0.05 + 0.07 = 0.37
VicePenalty = min(0.40, 0.37) = 0.37
```

**Example (porn=2):**

```
penalties = 2 × 0.25 = 0.50
VicePenalty = min(0.40, 0.50) = 0.40  (capped)
```

---

### 3.4 Base Score

Combines positive effort with vice penalty using the multiplicative model (DS2).

```
BaseScore = PositiveScore × (1 - VicePenalty)
```

**Domain:** `BaseScore ∈ [0.0, 1.0]`

**Key property:** A perfect positive day (1.0) with maximum vice penalty (0.40) yields `1.0 × 0.60 = 0.60`. A lazy day (0.50) with the same penalty yields `0.50 × 0.60 = 0.30`. Vices cost more on good days.

---

### 3.5 Streak

Consecutive calendar days (DS6) with `BaseScore ≥ st` (DS3).

```
Streak = {
    0                          if this is Day 1 (no prior daily_log entry exists) (DS4)
    0                          if no daily_log row exists for the previous calendar day (DS6)
    previousStreak + 1         if BaseScore ≥ st
    0                          if BaseScore < st
}
```

Where `previousStreak` is the `streak` value stored on the previous calendar day's `daily_log` row.

**Domain:** `Streak ∈ {0, 1, 2, ...}` (non-negative integer)

**Day 1 bootstrap (DS4):** The first `daily_log` entry ever created has `streak = 0`, unconditionally. This is a special case — even if `BaseScore ≥ st`, streak remains 0.

**Gap handling (DS6):** If the user skips a day (no `daily_log` row for the previous calendar day), `previousStreak = 0`. Even if they had a 30-day streak before the gap, the streak resets.

**Determining "previous calendar day":** Given the current entry's date `d`, the previous calendar day is `d - 1` (one calendar day prior). Query: `SELECT streak FROM daily_log WHERE date = date(d, '-1 day')`. If no row is returned, `previousStreak = 0`.

**Determining "Day 1":** Day 1 is defined as: no `daily_log` row exists with a `date` earlier than the current entry's date. Query: `SELECT COUNT(*) FROM daily_log WHERE date < d`. If count = 0, this is Day 1.

---

### 3.6 Final Score

Applies the streak bonus to the base score.

```
StreakBonus = min(Streak × sb, mb)
FinalScore = min(1.0, BaseScore × (1 + StreakBonus))
```

**Domain:** `FinalScore ∈ [0.0, 1.0]`

**Key behaviors:**

- Streak = 0 → `StreakBonus = 0` → `FinalScore = BaseScore`
- Streak = 5 → `StreakBonus = min(0.05, 0.10) = 0.05` → `FinalScore = BaseScore × 1.05`
- Streak = 10 → `StreakBonus = min(0.10, 0.10) = 0.10` → `FinalScore = BaseScore × 1.10`
- Streak = 15 → `StreakBonus = min(0.15, 0.10) = 0.10` → `FinalScore = BaseScore × 1.10` (capped)
- After 10 days, the streak bonus stops growing. Maintaining the streak preserves the 10% bonus but doesn't increase it.

---

## 4. Function Contract

The scoring engine is a **pure function** (DS5, DS10). It has no side effects, no database access, and no knowledge of JSON schemas, dropdown text keys, or config storage.

### Input

```
ScoringInput {
    habitValues:     Map<string, number>    // key = habit name, value = resolved numeric value
                                             // checkbox: 0 or p(h)
                                             // dropdown: resolved option value
    viceValues:      Map<string, number>     // key = vice name, value = numeric value
                                             // checkbox: 0 or 1
                                             // number (porn): count ≥ 0
                                             // number (phone): minutes ≥ 0
    previousStreak:  number                  // from previous calendar day's daily_log.streak
                                             // 0 if no previous entry, gap in tracking, or Day 1
    isFirstDay:      boolean                 // true if no prior daily_log entries exist
}
```

### Config

```
ScoringConfig {
    habits:          HabitInfo[]             // active good habits with points and category
    vices:           ViceInfo[]              // active vices with penalty, mode
    multipliers:     Map<string, number>     // category → multiplier (Productivity, Health, Growth)
    targetFraction:  number                  // tf
    viceCap:         number                  // vc
    streakThreshold: number                  // st
    streakBonusPerDay: number                // sb
    maxStreakBonus:   number                  // mb
    phoneTiers:      { t1: number, t2: number, t3: number }     // minute thresholds
    phonePenalties:  { pt1: number, pt2: number, pt3: number }  // per-tier penalties
}

HabitInfo {
    name:     string
    points:   number     // > 0
    category: string     // Productivity | Health | Growth
}

ViceInfo {
    name:        string
    penalty:     number  // [0, 1.0]
    penaltyMode: string  // flat | per_instance | tiered
}
```

### Output

```
ScoringOutput {
    positiveScore: number    // [0.0, 1.0]
    vicePenalty:   number    // [0.0, vc]
    baseScore:     number    // [0.0, 1.0]
    streak:        number    // non-negative integer
    finalScore:    number    // [0.0, 1.0]
}
```

### App Layer Responsibilities (before calling engine)

1. Read `daily_log` row → extract column values.
2. For each checkbox habit: if column = 1, pass `v(h) = p(h)`. If column = 0, pass `v(h) = 0`.
3. For each dropdown habit: look up text key in `options_json` → pass the numeric value.
4. For each vice: pass the raw column value (0/1 for checkbox, integer for number).
5. Determine `previousStreak`: query `daily_log` for `date = d - 1 day`. If no row → 0 (DS6). Otherwise → stored `streak` value.
6. Determine `isFirstDay`: query `SELECT COUNT(*) FROM daily_log WHERE date < d`. If 0 → true.
7. Call scoring engine with resolved values.
8. Write all five output values to the `daily_log` row.

---

## 5. Edge Case Truth Table

Every degenerate or boundary input and its expected output. Test vectors in Section 7 provide concrete numbers.

| # | Scenario | PositiveScore | VicePenalty | BaseScore | Streak | FinalScore | Notes |
|---|----------|--------------|-------------|-----------|--------|------------|-------|
| E1 | All habits completed at max, no vices | 1.0 | 0.0 | 1.0 | prev+1 or 0 | 1.0 × (1+bonus) capped at 1.0 | Perfect day |
| E2 | No habits completed, no vices | 0.0 | 0.0 | 0.0 | 0 | 0.0 | Empty day |
| E3 | No habits completed, all vices triggered | 0.0 | vc (0.40) | 0.0 | 0 | 0.0 | Worst day: 0 × anything = 0 |
| E4 | All habits completed, all vices triggered | 1.0 | vc (0.40) | 0.60 | depends on 0.60 ≥ st | depends | Vice cap preserves 60% of effort |
| E5 | Day 1 — qualifies for streak | computed | computed | ≥ st | **0** | baseScore (no bonus) | DS4: Day 1 streak unconditionally 0 |
| E6 | Day 2 after qualifying Day 1 | computed | computed | ≥ st | 1 | baseScore × 1.01 | First streak bonus |
| E7 | Gap in tracking (missed yesterday) | computed | computed | computed | **0** | baseScore (no bonus) | DS6: gaps reset streak |
| E8 | BaseScore exactly at streak threshold (0.65) | computed | computed | 0.65 | prev+1 or 0 | with bonus | `≥` includes equality |
| E9 | BaseScore just below threshold (0.6499) | computed | computed | 0.6499 | 0 | 0.6499 | Streak breaks |
| E10 | Porn count = 2 (penalty 0.50 > cap) | computed | **0.40** | computed | depends | depends | Vice cap enforced |
| E11 | Porn count = 0 | computed | 0.0 (from porn) | computed | depends | depends | per_instance × 0 = 0 |
| E12 | Phone = 60 min (below t1=61) | computed | 0.0 (from phone) | computed | depends | depends | Below all tiers, no penalty |
| E13 | Phone = 61 min (exactly t1) | computed | 0.03 (from phone) | computed | depends | depends | `≥` triggers tier 1 |
| E14 | Phone = 181 min (exactly t2) | computed | 0.07 (from phone) | computed | depends | depends | Tier 2 replaces tier 1 |
| E15 | Phone = 301 min (exactly t3) | computed | 0.12 (from phone) | computed | depends | depends | Tier 3 replaces tier 2 |
| E16 | Phone = 0 | computed | 0.0 (from phone) | computed | depends | depends | No phone use, no penalty |
| E17 | All habits retired (maxWeighted = 0) | **0.0** | computed | 0.0 | 0 | 0.0 | DS7: guard against division by zero |
| E18 | Streak at 10+ days | computed | computed | ≥ st | prev+1 | baseScore × 1.10 | Max streak bonus reached |
| E19 | Streak at 15 days | computed | computed | ≥ st | 16 | baseScore × 1.10 | Bonus capped, streak counter continues |
| E20 | Social = "Brief/Text" (0.5) | includes 0.5 × 1.0 | computed | computed | depends | depends | Fractional dropdown value |
| E21 | vice_cap = 0.0 | computed | **0.0** | = positiveScore | depends | depends | Vices effectively disabled |
| E22 | target_fraction = 1.0 | computed (lower) | computed | computed | depends | depends | Must complete 100% for full positive score |
| E23 | FinalScore would exceed 1.0 from streak bonus | computed | computed | > 0.91 with streak ≥ 10 | ≥ 10 | **1.0** | Capped at 1.0 |

---

## 6. Cascade Specification

Reference: Data Model decisions D3 (edit cascade) and D4 (prospective config).

### 6.1 When a `daily_log` Entry Is Edited

**Trigger:** Any habit or vice value changes on an existing `daily_log` row.

**Algorithm:**

```
function onDailyLogEdit(editedDate):
    // Step 1: Recompute edited day
    row = loadDailyLog(editedDate)
    config = loadAppConfig()
    habitConfig = loadActiveHabitConfig()

    input = resolveValues(row, habitConfig)  // app-layer resolution (DS5)
    prevStreak = getPreviousStreak(editedDate)  // previous calendar day (DS6)
    isFirst = isFirstDay(editedDate)  // DS4

    result = calculateDayScore(input, prevStreak, isFirst, config)
    saveDayScores(editedDate, result)

    // Step 2: Walk forward through streak chain
    currentDate = editedDate + 1 day

    while dailyLogExists(currentDate):
        storedRow = loadDailyLog(currentDate)
        prevDayStreak = loadDailyLog(currentDate - 1 day).streak

        // Base score doesn't change for subsequent days — only streak chain
        newStreak = computeStreak(storedRow.baseScore, prevDayStreak, config.streakThreshold, isFirstDay(currentDate))
        newFinalScore = computeFinalScore(storedRow.baseScore, newStreak, config)

        if newStreak == storedRow.streak AND newFinalScore == storedRow.finalScore:
            break  // Convergence — all subsequent days are correct

        updateStreakAndFinal(currentDate, newStreak, newFinalScore)
        currentDate = currentDate + 1 day
```

**Key properties:**

- Only the edited day's `positiveScore`, `vicePenalty`, and `baseScore` are recomputed.
- Subsequent days only have `streak` and `finalScore` recalculated (their base scores are independent).
- The walk terminates at the first day where recomputed values match stored values — usually at the next streak-breaking day.
- If the edited day is the most recent entry, no walk is needed.

### 6.2 When `app_config` Is Changed

**No cascade.** Past scores are untouched. Future score computations use the new config values. Historical scores reflect the scoring rules in effect when they were computed.

### 6.3 When `habit_config` Is Changed

- **Adding a habit:** Historical scores untouched. Future scoring includes the new habit in MaxWeighted.
- **Retiring a habit:** Historical scores untouched. Future scoring excludes the retired habit from both numerator and denominator (DS9).
- **Changing points/penalty:** Prospective only.

---

## 7. Test Vectors

Each test vector provides exact inputs and expected outputs, hand-computable to verify the implementation. All use the default config values and the default 13 good habits / 9 vices from seed data unless stated otherwise.

**Default config reference:**
- MaxWeighted = 33.3, Target = 28.305
- tf = 0.85, vc = 0.40, st = 0.65, sb = 0.01, mb = 0.10
- Phone tiers: t1=61, t2=181, t3=301
- Phone penalties: pt1=0.03, pt2=0.07, pt3=0.12

---

### TV01: Perfect Day — All Habits, No Vices, Day 1

**Input:**
- All 13 good habits at max value (checkbox = points value, dropdowns at max option)
- All 9 vices at 0
- previousStreak = 0, isFirstDay = true

**Calculation:**
```
WeightedSum = (3+3+2+2)×1.5 + (3+2+1+1+3+1)×1.3 + (1+1+2)×1.0 = 15.0 + 14.3 + 4.0 = 33.3
PositiveScore = min(1.0, 33.3 / 28.305) = min(1.0, 1.17659) = 1.0
VicePenalty = 0.0
BaseScore = 1.0 × (1 - 0.0) = 1.0
Streak = 0  (DS4: Day 1)
FinalScore = min(1.0, 1.0 × (1 + min(0 × 0.01, 0.10))) = min(1.0, 1.0) = 1.0
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 1.0 |
| vicePenalty | 0.0 |
| baseScore | 1.0 |
| streak | 0 |
| finalScore | 1.0 |

---

### TV02: Empty Day — Nothing Done, No Vices

**Input:**
- All 13 good habits at 0
- All 9 vices at 0
- previousStreak = 3, isFirstDay = false

**Calculation:**
```
WeightedSum = 0
PositiveScore = min(1.0, 0 / 28.305) = 0.0
VicePenalty = 0.0
BaseScore = 0.0 × (1 - 0.0) = 0.0
Streak = 0  (0.0 < 0.65)
FinalScore = 0.0
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.0 |
| vicePenalty | 0.0 |
| baseScore | 0.0 |
| streak | 0 |
| finalScore | 0.0 |

---

### TV03: Vice-Heavy Day — All Vices, No Habits

**Input:**
- All 13 good habits at 0
- Vices: porn=1, masturbate=1, weed=1, skip_class=1, binged_content=1, gaming_1h=1, past_12am=1, late_wake=1, phone_use=400
- previousStreak = 0, isFirstDay = false

**Calculation:**
```
WeightedSum = 0
PositiveScore = 0.0
VicePenalty: 0.25 + 0.10 + 0.12 + 0.08 + 0.07 + 0.06 + 0.05 + 0.03 + 0.12 = 0.88
    → min(0.40, 0.88) = 0.40
BaseScore = 0.0 × (1 - 0.40) = 0.0
Streak = 0
FinalScore = 0.0
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.0 |
| vicePenalty | 0.40 |
| baseScore | 0.0 |
| streak | 0 |
| finalScore | 0.0 |

---

### TV04: Good Day With Single Relapse — Multiplicative Impact

**Input:**
- Habits: schoolwork=3, personal_project=3, gym=3, sleep_7_9h=2, wake_8am=1, meal_quality=3("Great"), meditate=1, read=1 (8 habits, rest at 0)
- Vices: porn=1, rest at 0
- previousStreak = 4, isFirstDay = false

**Calculation:**
```
WeightedSum = (3+3)×1.5 + (3+2+1+3)×1.3 + (1+1)×1.0 = 9.0 + 11.7 + 2.0 = 22.7
PositiveScore = min(1.0, 22.7 / 28.305) = min(1.0, 0.80212) = 0.80212
VicePenalty = 1 × 0.25 = 0.25
BaseScore = 0.80212 × (1 - 0.25) = 0.80212 × 0.75 = 0.60159
Streak = 0  (0.60159 < 0.65 — streak breaks!)
FinalScore = min(1.0, 0.60159 × 1.0) = 0.60159
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.80212 |
| vicePenalty | 0.25 |
| baseScore | 0.60159 |
| streak | 0 |
| finalScore | 0.60159 |

**Note:** This is a critical test — a strong positive day (80.2%) is dragged below the streak threshold by a single relapse. The 4-day streak breaks. This demonstrates the multiplicative vice model and its behavioral consequences.

---

### TV05: Streak Building — Day 2 After Qualifying Day 1

**Input:**
- Habits: schoolwork=3, personal_project=3, classes=2, gym=3, sleep_7_9h=2, supplements=1, meal_quality=2("Good"), stretching=1, read=1 (9 habits)
- Vices: past_12am=1, rest at 0
- previousStreak = 0, isFirstDay = false (Day 2; Day 1 had streak=0 stored)

**Calculation:**
```
WeightedSum = (3+3+2)×1.5 + (3+2+1+2+1)×1.3 + (1)×1.0 = 12.0 + 11.7 + 1.0 = 24.7
PositiveScore = min(1.0, 24.7 / 28.305) = min(1.0, 0.87262) = 0.87262
VicePenalty = 0.05
BaseScore = 0.87262 × (1 - 0.05) = 0.87262 × 0.95 = 0.82899
Streak = 0 + 1 = 1  (0.82899 ≥ 0.65)
StreakBonus = min(1 × 0.01, 0.10) = 0.01
FinalScore = min(1.0, 0.82899 × 1.01) = min(1.0, 0.83728) = 0.83728
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.87262 |
| vicePenalty | 0.05 |
| baseScore | 0.82899 |
| streak | 1 |
| finalScore | 0.83728 |

---

### TV06: Streak at Maximum Bonus (Day 11+)

**Input:**
- Habits: all 13 at max
- Vices: none
- previousStreak = 10, isFirstDay = false

**Calculation:**
```
WeightedSum = 33.3
PositiveScore = 1.0
VicePenalty = 0.0
BaseScore = 1.0
Streak = 10 + 1 = 11
StreakBonus = min(11 × 0.01, 0.10) = min(0.11, 0.10) = 0.10  (capped)
FinalScore = min(1.0, 1.0 × 1.10) = min(1.0, 1.10) = 1.0  (capped at 1.0)
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 1.0 |
| vicePenalty | 0.0 |
| baseScore | 1.0 |
| streak | 11 |
| finalScore | 1.0 |

---

### TV07: Streak Bonus Makes Visible Difference (Not Capped)

**Input:**
- Habits: schoolwork=3, personal_project=3, classes=2, job_search=2, gym=3, sleep_7_9h=2, wake_8am=1, meal_quality=2("Good"), meditate=1, read=1 (10 habits)
- Vices: none
- previousStreak = 9, isFirstDay = false

**Calculation:**
```
WeightedSum = (3+3+2+2)×1.5 + (3+2+1+2)×1.3 + (1+1)×1.0 = 15.0 + 10.4 + 2.0 = 27.4
PositiveScore = min(1.0, 27.4 / 28.305) = min(1.0, 0.96804) = 0.96804
VicePenalty = 0.0
BaseScore = 0.96804
Streak = 9 + 1 = 10
StreakBonus = min(10 × 0.01, 0.10) = 0.10
FinalScore = min(1.0, 0.96804 × 1.10) = min(1.0, 1.06484) = 1.0  (capped)
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.96804 |
| vicePenalty | 0.0 |
| baseScore | 0.96804 |
| streak | 10 |
| finalScore | 1.0 |

**Note:** The streak bonus pushes the score over 1.0, which gets capped. Let me try a lower base to show a visible difference.

---

### TV08: Streak Bonus Visible — Lower Base Score

**Input:**
- Habits: schoolwork=3, personal_project=3, gym=3, sleep_7_9h=2, meal_quality=2("Good"), read=1 (6 habits)
- Vices: none
- previousStreak = 7, isFirstDay = false

**Calculation:**
```
WeightedSum = (3+3)×1.5 + (3+2+2)×1.3 + (1)×1.0 = 9.0 + 9.1 + 1.0 = 19.1
PositiveScore = min(1.0, 19.1 / 28.305) = min(1.0, 0.67494) = 0.67494
VicePenalty = 0.0
BaseScore = 0.67494
Streak = 7 + 1 = 8  (0.67494 ≥ 0.65)
StreakBonus = min(8 × 0.01, 0.10) = 0.08
FinalScore = min(1.0, 0.67494 × 1.08) = min(1.0, 0.72893) = 0.72893
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.67494 |
| vicePenalty | 0.0 |
| baseScore | 0.67494 |
| streak | 8 |
| finalScore | 0.72893 |

---

### TV09: Gap in Tracking — Streak Reset

**Input:**
- Habits: all 13 at max
- Vices: none
- previousStreak = 0 (no daily_log row for yesterday), isFirstDay = false

**Calculation:**
```
WeightedSum = 33.3
PositiveScore = 1.0
VicePenalty = 0.0
BaseScore = 1.0
Streak = 0 + 1 = 1  (gap means previousStreak=0, but today qualifies → 0+1=1)
FinalScore = min(1.0, 1.0 × 1.01) = 1.0
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 1.0 |
| vicePenalty | 0.0 |
| baseScore | 1.0 |
| streak | 1 |
| finalScore | 1.0 |

**Note:** Despite having a 30-day streak before the gap, it resets to 0. Today earns streak = 1 as a fresh start.

---

### TV10: Phone Tiers — Boundary Values

**Sub-case A: phone_use = 60 (below t1)**

```
phone penalty = 0  (60 < 61)
```

**Sub-case B: phone_use = 61 (exactly t1)**

```
phone penalty = 0.03  (61 ≥ 61, but 61 < 181)
```

**Sub-case C: phone_use = 180 (below t2, above t1)**

```
phone penalty = 0.03  (180 ≥ 61, but 180 < 181)
```

**Sub-case D: phone_use = 181 (exactly t2)**

```
phone penalty = 0.07  (181 ≥ 181, but 181 < 301)
```

**Sub-case E: phone_use = 301 (exactly t3)**

```
phone penalty = 0.12  (301 ≥ 301)
```

**Sub-case F: phone_use = 0**

```
phone penalty = 0  (0 < 61)
```

---

### TV11: Porn Per-Instance Scaling and Cap

**Sub-case A: porn = 1**

```
porn penalty = 1 × 0.25 = 0.25
VicePenalty = min(0.40, 0.25) = 0.25
```

**Sub-case B: porn = 2**

```
porn penalty = 2 × 0.25 = 0.50
VicePenalty = min(0.40, 0.50) = 0.40  (capped)
```

**Sub-case C: porn = 0**

```
porn penalty = 0 × 0.25 = 0.0
```

---

### TV12: Multiple Vices Summing to Exactly the Cap

**Input:**
- Habits: any (irrelevant for this test)
- Vices: porn=1(0.25) + weed(0.12) + late_wake(0.03) = 0.40

**Calculation:**
```
VicePenalty = min(0.40, 0.40) = 0.40  (exactly at cap)
```

---

### TV13: Multiple Vices Summing Below Cap

**Input:**
- Vices: skip_class(0.08) + binged_content(0.07) + past_12am(0.05) = 0.20

**Calculation:**
```
VicePenalty = min(0.40, 0.20) = 0.20
```

---

### TV14: Fractional Dropdown — Social = "Brief/Text" (0.5)

**Input:**
- Habits: social = 0.5 ("Brief/Text"), all other habits = 0
- Vices: none
- previousStreak = 0, isFirstDay = false

**Calculation:**
```
WeightedSum = 0.5 × 1.0 = 0.5
PositiveScore = min(1.0, 0.5 / 28.305) = min(1.0, 0.01766) = 0.01766
VicePenalty = 0.0
BaseScore = 0.01766
Streak = 0  (0.01766 < 0.65)
FinalScore = 0.01766
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.01766 |
| vicePenalty | 0.0 |
| baseScore | 0.01766 |
| streak | 0 |
| finalScore | 0.01766 |

---

### TV15: Exact Streak Threshold Boundary

**Input (engineered for baseScore = exactly 0.65):**

We need `PositiveScore × (1 - VicePenalty) = 0.65`.

Let's use: PositiveScore = 0.65, VicePenalty = 0.0.
WeightedSum needed: `0.65 × 28.305 = 18.39825`

Habits: schoolwork=3, personal_project=3, gym=3, sleep_7_9h=2 → WeightedSum = (3+3)×1.5 + (3+2)×1.3 = 9.0 + 6.5 = 15.5. Need 2.89825 more.

Add: read=1 (1.0), social=0.5 (0.5) → 15.5 + 1.0 + 0.5 = 17.0. Still short. Add meditate=1 (1.0) → 18.0. Still short by 0.39825.

This can't be hit exactly with the current habits. Instead, let's verify the boundary behavior with a slightly different approach.

**Approach:** Use a scenario where baseScore is computed to be ≥ 0.65, then separately one where it's < 0.65.

**Sub-case A: BaseScore = 0.65 (qualifies)**
- Vices: none. Need PositiveScore = 0.65 → WeightedSum = 18.398
- This isn't achievable with integer/discrete habit values. The closest whole-value combination will be used. Accept that exact 0.65 isn't achievable with this config — the test demonstrates `≥` behavior with whatever value is closest above.

**Sub-case B: Demonstrating the boundary with vices.**
- Habits: schoolwork=3, personal_project=3, classes=2, gym=3, sleep_7_9h=2, wake_8am=1, meal_quality=3, read=1, meditate=1
- WeightedSum = (3+3+2)×1.5 + (3+2+1+3)×1.3 + (1+1)×1.0 = 12.0 + 11.7 + 2.0 = 25.7
- PositiveScore = min(1.0, 25.7 / 28.305) = 0.90797
- Want BaseScore = 0.65: need VicePenalty such that `0.90797 × (1 - vp) = 0.65` → `vp = 1 - 0.65/0.90797 = 0.28418`
- Closest achievable: porn=1 (0.25) + late_wake (0.03) = 0.28 → BaseScore = 0.90797 × 0.72 = 0.65374 (above threshold ✓)
- Alternatively: porn=1 (0.25) + late_wake (0.03) + past_12am (0.05) = 0.33 → BaseScore = 0.90797 × 0.67 = 0.60834 (below threshold ✗)

**TV15A: Just above threshold**
- previousStreak = 5, isFirstDay = false
- Vices: porn=1, late_wake=1

```
VicePenalty = 0.25 + 0.03 = 0.28
BaseScore = 0.90797 × (1 - 0.28) = 0.90797 × 0.72 = 0.65374
Streak = 5 + 1 = 6  (0.65374 ≥ 0.65 ✓)
StreakBonus = min(6 × 0.01, 0.10) = 0.06
FinalScore = min(1.0, 0.65374 × 1.06) = 0.69296
```

**TV15B: Just below threshold**
- Same habits, previousStreak = 5, isFirstDay = false
- Vices: porn=1, late_wake=1, past_12am=1

```
VicePenalty = 0.25 + 0.03 + 0.05 = 0.33
BaseScore = 0.90797 × (1 - 0.33) = 0.90797 × 0.67 = 0.60834
Streak = 0  (0.60834 < 0.65 ✗)
FinalScore = 0.60834
```

**Note:** One additional vice (past_12am, penalty 0.05) pushes the base score below the streak threshold, breaking a 5-day streak. The difference: TV15A gets 0.69296, TV15B gets 0.60834. The streak break costs ~8.5 percentage points.

---

### TV16: Vice Cap = 0 (Vices Disabled)

**Config override:** `vice_cap = 0.0`

**Input:**
- Habits: schoolwork=3, personal_project=3 (2 habits only)
- Vices: porn=3, weed=1, phone=400

**Calculation:**
```
WeightedSum = (3+3)×1.5 = 9.0
PositiveScore = min(1.0, 9.0 / 28.305) = 0.31800
VicePenalty = min(0.0, anything) = 0.0
BaseScore = 0.31800 × 1.0 = 0.31800
Streak = 0  (0.31800 < 0.65)
FinalScore = 0.31800
```

**Note:** With vice_cap = 0, all vices are ignored.

---

### TV17: Target Fraction = 1.0 (Perfectionist Mode)

**Config override:** `target_fraction = 1.0`

**Input:**
- Habits: all 13 at max
- Vices: none
- previousStreak = 0, isFirstDay = false

**Calculation:**
```
Target = 33.3 × 1.0 = 33.3
PositiveScore = min(1.0, 33.3 / 33.3) = 1.0

With only 10/13 habits (WeightedSum = 27.4):
PositiveScore = min(1.0, 27.4 / 33.3) = 0.82282
```

**Note:** At tf=1.0, you must complete everything to get 100%. At the default tf=0.85, the same 27.4 gives 0.96804 (TV07). The target fraction controls how forgiving the scoring is.

---

### TV18: Realistic Average Day

**Input:**
- Habits: schoolwork=3, classes=2, gym=3, sleep_7_9h=2, supplements=1, meal_quality=1("Okay"), stretching=1, social=1("Casual Hangout")
- Vices: past_12am=1, phone_use=120
- previousStreak = 2, isFirstDay = false

**Calculation:**
```
WeightedSum = (3+2)×1.5 + (3+2+1+1+1)×1.3 + (1)×1.0 = 7.5 + 10.4 + 1.0 = 18.9
PositiveScore = min(1.0, 18.9 / 28.305) = 0.66795
VicePenalty = 0.05 + 0.03 = 0.08  (past_12am + phone t1)
BaseScore = 0.66795 × (1 - 0.08) = 0.66795 × 0.92 = 0.61451
Streak = 0  (0.61451 < 0.65)
FinalScore = 0.61451
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.66795 |
| vicePenalty | 0.08 |
| baseScore | 0.61451 |
| streak | 0 |
| finalScore | 0.61451 |

**Note:** A realistic "okay" day. Completed 8 habits (some partial), two minor vices. Doesn't qualify for streak continuation. This is the kind of day that makes the difference between maintaining momentum and losing it.

---

### TV19: Everything-Goes-Wrong Day (But Cap Preserves Some Score)

**Input:**
- Habits: sleep_7_9h=2, supplements=1 (only 2 habits done)
- Vices: porn=2, weed=1, binged_content=1, gaming_1h=1, past_12am=1, phone_use=350
- previousStreak = 0, isFirstDay = false

**Calculation:**
```
WeightedSum = (2+1)×1.3 = 3.9
PositiveScore = min(1.0, 3.9 / 28.305) = 0.13780
VicePenalty:
    porn: 2 × 0.25 = 0.50
    weed: 0.12
    binged_content: 0.07
    gaming_1h: 0.06
    past_12am: 0.05
    phone t3: 0.12
    total: 0.92
    → min(0.40, 0.92) = 0.40  (capped)
BaseScore = 0.13780 × (1 - 0.40) = 0.13780 × 0.60 = 0.08268
Streak = 0
FinalScore = 0.08268
```

**Expected Output:**
| Field | Value |
|-------|-------|
| positiveScore | 0.13780 |
| vicePenalty | 0.40 |
| baseScore | 0.08268 |
| streak | 0 |
| finalScore | 0.08268 |

**Note:** Even on this terrible day, the two small habits completed (sleep, supplements) still produce a non-zero score. The vice cap ensures 60% of that minimal effort survives. Without the cap, the raw penalty (0.92) would leave only 8% of the positive score → `0.13780 × 0.08 = 0.01102`. The cap is doing real work here.

---

### TV20: Cascade Test — Edit Changes Streak Chain

**Scenario:** Five consecutive days tracked. Day 3 is edited to reduce its base score below the streak threshold.

**Before edit:**

| Day | BaseScore | Streak | FinalScore |
|-----|-----------|--------|------------|
| 1 | 0.80 | 0 (Day 1) | 0.80 |
| 2 | 0.75 | 1 | 0.75 × 1.01 = 0.7575 |
| 3 | 0.70 | 2 | 0.70 × 1.02 = 0.714 |
| 4 | 0.72 | 3 | 0.72 × 1.03 = 0.7416 |
| 5 | 0.68 | 4 | 0.68 × 1.04 = 0.7072 |

**Edit:** Day 3's habits are changed, dropping its base score to 0.60.

**After edit:**

| Day | BaseScore | Streak | FinalScore | Changed? |
|-----|-----------|--------|------------|----------|
| 1 | 0.80 | 0 | 0.80 | No |
| 2 | 0.75 | 1 | 0.7575 | No |
| 3 | **0.60** | **0** | **0.60** | ✓ (recomputed) |
| 4 | 0.72 | **1** | 0.72 × 1.01 = **0.7272** | ✓ (streak chain) |
| 5 | 0.68 | **2** | 0.68 × 1.02 = **0.6936** | ✓ (streak chain) |

**Key observations:**
- Day 3: base score drops, streak breaks (0.60 < 0.65), final score = base score.
- Day 4: streak restarts from 0 → 1 (instead of 3). Final score changes.
- Day 5: streak = 2 (instead of 4). Final score changes.
- The cascade walks Days 4 and 5 because their streak values changed. If Day 6 existed and had a streak-breaking score, the walk would stop there.

---

## 8. Appendix: Seed Data Reference

For test vector validation, the complete habit configuration from DATA_MODEL.md Section 4.

### Good Habits (13)

| Name | Points | Category | Multiplier | MaxWeighted Contribution |
|------|--------|----------|------------|-------------------------|
| schoolwork | 3 | Productivity | 1.5 | 4.5 |
| personal_project | 3 | Productivity | 1.5 | 4.5 |
| classes | 2 | Productivity | 1.5 | 3.0 |
| job_search | 2 | Productivity | 1.5 | 3.0 |
| gym | 3 | Health | 1.3 | 3.9 |
| sleep_7_9h | 2 | Health | 1.3 | 2.6 |
| wake_8am | 1 | Health | 1.3 | 1.3 |
| supplements | 1 | Health | 1.3 | 1.3 |
| meal_quality | 3 | Health | 1.3 | 3.9 |
| stretching | 1 | Health | 1.3 | 1.3 |
| meditate | 1 | Growth | 1.0 | 1.0 |
| read | 1 | Growth | 1.0 | 1.0 |
| social | 2 | Growth | 1.0 | 2.0 |
| **Total** | **25** | | | **33.3** |

### Vices (9)

| Name | Penalty | Mode | Notes |
|------|---------|------|-------|
| porn | 0.25 | per_instance | count × 0.25 |
| masturbate | 0.10 | flat | checkbox |
| weed | 0.12 | flat | checkbox |
| skip_class | 0.08 | flat | checkbox |
| binged_content | 0.07 | flat | checkbox |
| gaming_1h | 0.06 | flat | checkbox |
| past_12am | 0.05 | flat | checkbox |
| late_wake | 0.03 | flat | checkbox |
| phone_use | tiered | tiered | ≥301min→0.12, ≥181min→0.07, ≥61min→0.03 |

### Max Vice Penalty (if all triggered at max)

```
porn(1×0.25) + masturbate(0.10) + weed(0.12) + skip_class(0.08) + binged_content(0.07)
+ gaming_1h(0.06) + past_12am(0.05) + late_wake(0.03) + phone_t3(0.12) = 0.88

Capped at 0.40.
```
