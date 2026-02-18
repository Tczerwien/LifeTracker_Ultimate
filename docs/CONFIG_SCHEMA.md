# Life Tracker Ultimate — Configuration Schema

> V2 Rebuild | February 2026  
> Complete validation rules for every configurable parameter.  
> Authoritative reference for `validateConfig()`, `validateHabitConfig()`, and the `app_config` seed row.

---

## Table of Contents

1. [Required DATA_MODEL Patches](#1-required-datamodel-patches)
2. [Scope](#2-scope)
3. [app_config Field Specifications](#3-app_config-field-specifications)
4. [dropdown_options JSON Specification](#4-dropdown_options-json-specification)
5. [habit_config Write Validation](#5-habit_config-write-validation)
6. [validateConfig() Formal Specification](#6-validateconfig-formal-specification)
7. [validateHabitConfig() Formal Specification](#7-validatehabitconfig-formal-specification)
8. [Edge Case Truth Table](#8-edge-case-truth-table)
9. [Testing Requirements](#9-testing-requirements)

---

## 1. Required DATA_MODEL Patches

The DATA_MODEL.md `app_config` CREATE TABLE is missing three fields that are referenced in SCORING_SPEC.md and ADR-003. These must be added before implementation.

### Patch A: `correlation_window_days`

Referenced in ADR-003 (SD2) and ADR-004 (SD3) as an `app_config` field. Not present in the DATA_MODEL CREATE TABLE.

```sql
-- Add to app_config CREATE TABLE, after phone_t3_min block:
correlation_window_days  INTEGER NOT NULL DEFAULT 90
  CHECK(correlation_window_days IN (0, 30, 60, 90, 180, 365)),
```

**Field reference row to add:**

| Field | Type | Nullable | Default | Valid Values | Description |
|-------|------|----------|---------|-------------|-------------|
| `correlation_window_days` | INTEGER | No | `90` | `{0, 30, 60, 90, 180, 365}` | Lookback window for correlation analytics. Sentinel `0` = all-time. No other values are valid. |

**Why `IN (...)` instead of a range CHECK:** The analytics engine branches on these specific values to bucket date ranges. An arbitrary value like `45` does not correspond to a meaningful bucket boundary — it would silently produce a non-standard window that doesn't align with the UI's dropdown options. Constraining to the enum is correct.

---

### Patch B: Phone Tier Penalty Values

SCORING_SPEC Section 4 (Function Contract) expects `phonePenalties: { pt1: number, pt2: number, pt3: number }` as inputs to the scoring engine. Defaults 0.03, 0.07, 0.12 are referenced throughout the spec. These values are not in the DATA_MODEL schema — they must be added to `app_config` as configurable parameters, not hardcoded in the engine. Hardcoding them would contradict the architecture decision that behavioral parameters live in config (ADR-004 SD2).

```sql
-- Add to app_config CREATE TABLE, after phone_t3_min:
phone_t1_penalty  REAL NOT NULL DEFAULT 0.03
  CHECK(phone_t1_penalty >= 0 AND phone_t1_penalty <= 1.0),
phone_t2_penalty  REAL NOT NULL DEFAULT 0.07
  CHECK(phone_t2_penalty >= 0 AND phone_t2_penalty <= 1.0),
phone_t3_penalty  REAL NOT NULL DEFAULT 0.12
  CHECK(phone_t3_penalty >= 0 AND phone_t3_penalty <= 1.0),
```

**Cross-field invariant (app-layer only, not expressible in SQLite):**
`phone_t1_penalty < phone_t2_penalty < phone_t3_penalty`

Tiers must escalate. If t2 ≤ t1, the tiered model produces the wrong penalty for moderate phone use. This is a cross-field validation rule enforced by `validateConfig()`.

**Field reference rows to add:**

| Field | Type | Nullable | Default | Valid Range | Description |
|-------|------|----------|---------|-------------|-------------|
| `phone_t1_penalty` | REAL | No | `0.03` | [0, 1.0] | Vice penalty when phone use ≥ t1 minutes. |
| `phone_t2_penalty` | REAL | No | `0.07` | [0, 1.0] | Vice penalty when phone use ≥ t2 minutes. |
| `phone_t3_penalty` | REAL | No | `0.12` | [0, 1.0] | Vice penalty when phone use ≥ t3 minutes. |

---

## 2. Scope

This document specifies validation rules for:

1. **`app_config`** — all scalar parameters (multipliers, thresholds, windows, phone tiers)
2. **`dropdown_options` JSON** — structure, key inventory, per-key rules
3. **`habit_config` writes** — points, penalties, options_json, cross-field rules
4. **`validateConfig()`** — full function spec for `app_config` writes
5. **`validateHabitConfig()`** — full function spec for `habit_config` writes

**What this document does not cover:**

- `daily_log` field validation (handled at entry time in the UI)
- `relapse_entry` / `urge_entry` validation (handled at entry time)
- `application` / `status_change` validation (handled at entry time)
- Migration procedures (covered in DATA_MODEL.md Section 8)

---

## 3. app_config Field Specifications

### 3.1 Global Rules

- Exactly one row exists with `id = 'default'`. The app never INSERTs a second row.
- `last_modified` is always updated to the current ISO 8601 UTC timestamp when any field changes.
- All writes pass through `validateConfig()` before reaching the database. SQLite CHECK constraints are a secondary safety net — they must agree with `validateConfig()` but exist independently.

---

### 3.2 `start_date`

| Property | Value |
|----------|-------|
| Type | TEXT (ISO date `'YYYY-MM-DD'`) |
| Default | `'2026-01-20'` (seed value — first day of tracking) |
| Nullable | No |
| SQLite CHECK | None (date format not enforced at DB level) |
| Editable | **Read-only once any `daily_log` entry exists** |

**Validation rules:**
- Must be a valid ISO date matching `YYYY-MM-DD` format (regex: `/^\d{4}-\d{2}-\d{2}$/` + date parse check)
- Must not be a future date (`start_date <= today`)
- Must not be later than the oldest existing `daily_log.date` (if any entries exist)
- If any `daily_log` entries exist: **field is not editable**. The Settings UI renders it as read-only informational text. No code path allows a write to this field once data exists.

**What breaks at boundaries:**

| Scenario | Effect |
|----------|--------|
| Future date | Tracking consistency denominator = negative. Analytics break. |
| Later than oldest daily_log entry | Oldest entries appear to predate the configured start. Consistency calculation silently omits them from denominator. |
| Changed after data exists | Retroactively rewrites "miss rate." Prohibited. |

**Rationale for immutability:** `start_date` is the denominator anchor for `days_tracked / days_since_start`. Changing it after data exists is equivalent to editing historical records — it violates the data permanence principle without producing any useful behavior change.

---

### 3.3 Category Multipliers

Three fields: `multiplier_productivity`, `multiplier_health`, `multiplier_growth`

| Property | Value |
|----------|-------|
| Type | REAL |
| Defaults | `1.5`, `1.3`, `1.0` |
| SQLite CHECK | `> 0` |
| Valid Range | `(0, 10.0]` |

**Validation rules:**
- All three must be `> 0`. Zero makes the category invisible to scoring.
- Upper bound `10.0` is a sanity cap. There is no mathematical reason a multiplier can't exceed this, but values above 10 indicate likely data entry error (e.g., typed `15` instead of `1.5`). Warn in UI, hard block above `10.0`.
- Multipliers are independent — no cross-field ordering constraint.

**What breaks at boundaries:**

| Value | Effect |
|-------|--------|
| `= 0` | That category's habits contribute 0 to MaxWeighted. Effectively all habits in that category are worth nothing. Divide-by-zero risk if all categories hit 0 simultaneously. |
| `< 0` | Negative weight. Completing a habit *decreases* positive score. Mathematically produces results but semantically broken. |
| Very large (e.g., `100.0`) | One category dominates. Target fraction calculation still works, but score is nearly binary on that category. Not broken, just unusual. |

---

### 3.4 `target_fraction`

| Property | Value |
|----------|-------|
| Type | REAL |
| Default | `0.85` |
| SQLite CHECK | `target_fraction > 0 AND target_fraction <= 1.0` |
| Valid Range | `(0, 1.0]` |

**Validation rules:**
- Must be `> 0`. Zero produces divide-by-zero in `positiveScore = WeightedSum / (MaxWeighted × tf)`.
- Must be `<= 1.0`. Values above 1.0 make it impossible to reach a positive score of 1.0 even with perfect habits.

**What breaks at boundaries:**

| Value | Effect |
|-------|--------|
| `= 0` | Divide-by-zero. `positiveScore` = `Infinity` or `NaN`. Engine must never receive this value. |
| `> 1.0` | Perfect habit completion produces `positiveScore < 1.0`. Streak threshold may become unreachable if `positiveScore × (1 - vicePenalty) < streak_threshold` even at 100% habits. Mathematically valid but defeats the scoring philosophy. |
| `= 1.0` | Only perfect completion achieves positiveScore = 1.0. Strict mode. Valid. |
| `= 0.5` | Half the weighted score achieves 100% positive. Very lenient. Valid but changes meaning of the score. |

---

### 3.5 `vice_cap`

| Property | Value |
|----------|-------|
| Type | REAL |
| Default | `0.40` |
| SQLite CHECK | `vice_cap >= 0 AND vice_cap <= 1.0` |
| Valid Range | `[0, 1.0]` |

**Validation rules:**
- Must be `>= 0`. Negative cap is nonsensical (would add score for vice activity).
- Must be `<= 1.0`. Values `> 1.0` allow `vicePenalty` to exceed 1.0, making `baseScore = positiveScore × (1 - vicePenalty)` negative. Negative base scores are undefined in the scoring model.

**What breaks at boundaries:**

| Value | Effect |
|-------|--------|
| `= 0` | Vices are disabled. No vice ever penalizes. Equivalent to removing the vice pool. Valid use case. |
| `= 1.0` | A single maximum-penalty vice day can zero out the entire positive score. The cap no longer protects effort. |
| `> 1.0` | **Silent corruption.** `baseScore` goes negative. All subsequent calculations (`streak`, `finalScore`) produce garbage. Hard block required. |

---

### 3.6 `streak_threshold`

| Property | Value |
|----------|-------|
| Type | REAL |
| Default | `0.65` |
| SQLite CHECK | `streak_threshold >= 0 AND streak_threshold <= 1.0` |
| Valid Range | `[0, 1.0]` |

**Validation rules:**
- Must be in `[0, 1.0]`.
- `= 0` means every day qualifies regardless of score. Streak becomes a pure calendar consistency counter.
- `= 1.0` means only days with `baseScore = 1.0` qualify — effectively only perfect days. Combined with multiplicative vice penalty, near-impossible to maintain.

**What breaks at boundaries:**

| Value | Effect |
|-------|--------|
| `= 0` | Streak never resets unless a day is not logged. Trivially maintained. |
| `= 1.0` | Streak resets on any day with any vice or any missed habit. Very strict. |
| `> 1.0` | `baseScore` can never reach `streak_threshold` (max `baseScore` = 1.0). Streak is always 0. Hard block. |

---

### 3.7 `streak_bonus_per_day`

| Property | Value |
|----------|-------|
| Type | REAL |
| Default | `0.01` |
| SQLite CHECK | `streak_bonus_per_day >= 0 AND streak_bonus_per_day <= 0.1` |
| Valid Range | `[0, 0.1]` |

**Validation rules:**
- Must be `>= 0`. Negative bonus penalizes streaks — contradicts design intent.
- Must be `<= 0.1`. Upper bound prevents the streak bonus from becoming the dominant driver of final score. At 0.1/day with a 10-day streak, the bonus already hits `max_streak_bonus`.

**Note:** The `max_streak_bonus` cap means `streak_bonus_per_day` only matters for the ramp-up rate — higher values reach the cap faster. At the default (1%/day, cap 10%), the bonus reaches maximum on day 11.

---

### 3.8 `max_streak_bonus`

| Property | Value |
|----------|-------|
| Type | REAL |
| Default | `0.10` |
| SQLite CHECK | `max_streak_bonus >= 0 AND max_streak_bonus <= 0.5` |
| Valid Range | `[0, 0.5]` |

**Validation rules:**
- Must be `>= 0`. Zero disables streak bonus entirely while still tracking streaks.
- Must be `<= 0.5`. Upper bound prevents final score inflation above 1.5 (50% bonus on a 1.0 base). The `min(1.0, ...)` in the final score formula caps actual output at 1.0, but allowing configs that make the cap always hit would make `streak_bonus_per_day` meaningless.

**Cross-field warning (not a hard block):** If `max_streak_bonus < streak_bonus_per_day`, the streak bonus maxes out on day 1 and `streak_bonus_per_day` becomes meaningless. Emit a validation warning but do not hard block — the math is still valid.

---

### 3.9 Phone Tier Thresholds

Three fields: `phone_t1_min`, `phone_t2_min`, `phone_t3_min`

| Property | Value |
|----------|-------|
| Type | INTEGER |
| Defaults | `61`, `181`, `301` |
| SQLite CHECK | Each `>= 0 AND <= 1440` |
| Valid Range | `[0, 1440]` (minutes in a day) |

**Validation rules:**
- Each must be in `[0, 1440]`.
- **Cross-field invariant:** `phone_t1_min < phone_t2_min < phone_t3_min`. Not expressible in SQLite. Enforced by `validateConfig()` only.

**What breaks at boundaries:**

| Scenario | Effect |
|----------|--------|
| Any tier `= 0` | Any phone use (including 0 minutes) immediately triggers that tier's penalty. |
| `t1 >= t2` | Tier 1 is never reached independently — the engine checks from the top tier down. Depending on the engine's branching logic, t1 might never apply. Semantically broken. |
| `t3 = 1440` | Phone use must be a full 24 hours to trigger tier 3. In practice unreachable. |
| All three equal | Two tiers are effectively dead. All phone use either triggers tier 1 or tier 3 depending on order of checks. |

---

### 3.10 Phone Tier Penalties

Three fields: `phone_t1_penalty`, `phone_t2_penalty`, `phone_t3_penalty`

| Property | Value |
|----------|-------|
| Type | REAL |
| Defaults | `0.03`, `0.07`, `0.12` |
| SQLite CHECK | Each `>= 0 AND <= 1.0` |
| Valid Range | `[0, 1.0]` |

**Validation rules:**
- Each must be in `[0, 1.0]`.
- **Cross-field invariant:** `phone_t1_penalty < phone_t2_penalty < phone_t3_penalty`. Enforced by `validateConfig()`.

**What breaks at boundaries:**

| Scenario | Effect |
|----------|--------|
| Any penalty `= 0` | That tier applies no penalty. Phone use in that range is free. |
| `t1_penalty >= t2_penalty` | Higher phone use penalizes less than moderate use. Inverted incentive. |
| Any penalty `> vice_cap` | That tier alone would exceed the cap. The cap still protects `baseScore`, but effectively there's no incremental cost to being in a higher tier. Warn in UI, do not hard block. |

---

### 3.11 `correlation_window_days`

| Property | Value |
|----------|-------|
| Type | INTEGER |
| Default | `90` |
| SQLite CHECK | `IN (0, 30, 60, 90, 180, 365)` |
| Valid Values | `{0, 30, 60, 90, 180, 365}` |

**Validation rules:**
- Must be exactly one of `{0, 30, 60, 90, 180, 365}`. No other value is valid.
- `0` is the sentinel for "all-time." The analytics engine checks `=== 0` before constructing a date filter.
- This is an enum, not a range — validate with set membership, not comparison operators.

**What breaks at boundaries:**

| Value | Effect |
|-------|--------|
| Any value not in the set | Analytics engine receives an unrecognized window. Depending on implementation, may silently use an arbitrary lookback or throw. Hard block. |
| `0` (all-time) | Correlation engine uses every `daily_log` row. On a large dataset this can be slow but is mathematically correct. |
| `30` | Very short window. Correlation results are noisy and less reliable. Valid but the UI might want to warn the user. |

---

## 4. dropdown_options JSON Specification

### 4.1 Structure

`dropdown_options` is a JSON object stored as TEXT in `app_config`. The shape is:

```typescript
interface DropdownOptions {
  study_subjects:                      string[];
  study_types:                         string[];
  study_locations:                     string[];
  app_sources:                         string[];
  relapse_time_options:                string[];
  relapse_duration_options:            string[];
  relapse_trigger_options:             string[];
  relapse_location_options:            string[];
  relapse_device_options:              string[];
  relapse_activity_before_options:     string[];
  relapse_emotional_state_options:     string[];
  relapse_resistance_technique_options: string[];
  urge_technique_options:              string[];
  urge_duration_options:               string[];
  urge_pass_options:                   string[];
}
```

**Key namespace is structural** (ADR-004 SD2). These 15 keys are referenced by name in app-layer code (form builders, analytics queries). Adding a new key requires a code change. The values (string arrays) are behavioral — editable via Settings.

---

### 4.2 Global Validation Rules for `dropdown_options`

Before any write to `app_config.dropdown_options`, `validateConfig()` must verify:

1. **Valid JSON.** The string parses without error.
2. **All 15 required keys are present.** Missing keys would cause runtime errors in components that read them.
3. **Each value is a non-empty array.** An empty array `[]` would render a dropdown with no options — unacceptable for required fields.
4. **Each array contains at least 2 items.** Single-item dropdowns offer no meaningful choice.
5. **Each array item is a non-empty string.** Empty strings produce blank dropdown entries.
6. **No duplicate values within a single array.** Duplicate options confuse users and complicate analytics deduplication.
7. **Maximum 50 items per array.** Sanity cap. Dropdowns with 50+ options indicate a design problem.
8. **Each option string ≤ 100 characters.** Prevents layout breakage in the UI.
9. **No extra keys beyond the 15.** Unknown keys are silently ignored at runtime, which creates config drift. Hard block on unrecognized keys.

---

### 4.3 Key Inventory and Seed Defaults

#### `study_subjects` — used in `study_session` form
```
["Quantum Computing", "Mobile App Development", "Data Communications",
 "IT Labs", "Networking Labs", "Certs", "Project"]
```
*No special validation beyond global rules.*

#### `study_types` — used in `study_session` form
```
["Self-Study", "Review", "Homework", "Personal-Project", "Lab Work", "Cert Study"]
```

#### `study_locations` — used in `study_session` form
```
["Library", "Home", "Coffee Shop", "Campus", "Other"]
```
**Rule:** Must contain `"Other"` as one option. The `"Other"` catch-all allows logging sessions that don't fit defined categories without blocking entry.

#### `app_sources` — used in `application` entry form
```
["JobRight", "Simplify", "LinkedIn", "Indeed", "Company Site", "Referral", "Other"]
```
**Rule:** Must contain `"Other"`.

#### `relapse_time_options` — used in `relapse_entry` form (`time` field)
```
["Early Morning (3-6am)", "Morning (6-9am)", "Late Morning (9am-12pm)",
 "Afternoon (12-5pm)", "Evening (5-9pm)", "Night (9pm-12am)", "Late Night (12-3am)"]
```
**Rule:** Must contain exactly 7 time buckets covering 24 hours with no gaps and no overlaps. The analytics engine computes aggregate relapse patterns by time-of-day bucket. If buckets don't cover all hours, some relapse_entry timestamps would fall outside all buckets.

*Strict enforcement note:* This rule is hard to validate automatically (would require parsing time ranges from strings). In practice, treat this as a Settings UI constraint: the time options field is read-only in the Settings UI — Thomas cannot edit time bucket strings. They may add/remove buckets but the bucket strings are fixed labels, not free text. If full flexibility is desired, make time-of-day a computed derived field from `relapse_entry.time` rather than a dropdown — flag this as a potential V2 improvement.

**Pragmatic decision for V1:** `relapse_time_options` is **not editable** in the Settings UI. It is presented as informational seed data only. This avoids the validation complexity of enforcing contiguous non-overlapping time coverage. Remove it from the editable dropdown_options surface and hardcode the 7 buckets in the app layer if analytics depend on them.

#### `relapse_duration_options` — used in `relapse_entry` form
```
["< 5 min", "5-15 min", "15-30 min", "30-60 min", "1-2 hours", "2+ hours"]
```

#### `relapse_trigger_options` — used in `relapse_entry` form
```
["Boredom", "Stress", "Loneliness", "Arousal", "Habit/Autopilot",
 "Insomnia", "Anxiety", "Sadness", "Anger", "Rejection", "Celebration"]
```

#### `relapse_location_options` — used in `relapse_entry` form
```
["Bedroom", "Desk/Office", "Bathroom", "Living Room", "Other"]
```
**Rule:** Must contain `"Other"`.

#### `relapse_device_options` — used in `relapse_entry` form
```
["Phone", "Laptop", "Tablet"]
```

#### `relapse_activity_before_options` — used in `relapse_entry` form
```
["Studying", "Scrolling Social Media", "In Bed (Not Sleeping)", "Watching TV/YouTube",
 "Working", "Nothing/Idle", "Browsing Internet", "Gaming", "Other"]
```
**Rule:** Must contain `"Other"`.

#### `relapse_emotional_state_options` — used in `relapse_entry` form
```
["Anxious", "Bored", "Sad", "Angry", "Restless", "Lonely",
 "Tired", "Stressed", "Neutral", "Happy"]
```

#### `relapse_resistance_technique_options` — used in `relapse_entry` form
```
["Left Room", "Exercise", "Called/Texted Someone", "Cold Water", "Meditation",
 "Distraction Activity", "Turned Off Device", "None", "Other"]
```
**Rule:** Must contain `"None"` (to allow logging a relapse where no resistance technique was used).

#### `urge_technique_options` — used in `urge_entry` form
```
["Left Room", "Exercise", "Called/Texted Someone", "Cold Water", "Meditation",
 "Went for Walk", "Journaled", "Push-ups", "Distraction Activity",
 "Turned Off Device", "Deep Breathing", "Other"]
```
**Rule:** Must contain `"Other"`.

#### `urge_duration_options` — used in `urge_entry` form
```
["< 1 min", "1-5 min", "5-15 min", "15-30 min", "30-60 min", "1+ hour"]
```

#### `urge_pass_options` — used in `urge_entry` form
```
["Yes - completely", "Yes - mostly", "Partially", "No (but I resisted anyway)"]
```
**Rule:** Exactly 4 options required. The analytics engine maps these to a 0–3 ordinal scale for urge resistance effectiveness scoring. Changing count or order invalidates historical analytics.

*Strict enforcement note:* Like `relapse_time_options`, `urge_pass_options` has semantic ordering that can't be validated from strings alone. Treat as **not editable** in Settings UI. If Thomas wants different pass options, that is a code change.

---

### 4.4 Editable vs. Read-Only in Settings UI

| Key | Editable in Settings | Reason |
|-----|---------------------|--------|
| `study_subjects` | ✅ Yes | Pure labels, no ordering semantics |
| `study_types` | ✅ Yes | Pure labels |
| `study_locations` | ✅ Yes | Pure labels |
| `app_sources` | ✅ Yes | Pure labels |
| `relapse_duration_options` | ✅ Yes | Pure labels |
| `relapse_trigger_options` | ✅ Yes | Pure labels |
| `relapse_location_options` | ✅ Yes | Pure labels |
| `relapse_device_options` | ✅ Yes | Pure labels |
| `relapse_activity_before_options` | ✅ Yes | Pure labels |
| `relapse_emotional_state_options` | ✅ Yes | Pure labels |
| `relapse_resistance_technique_options` | ✅ Yes | Pure labels (None required) |
| `urge_technique_options` | ✅ Yes | Pure labels |
| `relapse_time_options` | ❌ Read-only | Time bucket semantics; analytics depends on coverage |
| `urge_pass_options` | ❌ Read-only | Ordinal scale semantics; analytics maps to 0–3 |

---

## 5. habit_config Write Validation

### 5.1 Rules Applicable to All Habits

| Field | Rule |
|-------|------|
| `display_name` | Non-empty string. Length 1–50 characters. |
| `sort_order` | INTEGER ≥ 1. Unique within pool (enforced by UI, not DB). |
| `is_active` | Boolean (0 or 1). Retiring the last active good habit is blocked (see DS7 in SCORING_SPEC). |
| `column_name` | Immutable after creation. Never editable via Settings. Changing would require a schema migration. |
| `pool` | Immutable after creation (`'good'` or `'vice'`). |
| `input_type` | Immutable after creation (`'checkbox'`, `'dropdown'`, `'number'`). Changing requires migration of all historical `daily_log` values for that column. |

---

### 5.2 Rules for Good Habits (`pool = 'good'`)

| Field | Rule |
|-------|------|
| `points` | INTEGER ≥ 1. Zero would make the habit contribute nothing to MaxWeighted (invisible to scoring). |
| `penalty` | Must be `0`. Good habits have no penalty. |
| `penalty_mode` | Must be `'flat'`. Informational only for good habits (never applied). |
| `category` | Must be one of `'Productivity'`, `'Health'`, `'Growth'`. NULL not allowed. |
| `options_json` | For `input_type = 'checkbox'`: must be `NULL`. For `input_type = 'dropdown'`: see Section 5.3. |

---

### 5.3 Dropdown `options_json` Validation (Good Habits)

For any good habit with `input_type = 'dropdown'`, `options_json` must satisfy:

1. **Valid JSON object.** Must parse as `Record<string, number>`.
2. **All values are finite numbers ≥ 0.** Negative option values would make completing an option penalize the score.
3. **Exactly one option has value `0`.** The "none/did not do" option. Required so a habit can be marked as not done (contributing 0 to score).
4. **Maximum option value equals `habit_config.points`.** This enforces DS1 (points is the authoritative max). If `max(options_json values) ≠ points`, the Settings UI must auto-sync `points = max(options_json)` before saving (not reject the save).
5. **At least 2 options.** Single option means the dropdown offers no real choice.
6. **At most 10 options.** Sanity cap. More than 10 options on a habit dropdown is an UX problem.
7. **Option keys are non-empty strings, ≤ 50 characters each.**
8. **No duplicate values.** Two options with the same numeric value are semantically identical. Warn but do not hard block.

---

### 5.4 Rules for Vices (`pool = 'vice'`)

| Field | Rule |
|-------|------|
| `points` | Must be `0`. Vices have no positive contribution. |
| `penalty` | REAL in `[0, 1.0]`. For `penalty_mode = 'flat'` or `'per_instance'`. For `penalty_mode = 'tiered'` (phone_use): must be `0` — tier penalty values live in `app_config.phone_t*_penalty`. |
| `penalty_mode` | Must be one of `'flat'`, `'per_instance'`, `'tiered'`. |
| `category` | Must be `NULL`. Vices have no category. |
| `options_json` | Must be `NULL` for all vices. |

**Per-mode penalty rules:**

| `penalty_mode` | `penalty` constraint | Notes |
|----------------|---------------------|-------|
| `flat` | `[0, 1.0]` | Applied once when `val(v) = 1`. |
| `per_instance` | `[0, 1.0]` | Applied once per instance (e.g., `penalty = 0.25`, `val = 3` → contribution = 0.75, before cap). Warn if `penalty × expected_max_instances > vice_cap` — a realistic input can max the cap alone. |
| `tiered` | Must be `0` | Penalties come from `app_config.phone_t*_penalty`. |

**Cross-field validation:**
- Only one vice may have `penalty_mode = 'tiered'` at a time. The tiered penalty logic is wired to `phone_use`. Adding a second tiered vice is not supported without a code change.

---

### 5.5 Retirement Rules

- Good habits may be retired (`is_active = 0`) at any time except when retiring would leave **zero active good habits** in any category that has an active multiplier. If all habits in a category are retired, the category contributes nothing but the multiplier slot still exists — this is allowed. Block only when the total set of active good habits is empty (`MaxWeighted = 0`).
- Vices may be retired at any time. The scoring engine skips inactive vices.
- **Retirement is soft.** Historical `daily_log` rows retain the vice/habit data. The engine excludes inactive habits from current-day scoring (DS9).

---

## 6. validateConfig() Formal Specification

### 6.1 Location and Signature

```typescript
// src/engine/config-validator.ts

function validateConfig(config: AppConfig): ValidationResult;

interface AppConfig {
  id:                          string;
  start_date:                  string;
  multiplier_productivity:     number;
  multiplier_health:           number;
  multiplier_growth:           number;
  target_fraction:             number;
  vice_cap:                    number;
  streak_threshold:            number;
  streak_bonus_per_day:        number;
  max_streak_bonus:            number;
  phone_t1_min:                number;
  phone_t2_min:                number;
  phone_t3_min:                number;
  phone_t1_penalty:            number;
  phone_t2_penalty:            number;
  phone_t3_penalty:            number;
  correlation_window_days:     number;
  dropdown_options:            string;  // JSON string
  last_modified:               string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;         // e.g. "phone_t1_min"
  value: unknown;        // the invalid value provided
  message: string;       // human-readable, suitable for Settings UI display
}
```

**Characteristics:**
- Pure function. No database access. No side effects.
- Synchronous. No async/await.
- Returns `{ valid: true, errors: [] }` when all rules pass.
- Returns `{ valid: false, errors: [...] }` with one error per violated rule (multiple errors can coexist).
- Called by the Settings save handler before any DB write.

---

### 6.2 Validation Rules — Enumerated

#### Single-Field Rules

| # | Field | Rule | Error Message |
|---|-------|------|---------------|
| R01 | `start_date` | Matches `YYYY-MM-DD` and is a valid calendar date | "start_date must be a valid date in YYYY-MM-DD format" |
| R02 | `start_date` | `start_date <= today` | "start_date cannot be a future date" |
| R03 | `multiplier_productivity` | `> 0 AND <= 10.0` | "multiplier_productivity must be between 0 (exclusive) and 10.0 (inclusive)" |
| R04 | `multiplier_health` | `> 0 AND <= 10.0` | "multiplier_health must be between 0 (exclusive) and 10.0 (inclusive)" |
| R05 | `multiplier_growth` | `> 0 AND <= 10.0` | "multiplier_growth must be between 0 (exclusive) and 10.0 (inclusive)" |
| R06 | `target_fraction` | `> 0 AND <= 1.0` | "target_fraction must be greater than 0 and at most 1.0" |
| R07 | `vice_cap` | `>= 0 AND <= 1.0` | "vice_cap must be between 0 and 1.0 inclusive" |
| R08 | `streak_threshold` | `>= 0 AND <= 1.0` | "streak_threshold must be between 0 and 1.0 inclusive" |
| R09 | `streak_bonus_per_day` | `>= 0 AND <= 0.1` | "streak_bonus_per_day must be between 0 and 0.1 inclusive" |
| R10 | `max_streak_bonus` | `>= 0 AND <= 0.5` | "max_streak_bonus must be between 0 and 0.5 inclusive" |
| R11 | `phone_t1_min` | `>= 0 AND <= 1440` | "phone_t1_min must be between 0 and 1440 (minutes in a day)" |
| R12 | `phone_t2_min` | `>= 0 AND <= 1440` | "phone_t2_min must be between 0 and 1440" |
| R13 | `phone_t3_min` | `>= 0 AND <= 1440` | "phone_t3_min must be between 0 and 1440" |
| R14 | `phone_t1_penalty` | `>= 0 AND <= 1.0` | "phone_t1_penalty must be between 0 and 1.0 inclusive" |
| R15 | `phone_t2_penalty` | `>= 0 AND <= 1.0` | "phone_t2_penalty must be between 0 and 1.0 inclusive" |
| R16 | `phone_t3_penalty` | `>= 0 AND <= 1.0` | "phone_t3_penalty must be between 0 and 1.0 inclusive" |
| R17 | `correlation_window_days` | `IN {0, 30, 60, 90, 180, 365}` | "correlation_window_days must be one of: 0, 30, 60, 90, 180, 365" |
| R18 | `dropdown_options` | Parses as valid JSON | "dropdown_options must be valid JSON" |
| R19 | `dropdown_options` | Contains all 15 required keys | "dropdown_options missing required key: {key}" |
| R20 | `dropdown_options` | Each key maps to a non-empty array | "dropdown_options.{key} must be a non-empty array" |
| R21 | `dropdown_options` | Each array has ≥ 2 items | "dropdown_options.{key} must contain at least 2 options" |
| R22 | `dropdown_options` | Each array has ≤ 50 items | "dropdown_options.{key} cannot exceed 50 options" |
| R23 | `dropdown_options` | Each item is a non-empty string ≤ 100 chars | "dropdown_options.{key}[{i}] must be a non-empty string of at most 100 characters" |
| R24 | `dropdown_options` | No duplicate values within any array | "dropdown_options.{key} contains duplicate option: '{value}'" |
| R25 | `dropdown_options` | No extra keys beyond the 15 required | "dropdown_options contains unrecognized key: {key}" |

#### Cross-Field Rules

| # | Fields | Rule | Error Message |
|---|--------|------|---------------|
| R26 | `phone_t1_min`, `phone_t2_min` | `phone_t1_min < phone_t2_min` | "phone_t1_min must be less than phone_t2_min" |
| R27 | `phone_t2_min`, `phone_t3_min` | `phone_t2_min < phone_t3_min` | "phone_t2_min must be less than phone_t3_min" |
| R28 | `phone_t1_penalty`, `phone_t2_penalty` | `phone_t1_penalty < phone_t2_penalty` | "phone_t1_penalty must be less than phone_t2_penalty (tiers must escalate)" |
| R29 | `phone_t2_penalty`, `phone_t3_penalty` | `phone_t2_penalty < phone_t3_penalty` | "phone_t2_penalty must be less than phone_t3_penalty (tiers must escalate)" |

#### Warnings (non-blocking — returned in a separate `warnings` array)

| # | Fields | Condition | Warning Message |
|---|--------|-----------|-----------------|
| W01 | `max_streak_bonus`, `streak_bonus_per_day` | `max_streak_bonus < streak_bonus_per_day` | "max_streak_bonus is less than streak_bonus_per_day — the bonus cap will be hit on day 1" |
| W02 | `phone_t*_penalty`, `vice_cap` | Any single tier penalty ≥ `vice_cap` | "phone_t{n}_penalty equals or exceeds vice_cap — phone use alone will max the cap" |

Add `warnings: ValidationWarning[]` to `ValidationResult`. Warnings do not set `valid = false`.

---

### 6.3 Failure Behavior

When `validateConfig()` returns `{ valid: false }`:
- Settings UI displays inline validation errors below the offending field(s).
- The save button remains disabled until all errors are resolved.
- No database write is attempted.
- There is no "save anyway" override path.

When `validateConfig()` returns `{ valid: true, warnings: [...] }`:
- Settings UI displays inline warnings with yellow styling (not blocking).
- The save button is enabled.
- The user may proceed.

---

## 7. validateHabitConfig() Formal Specification

### 7.1 Signature

```typescript
// src/engine/config-validator.ts

function validateHabitConfig(
  habit: HabitConfigInput,
  context: HabitValidationContext
): ValidationResult;

interface HabitConfigInput {
  display_name:  string;
  pool:          'good' | 'vice';
  category:      'Productivity' | 'Health' | 'Growth' | null;
  input_type:    'checkbox' | 'dropdown' | 'number';
  points:        number;
  penalty:       number;
  penalty_mode:  'flat' | 'per_instance' | 'tiered';
  options_json:  string | null;
  sort_order:    number;
  is_active:     0 | 1;
}

interface HabitValidationContext {
  activeGoodHabitCount:  number;  // current count of active good habits (excluding this one if editing)
  tieredViceCount:       number;  // current count of vices with penalty_mode = 'tiered'
  isNew:                 boolean; // true for creates, false for edits
}
```

---

### 7.2 Validation Rules

| # | Condition | Field(s) | Rule | Error |
|---|-----------|----------|------|-------|
| H01 | Always | `display_name` | Non-empty, length 1–50 | "display_name must be 1–50 characters" |
| H02 | Always | `sort_order` | INTEGER ≥ 1 | "sort_order must be a positive integer" |
| H03 | `pool = 'good'` | `category` | Not null. Must be `Productivity`, `Health`, or `Growth` | "Good habits must have a category" |
| H04 | `pool = 'good'` | `points` | INTEGER ≥ 1 | "Good habit points must be at least 1" |
| H05 | `pool = 'good'` | `penalty` | Must be 0 | "Good habits cannot have a penalty" |
| H06 | `pool = 'vice'` | `category` | Must be null | "Vices cannot have a category" |
| H07 | `pool = 'vice'` | `points` | Must be 0 | "Vices cannot contribute positive points" |
| H08 | `pool = 'vice'`, `penalty_mode != 'tiered'` | `penalty` | REAL in `[0, 1.0]` | "penalty must be between 0 and 1.0" |
| H09 | `pool = 'vice'`, `penalty_mode = 'tiered'` | `penalty` | Must be 0 | "Tiered vices use app_config phone penalty values; habit penalty must be 0" |
| H10 | `input_type = 'checkbox'` | `options_json` | Must be null | "Checkbox habits cannot have options_json" |
| H11 | `input_type = 'dropdown'`, `pool = 'good'` | `options_json` | Must be non-null, valid JSON object | "Dropdown habits require options_json" |
| H12 | `input_type = 'dropdown'` | `options_json` | All values are numbers ≥ 0 | "options_json values must be non-negative numbers" |
| H13 | `input_type = 'dropdown'` | `options_json` | Exactly one value = 0 | "options_json must contain exactly one option with value 0" |
| H14 | `input_type = 'dropdown'` | `options_json`, `points` | `max(values) = points` (auto-sync, not error) | Auto-sync: set `points = max(options_json values)` before writing |
| H15 | `input_type = 'dropdown'` | `options_json` | At least 2 options | "Dropdown habits must have at least 2 options" |
| H16 | `input_type = 'dropdown'` | `options_json` | At most 10 options | "Dropdown habits cannot exceed 10 options" |
| H17 | `input_type = 'dropdown'` | `options_json` keys | Non-empty strings ≤ 50 chars | "Option labels must be 1–50 characters" |
| H18 | `pool = 'vice'`, `penalty_mode = 'tiered'` | context | `tieredViceCount = 0` (for new) or `= 1` (for edits of the existing tiered vice) | "Only one tiered vice is supported. phone_use is already tiered." |
| H19 | `is_active = 0` | context | `activeGoodHabitCount > 1` when `pool = 'good'` | "Cannot retire the last active good habit" |

---

## 8. Edge Case Truth Table

### app_config Boundary Inputs

| # | Input | Rule Triggered | `valid` | Error |
|---|-------|---------------|---------|-------|
| 1 | `target_fraction = 0` | R06 | false | target_fraction must be > 0 |
| 2 | `target_fraction = 0.001` | R06 | true | — (pathological but valid) |
| 3 | `target_fraction = 1.001` | R06 | false | target_fraction must be ≤ 1.0 |
| 4 | `vice_cap = 1.0` | R07 | true | — (extreme but valid) |
| 5 | `vice_cap = 1.01` | R07 | false | vice_cap must be ≤ 1.0 |
| 6 | `vice_cap = -0.01` | R07 | false | vice_cap must be ≥ 0 |
| 7 | `streak_threshold = 1.0` | R08 | true | — |
| 8 | `streak_threshold = 1.01` | R08 | false | — |
| 9 | `streak_bonus_per_day = 0.1` | R09 | true | — |
| 10 | `streak_bonus_per_day = 0.101` | R09 | false | — |
| 11 | `max_streak_bonus = 0.5` | R10 | true | — |
| 12 | `max_streak_bonus = 0.51` | R10 | false | — |
| 13 | `phone_t1_min = 0` | R11 | true | — (any use triggers tier 1) |
| 14 | `phone_t1_min = 1441` | R11 | false | — |
| 15 | `phone_t1_min = 100, phone_t2_min = 100` | R26 | false | t1 must be < t2 |
| 16 | `phone_t1_min = 100, phone_t2_min = 99` | R26 | false | t1 must be < t2 |
| 17 | `phone_t1_penalty = 0.07, phone_t2_penalty = 0.07` | R28 | false | tiers must escalate |
| 18 | `phone_t1_penalty = 0.08, phone_t2_penalty = 0.07` | R28 | false | tiers must escalate |
| 19 | `correlation_window_days = 45` | R17 | false | must be one of {0,30,60,90,180,365} |
| 20 | `correlation_window_days = 0` | R17 | true | — (sentinel: all-time) |
| 21 | `correlation_window_days = 365` | R17 | true | — |
| 22 | `dropdown_options = "{}"` | R19 | false | missing required keys |
| 23 | `dropdown_options = "not json"` | R18 | false | must be valid JSON |
| 24 | `dropdown_options.study_subjects = []` | R20/R21 | false | must have ≥ 2 items |
| 25 | `dropdown_options.study_subjects = ["A"]` | R21 | false | must have ≥ 2 items |
| 26 | `dropdown_options` has extra key `"foo"` | R25 | false | unrecognized key |
| 27 | `max_streak_bonus=0.005, streak_bonus_per_day=0.01` | W01 | true (warning) | bonus hits cap on day 1 |
| 28 | `phone_t1_penalty = 0.40, vice_cap = 0.40` | W02 | true (warning) | tier alone maxes cap |
| 29 | `start_date = "2026-13-01"` | R01 | false | invalid date |
| 30 | `start_date = "2027-01-01"` | R02 | false | future date |

### habit_config Boundary Inputs

| # | Input | Rule | `valid` | Note |
|---|-------|------|---------|------|
| 31 | Good habit, `points = 0` | H04 | false | invisible to scoring |
| 32 | Good habit, `penalty = 0.1` | H05 | false | good habits have no penalty |
| 33 | Vice, `points = 1` | H07 | false | vices add no positive score |
| 34 | Vice, `penalty_mode = 'tiered'`, second tiered vice | H18 | false | only one tiered vice |
| 35 | Dropdown, `options_json = {"Good":1, "Great":2}` | H13 | false | no option with value 0 |
| 36 | Dropdown, `options_json = {"None":0}` | H15 | false | only 1 option |
| 37 | Dropdown, `options_json = {"None":0,"Good":2}`, `points = 3` | H14 | auto-sync | points set to 2 |
| 38 | Retire last active good habit | H19 | false | cannot retire last habit |
| 39 | Vice, `penalty_mode = 'tiered'`, `penalty = 0.05` | H09 | false | tiered vice penalty must be 0 |
| 40 | Good habit, `category = null` | H03 | false | must have category |

---

## 9. Testing Requirements

### validateConfig() — 100% Rule Coverage

For each rule R01–R29 (and W01–W02):
- **One passing test:** Input that satisfies the rule.
- **One failing test:** Input that violates the rule. For ranges, test `value - ε` and `value + ε` at each boundary.
- **For cross-field rules (R26–R29):** Test all boundary orderings (equal, one less, one greater).

**Minimum test count:** 58 tests for R01–R29 (2 per rule) + 4 tests for cross-field orderings = **62 minimum tests**.

### validateHabitConfig() — 100% Rule Coverage

- One passing + one failing test per rule H01–H19.
- Minimum: 38 tests.

### File: `src/engine/__tests__/config-validator.test.ts`

```typescript
// Structure:
describe('validateConfig', () => {
  describe('single-field rules', () => { /* R01–R25 */ });
  describe('cross-field rules', () => { /* R26–R29 */ });
  describe('warnings', () => { /* W01–W02 */ });
  describe('valid full config', () => { /* pass-through test with seed defaults */ });
});

describe('validateHabitConfig', () => {
  describe('good habit rules', () => { /* H01–H06, H10–H17, H19 */ });
  describe('vice rules', () => { /* H07–H09, H18 */ });
});
```

**Golden test — seed config must pass:**
The `app_config` seed row with all defaults must return `{ valid: true, errors: [], warnings: [] }`. This test catches regressions where validation rules become stricter than the defaults.

---

## References

- `DATA_MODEL.md` — Section 3.10 (`app_config` schema), D4 (prospective-only changes)
- `SCORING_SPEC.md` — DS1 (points as authoritative max), DS7 (zero MaxWeighted guard), DS8 (phone tiers mutually exclusive), DS10 (engine trusts inputs)
- `ADR-002` — Score computation model, why scores are frozen
- `ADR-003` — `correlation_window_days` valid value set
- `ADR-004` — Config architecture, structural vs behavioral boundary, `validateConfig()` placement
- V1 Lesson 4: *"Config-driven design moves bugs to data — no validation layer on config values. Invalid configs produce silent scoring bugs."*
