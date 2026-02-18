# ADR-004: Configuration Architecture

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

LTU is config-driven by design — scoring parameters, multipliers, penalties, and dropdown option lists live in `app_config` rather than hardcoded values. This was a deliberate choice to avoid the V1 pattern where constants were scattered across the codebase and changing a penalty required hunting down every reference.

However, "config-driven" is not binary. Not everything that varies is the same *kind* of thing:

- A `vice_cap` of `1.5` is a **bad numeric value** — it would allow vice penalties exceeding 100%, producing negative scores. This is a validation problem.
- A `penalty_mode` of `"quadratic"` is a **bad structural value** — the scoring engine has no branch for it. This is a compiler problem.

Treating both as config-validation problems moves a class of bugs that TypeScript would catch at compile time into JSON where nothing catches them until runtime. The architecture question is where the boundary between these two kinds of configurability belongs.

A secondary question is where `validateConfig()` lives and what happens when it fails.

---

## Options Considered

### Option A: Maximal Config — Everything Possible in `app_config`

Push all variable behavior into config: habit definitions, penalty modes, input types, dropdown category keys, pipeline statuses. The app layer reads config and branches dynamically.

**Genuine advantage:** Adding a habit or dropdown category requires no code change — just a config edit.

**Problems:**
- Config becomes a second programming language. The scoring engine must defensively handle unknown `penalty_mode` strings at runtime.
- Invalid structural values (unknown input type, unknown penalty mode) produce runtime errors in the scoring engine rather than compile-time errors in TypeScript.
- V1 lesson 4 applies in both directions: config-driven design moves bugs *to* data. The goal is to move the *right* bugs to data — ones that `validateConfig()` can catch — not to move all bugs there indiscriminately.

### Option B: Minimal Config — Only Numeric Parameters

Only genuinely runtime-variable values go in `app_config`: multipliers, thresholds, penalties, window sizes. All structural things — penalty modes, input types, pipeline statuses — are TypeScript enums and constants.

**Genuine advantage:** The scoring engine works with typed inputs. Compiler catches invalid structural values.

**Problem:** Changing a habit's input type from checkbox to dropdown requires a code change plus a migration. Settings cannot expose input type as an editable field.

### Option C: Layered — Structural Constants in Code, Behavioral Parameters in Config ← **Selected**

A deliberate boundary between two categories:

- **Structural constants:** Values that the app branches on — penalty modes, input types, pipeline statuses. Defined as TypeScript enums/constants. Validated at compile time. Changing them requires a code change and potentially a migration.
- **Behavioral parameters:** Values that tune behavior within established branches — multipliers, thresholds, penalties, window sizes, dropdown option lists. Stored in `app_config`. Validated at runtime by `validateConfig()`.

---

## Decision

**Option C: Layered configuration architecture.**

The fundamental principle: **if the scoring engine would need a new code branch to handle the value, it is structural, not behavioral.** Structural things belong in TypeScript. Behavioral things belong in `app_config`.

---

## Sub-Decisions

### SD1: Structural Constants — Definition and Location

**Decision:** The following are TypeScript constants/enums, not config values:

| Constant | Type | Values | Location |
|---|---|---|---|
| `PenaltyMode` | enum | `flat`, `per_instance`, `tiered` | `src/types/scoring.ts` |
| `InputType` | enum | `checkbox`, `dropdown`, `number` | `src/types/habits.ts` |
| `HabitCategory` | enum | `Productivity`, `Health`, `Growth` | `src/types/habits.ts` |
| `HabitPool` | enum | `good`, `vice` | `src/types/habits.ts` |
| `ApplicationStatus` | enum | `Applied`, `Phone Screen`, `Interview`, `Offer`, `Rejected`, `Withdrawn`, `No Response` | `src/types/applications.ts` |

**Why `ApplicationStatus` is a constant:** Pipeline statuses are referenced by name across the funnel chart and velocity analytics. Making them dynamic requires runtime guards in every component that touches a status string. The schema complexity (SQLite CHECK constraint → app-layer enforcement, dynamic funnel ordering) is not justified for values that change at most twice a year. **Future candidate for Settings configurability** — if real usage demands new statuses more than twice in V1, build the UI in a subsequent version.

**Why `No Response` is included:** The most common application outcome in practice is silence. Tracking `No Response` explicitly enables funnel analytics to show true conversion rates (Applied → any response), not just the optimistic subset that progressed. `Technical Screen` was considered but deferred — the distinction between a phone screen and a technical screen is meaningful but can be captured in the `notes` field of `status_change` until volume justifies a dedicated status.

**Canonical status list matches `status_change` CHECK constraint in DATA_MODEL.** These must be kept in sync. Adding a status requires updating both this enum and the DATA_MODEL CHECK constraint.

**Invariant:** The scoring engine (`src/engine/scoring.ts`) imports only from `src/types/`. It never reads structural values from `app_config`. If a scoring branch requires a new structural value, that is a code change, not a config change.

### SD2: Behavioral Parameters — What Lives in `app_config`

**Decision:** The following are behavioral parameters stored in `app_config` and editable via Settings:

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `multiplier_productivity` | REAL | 1.5 | Scoring weight for Productivity habits |
| `multiplier_health` | REAL | 1.3 | Scoring weight for Health habits |
| `multiplier_growth` | REAL | 1.0 | Scoring weight for Growth habits |
| `target_fraction` | REAL | 0.85 | Fraction of max weighted score = 100% positive |
| `vice_cap` | REAL | 0.40 | Maximum total vice penalty |
| `streak_threshold` | REAL | 0.65 | Minimum base score to maintain streak |
| `streak_bonus_per_day` | REAL | 0.01 | Per-day streak bonus multiplier |
| `max_streak_bonus` | REAL | 0.10 | Maximum cumulative streak bonus |
| `phone_t1_min` | INTEGER | 61 | Phone tier 1 threshold (minutes) |
| `phone_t2_min` | INTEGER | 181 | Phone tier 2 threshold (minutes) |
| `phone_t3_min` | INTEGER | 301 | Phone tier 3 threshold (minutes) |
| `phone_t1_penalty` | REAL | 0.03 | Vice penalty for tier 1 phone use |
| `phone_t2_penalty` | REAL | 0.07 | Vice penalty for tier 2 phone use |
| `phone_t3_penalty` | REAL | 0.12 | Vice penalty for tier 3 phone use |
| `correlation_window_days` | INTEGER | 90 | Correlation engine lookback window. `0` = all-time |
| `dropdown_options` | JSON | (seed data) | All dropdown option lists for UI rendering |

**Note on `dropdown_options`:** The *keys* of this JSON object (`relapse_triggers`, `urge_techniques`, `study_subjects`, etc.) are structural — referenced by name in app-layer code. Only the *values* (the arrays of option strings within each key) are behavioral. Adding a new dropdown *category* requires a code change. Editing the options within an existing category is pure config.

### SD3: `validateConfig()` — Architecture and Behavior

**Decision:** `validateConfig()` is a pure TypeScript function, the **primary validation gatekeeper** for all `app_config` writes. Database CHECK constraints are a secondary, independent safety net.

**Location:** `src/engine/config-validator.ts`

**Signature:**
```typescript
function validateConfig(config: AppConfig): ValidationResult

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  value: unknown;
  message: string;
}
```

**Behavior:** Pure function — no database access, no side effects. Takes a full `AppConfig` object, returns a result synchronously. Called in the Settings save handler before any database write is attempted.

**Validation rules it must enforce** (minimum — full spec in CONFIG_SCHEMA.md):
- `target_fraction` ∈ (0, 1.0] — zero causes divide-by-zero in positive score calculation
- `vice_cap` ∈ [0, 1.0] — values > 1.0 produce negative base scores
- `streak_threshold` ∈ [0, 1.0]
- `streak_bonus_per_day` ∈ [0, 0.1]
- `max_streak_bonus` ∈ [0, 0.5]
- `multipliers` > 0 (all three)
- `phone_t1_min < phone_t2_min < phone_t3_min` — cross-field validation, cannot be expressed as a SQLite CHECK constraint
- `phone` thresholds ∈ [0, 1440] (minutes in a day)
- `correlation_window_days` ∈ {0, 30, 60, 90, 180, 365} — sentinel 0 = all-time; other values are invalid

**On failure behavior — Hard Block:**
When `validateConfig()` returns `{ valid: false }`, the Settings UI displays inline validation errors per field and does not submit the write. The config is not saved. The database is not touched.

**Rationale for hard block over soft block:** Config values directly feed the scoring engine. A `vice_cap` of `1.5` doesn't just produce a warning — it produces negative base scores silently on every subsequent day until corrected. The user must fix validation errors before saving. There is no "save anyway" path.

**Database CHECK constraints:** `app_config` retains SQLite-expressible CHECK constraints as defense-in-depth. They should agree with `validateConfig()` but exist independently. A write that somehow bypasses the app layer (e.g., direct database editing) will still be rejected at the database level for constrainable fields. Cross-field constraints (phone tier ordering) cannot be expressed in SQLite and are enforced by `validateConfig()` only.

**Testing requirement:** `validateConfig()` must have 100% unit test coverage in Vitest. Each validation rule gets at least one passing test and one failing test. Cross-field rules (phone tier ordering) get tests for all boundary orderings.

---

## Consequences

**What this enables:**
- The scoring engine works with typed inputs only — it never receives an unknown penalty mode or input type. No defensive runtime branching for structural values.
- `validateConfig()` is independently testable without a database or UI — pure function, mock config in, validation result out.
- Invalid config is caught with a user-facing error message before it reaches the database. Silent scoring corruption from bad config is not possible through normal app usage.
- The structural/behavioral boundary is a documented line that future feature additions must consciously cross — adding a new penalty mode is a code change with known implications, not an accidental config edit.

**What this constrains:**
- Adding a new `ApplicationStatus` value requires editing `src/types/applications.ts`, running a migration (to update the CHECK constraint on `status_change.status`), and shipping a new build. It cannot be done in Settings. **This is a deliberate trade-off, not an oversight.** Revisit for V2 if real usage demonstrates the need.
- Adding a new dropdown *category* (e.g., a new relapse trigger dimension) requires a code change to reference the new key, even though the option values within it are config. The key namespace is structural.
- `validateConfig()` must be updated in sync with any change to `app_config` schema. Adding a new parameter without adding a validation rule is a gap — flag this as a code review checklist item.

**What must be specified in CONFIG_SCHEMA.md (Conversation 6):**
- Complete validation rules for every `app_config` field, including valid ranges, types, and inter-field constraints
- `correlation_window_days` valid value set: `{0, 30, 60, 90, 180, 365}`
- Default values for all fields
- What breaks if each field is at its boundary values

---

## References

- `DATA_MODEL.md` — D4 (Config Prospective Only), `app_config` entity definition
- `SCORING_SPEC.md` — DS1 (points as authoritative max), DS2 (multiplicative penalty), DS8 (phone tiers mutually exclusive)
- `ADR-002` — SD1 (config changes prospective only — `validateConfig()` does not affect historical scores)
- `ADR-003` — SD3 (`correlation_window_days` valid value set flagged for CONFIG_SCHEMA.md)
- V1 lesson: *"Config-driven design moves bugs to data — no validation layer on config values. Invalid configs produce silent scoring bugs."*
