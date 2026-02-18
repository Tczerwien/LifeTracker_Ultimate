# Life Tracker Ultimate — Coding Roadmap for Claude Code

> **Purpose:** This document defines the build order and prompt-splitting strategy for implementing LTU V2. Each phase produces testable, working code. Dependencies flow strictly forward — no phase references unbuilt components.

> **How to use this:** Each **Phase** is a major milestone. Each **Step** within a phase is roughly one Claude Code prompt session. Steps within a phase are sequential (each builds on the previous). Phases with no cross-dependencies can overlap.

---

## Dependency Graph (Read This First)

```
Phase 1: Project Scaffold
    ↓
Phase 2: TypeScript Types & Constants ──────────────────────┐
    ↓                                                        │
Phase 3: Scoring Engine (pure TS functions, no DB)             │
    ↓                                                        │
Phase 3.5: Correlation Engine (pure TS function)             │
    ↓                                                        │
Phase 4: Config Validator (pure functions, no DB)            │
    ↓                                                        │
Phase 5: Tauri Backend + SQLite ←────────────────────────────┘
    ↓
Phase 5.5: Port Scoring Engine to Rust
    ↓
Phase 6: Data Access Layer (Tauri IPC Commands)
    ↓
Phase 7: Frontend Foundation (React shell, routing, state)
    ↓
Phase 8: Daily Log Page (core loop)
    ↓
Phase 9: Journal Page
    ↓
Phase 10: Study Log & App Log Pages ──── (can be parallel)
    ↓
Phase 11: Recovery Pages (Urge + Relapse)
    ↓
Phase 12: Weekly Review Page
    ↓
Phase 13: Analytics Dashboard
    ↓
Phase 14: Settings Page
    ↓
Phase 15: Data Management (Export/Import/Backup)
    ↓
Phase 16: Milestones & Polish
    ↓
Phase 17: Integration Testing & Bug Fixes
```

**Key insight:** Phases 3 and 4 are pure TypeScript with zero dependencies on Tauri, React, or the database. Build and fully test them first. This is where the hardest logic lives, and catching bugs here is 10x cheaper than catching them in the UI.

---

## Phase 1: Project Scaffold

**Goal:** Empty Tauri + React + TypeScript project that builds and launches a window.

### Step 1.1: Initialize Tauri Project
- Create the project using `create-tauri-app` (Vite + React + TypeScript template)
- Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`
- Install core dependencies: `tailwindcss`, `recharts`, `@tanstack/react-query`, `zustand`
- Install dev dependencies: `vitest`, `@testing-library/react`
- Configure Tailwind CSS
- Verify: `npm run dev` opens a Tauri window, `npm run test` runs (even with 0 tests)

### Step 1.2: Project Structure
- Create the folder skeleton (no implementation files yet):
```
src/
  types/           # TypeScript types and enums
  engine/          # Pure business logic (scoring, validation, correlation)
  db/
    migrations/    # Numbered SQL files
  commands/        # Tauri IPC command handlers (Rust)
  hooks/           # TanStack Query hooks
  stores/          # Zustand stores
  components/
    shared/        # Reusable UI components
    daily-log/
    journal/
    analytics/
    study/
    apps/
    recovery/
    review/
    settings/
  pages/           # Top-level route components
  lib/             # Utilities (date formatting, score color, etc.)
src-tauri/
  src/
    commands/      # Rust IPC handlers
    db/            # SQLite connection, migration runner
```
- Add a placeholder `App.tsx` with "Life Tracker Ultimate" text
- Verify: project still builds

**Output:** A running Tauri app with the correct folder structure and all dependencies installed.

---

## Phase 2: TypeScript Types & Constants

**Goal:** Every type, enum, and interface the app will use — defined once, imported everywhere. This is the contract that all subsequent code is built against.

### Step 2.1: Enums and Structural Constants
Define in `src/types/enums.ts`:
- `HabitPool` enum: `Good`, `Vice`
- `HabitCategory` enum: `Productivity`, `Health`, `Growth`
- `InputType` enum: `Checkbox`, `Dropdown`, `Number`
- `PenaltyMode` enum: `Flat`, `PerInstance`, `Tiered`
- `ApplicationStatus` enum: `Applied`, `PhoneScreen`, `Interview`, `TechnicalScreen`, `Offer`, `Rejected`, `Withdrawn`, `NoResponse`
- `CorrelationWindow` type: `0 | 30 | 60 | 90 | 180 | 365`

Define category multiplier mapping and design tokens as constants in `src/lib/constants.ts`:
- Default config values (all seed values from CONFIG_SCHEMA.md)
- Category colors (Productivity=#3D85C6, Health=#6AA84F, Growth=#8E7CC3, Vice=#CC4125)
- Score gradient breakpoints
- Streak gold color

### Step 2.2: Data Model Interfaces
Define in `src/types/models.ts` (one interface per DB table):
- `HabitConfig` — all fields from habit_config table
- `DailyLog` — all fields including computed scores
- `Journal` — all fields
- `StudySession` — all fields
- `Application` — all fields
- `StatusChange` — all fields
- `RelapseEntry` — all fields
- `UrgeEntry` — all fields
- `WeeklyReview` — all fields including snapshot
- `AppConfig` — all fields (this is the big one — every scoring parameter)
- `Milestone` — all fields

### Step 2.3: Engine I/O Types
Define in `src/types/engine.ts`:
- `ScoringInput` — the resolved numeric values the scoring engine receives (not raw DB rows)
  - `habitValues: { name: string; value: number; points: number; category: HabitCategory }[]`
  - `viceValues: { name: string; triggered: boolean; count?: number; penaltyValue?: number; penaltyMode: PenaltyMode }[]`
  - `phoneMinutes: number`
  - `previousStreak: number`
  - `config: ScoringConfig`
- `ScoringConfig` — the config subset the engine needs (multipliers, target_fraction, vice_cap, streak params, phone tiers)
- `ScoringOutput` — `{ positiveScore, vicePenalty, baseScore, streak, finalScore }`
- `ValidationResult` — `{ valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[] }`
- `ValidationError` — `{ field: string; rule: string; message: string; value: unknown }`
- `CorrelationResult` — `{ habit: string; r: number; pValue?: number; n: number; flag?: string }`

### Step 2.4: Dropdown Option Types
Define in `src/types/options.ts`:
- Type for the `dropdown_options` JSON structure (15 required keys)
- Seed data: all default dropdown values from CONFIG_SCHEMA.md
- Type guard: `isValidDropdownOptions(obj: unknown): obj is DropdownOptions`

**Output:** Complete type system. No runtime code yet. All subsequent phases import from here.

**Verification:** `tsc --noEmit` passes with zero errors.

---

## Phase 3: Scoring Engine

**Goal:** Pure TypeScript functions that compute all 5 daily scores. 100% test coverage. Zero dependencies on Tauri, React, or any DB.

**Why this is separate from the DB:** The scoring engine is the mathematical heart of the app. It must be a pure function: values in, scores out. If it's entangled with DB queries or React state, testing becomes fragile and bugs become invisible.

### Step 3.1: Core Scoring Function
Implement in `src/engine/scoring.ts`:
- `computeScores(input: ScoringInput): ScoringOutput`
- Internal helpers:
  - `computeMaxWeighted(habits, config)` → sum of (points × category multiplier) for active habits
  - `computePositiveScore(habits, maxWeighted, targetFraction)` → clamped [0, 1]
  - `computeVicePenalty(vices, phoneMinutes, phoneTiers, viceCap)` → clamped [0, viceCap]
  - `computeBaseScore(positiveScore, vicePenalty)` → positiveScore × (1 - vicePenalty)
  - `computeStreak(baseScore, streakThreshold, previousStreak)` → integer ≥ 0
  - `computeFinalScore(baseScore, streak, streakBonusPerDay, maxStreakBonus)` → clamped [0, 1]
- Guard: if maxWeighted = 0, positiveScore = 0 (DS7, divide-by-zero prevention)
- Phone tier logic: tiered penalty, mutually exclusive (DS8), highest qualifying tier wins

### Step 3.2: Scoring Engine Tests (20 Test Vectors)
Implement in `src/engine/__tests__/scoring.test.ts`:
- All 20 test vectors from SCORING_SPEC.md (TV01–TV20), each as a named test
- Each test constructs a `ScoringInput` and asserts exact `ScoringOutput` values (to 3 decimal places)
- Edge cases from truth table: E1–E23
- Boundary tests: phone at exactly 60, 61, 180, 181, 300, 301
- Config extremes: vice_cap=0, target_fraction=1.0, all habits retired
- **TV20 (cascade):** Test the cascade helper separately (Step 3.3)

### Step 3.3: Edit Cascade Logic
Implement in `src/engine/cascade.ts`:
- `computeCascade(editedDate: string, allLogs: DailyLogRow[], config: ScoringConfig): CascadeUpdate[]`
- Input: the edited date, all daily_log rows from that date forward, current config
- Output: array of `{ date, streak, finalScore }` updates to apply
- Logic:
  1. Recompute all 5 scores for the edited day
  2. Walk forward day by day: recompute streak + finalScore only
  3. Stop when recomputed values match stored values (convergence)
- Tests: TV20 scenario + gap days + convergence after 1 day + no change needed

**Output:** `scoring.ts`, `cascade.ts`, and comprehensive test files. All tests pass. `npm run test` green.

---

## Phase 3.5: Correlation Engine

**Goal:** Pure TypeScript Pearson's r computation. Per ADR-003 SD2, this stays in TypeScript (not Rust) because it's unmaintainable in SQL and doesn't need transactional guarantees.

### Step 3.5.1: Correlation Function
Implement in `src/engine/correlation.ts`:
- `computeCorrelations(logs: DailyLogRow[], habitConfigs: HabitConfig[]): CorrelationResult[]`
- Input: array of daily log rows (pre-fetched by Rust IPC command), habit configs for active habits
- Output: sorted array of `{ habit, r, pValue, n, flag? }` — sorted by |r| descending
- Pearson's r formula: standard implementation
- Edge cases:
  - Zero-variance habit (always checked or never checked): r = 0, not NaN
  - Insufficient data (< 7 data points): r = null, flag = "insufficient_data"
  - Retired habits: excluded from computation (filtered by `is_active`)
  - All habits retired: return empty array

### Step 3.5.2: Correlation Engine Tests
Implement in `src/engine/__tests__/correlation.test.ts`:
- Known-answer tests: construct data with known Pearson's r, verify output
- Zero-variance: habit always 1 → r = 0
- Insufficient data: 3 entries → null r with flag
- Perfect positive correlation (r = 1.0): habit = 1 on high-score days, 0 on low
- Perfect negative correlation (r = -1.0): vice always present on low-score days
- Mixed data: 30+ realistic entries, verify r within expected range
- Empty input: returns empty array
- Retired habits excluded: pass retired habits in config, verify they're absent from output

**Output:** `correlation.ts` and test file. All tests pass.

---

## Phase 4: Config Validator

**Goal:** Pure TypeScript validation for `AppConfig` and `HabitConfig`. 100% test coverage.

### Step 4.1: App Config Validator
Implement in `src/engine/config-validator.ts`:
- `validateConfig(config: AppConfig): ValidationResult`
- Single-field rules (R01–R17 from CONFIG_SCHEMA.md):
  - `start_date`: valid ISO date, ≤ today
  - `multiplier_*`: > 0, ≤ 10.0
  - `target_fraction`: > 0, ≤ 1.0
  - `vice_cap`: ≥ 0, ≤ 1.0
  - `streak_threshold`: ≥ 0, ≤ 1.0
  - `streak_bonus_per_day`: ≥ 0, ≤ 0.1
  - `max_streak_bonus`: ≥ 0, ≤ 0.5
  - `phone_t*_min`: ≥ 0, ≤ 1440
  - `phone_t*_penalty`: ≥ 0, ≤ 1.0
  - `correlation_window_days`: must be in {0, 30, 60, 90, 180, 365}
- Cross-field rules:
  - Phone tiers ascending: t1 < t2 < t3 (thresholds)
  - Phone penalties ascending: pt1 < pt2 < pt3
- Warnings (non-blocking):
  - `max_streak_bonus < streak_bonus_per_day`
  - Any phone penalty ≥ vice_cap

### Step 4.2: Dropdown Options Validator
Implement in `src/engine/config-validator.ts` (same file):
- `validateDropdownOptions(options: unknown): ValidationResult`
- All 15 required keys present
- Each array: ≥ 2 items, ≤ 50 items, no empties, no duplicates, each item ≤ 100 chars
- Read-only keys (`relapse_time_options`, `urge_pass_options`) have exact expected values

### Step 4.3: Habit Config Validator
Implement in `src/engine/habit-validator.ts`:
- `validateHabitConfig(habit: HabitConfig, allHabits: HabitConfig[]): ValidationResult`
- Good habit rules (H01–H10):
  - points ≥ 1, penalty = 0, category required
  - Dropdown: options_json valid, values ≥ 0, exactly one = 0, max(values) = points, 2–10 options
  - Cannot retire last active good habit
- Vice rules (H11–H19):
  - points = 0, penalty ∈ [0, 1.0] for flat/per_instance
  - Tiered: penalty = 0 on the habit (penalties come from phone config)
  - Only one tiered vice allowed at a time
  - options_json = null

### Step 4.4: Validator Tests
Implement in `src/engine/__tests__/config-validator.test.ts` and `habit-validator.test.ts`:
- 62+ tests for config validator (2 per rule + golden seed test)
- 38+ tests for habit validator (2 per rule)
- Golden test: seed config from CONFIG_SCHEMA.md must pass all rules
- Boundary tests: values at exact limits (0, 1.0, 1440, etc.)
- Cross-field tests: phone tiers out of order, equal values

**Output:** Fully tested validation layer. Zero DB dependencies. `npm run test` green.

---

## Phase 5: Tauri Backend + SQLite

**Goal:** Rust backend with SQLite connection, migration system, and initial schema. The app launches, creates the DB file, and runs migrations.

### Step 5.1: Tauri SQLite Setup
- Add `tauri-plugin-sql` to Cargo dependencies
- Configure DB file location: `app_data_dir()/ltu.db` (per ADR-001 SD1)
- Create connection initialization in `src-tauri/src/db/mod.rs`
- Wire into Tauri's `setup` hook
- Verify: app launches, `ltu.db` file created at correct OS-specific path

### Step 5.2: Migration System
- Create `schema_migrations` table (version INTEGER, applied_at TEXT)
- Implement migration runner: reads `src/db/migrations/*.sql`, applies in order within transaction
- Migration runner checks highest applied version, applies only newer migrations
- Verify: migration runner logs applied migrations on startup

### Step 5.3: Initial Schema Migration (001)
Write `001_initial_schema.sql`:
- All 11 tables from DATA_MODEL.md with exact column types, CHECK constraints, defaults
- `habit_config` with all seed data (13 good habits + 9 vices)
- `app_config` singleton row with all seed values
- `milestone` with all ~20 seed rows
- All indexes from DATA_MODEL.md (date columns, FKs, filter columns)
- `schema_migrations` table

This is a large SQL file. Key tables:
- `daily_log`: one column per habit, 5 computed score columns, date as PK
- `journal`: date PK, mood/energy integers, text fields
- `study_session`: auto-increment PK, date + time fields
- `application`: auto-increment PK, all job tracking fields
- `status_change`: auto-increment PK, FK to application (ON DELETE RESTRICT)
- `relapse_entry`: auto-increment PK, all incident fields
- `urge_entry`: auto-increment PK, all tracking fields
- `weekly_review`: week_start_date PK, snapshot JSON, auto-computed stats
- `app_config`: id='default' PK, all scoring params
- `habit_config`: auto-increment PK, name unique, all metadata
- `milestone`: text PK, achievement state

### Step 5.4: Backup System
Implement in Rust (`src-tauri/src/db/backup.rs`):
- On app launch: copy `ltu.db` → `backups/ltu_YYYY-MM-DD_HH-MM.db`
- Rolling 7-copy retention: delete oldest beyond 7
- If backup fails: log warning, continue launch (never block startup)
- Verify: launch app 8+ times, confirm only 7 backups exist

**Output:** Tauri app launches, creates DB with full schema and seed data, backs up on startup.

---

## Phase 5.5: Port Scoring Engine to Rust

**Goal:** Re-implement the scoring engine in Rust so the edit cascade runs atomically within a single SQLite transaction. The TypeScript version (Phase 3) becomes the reference implementation for test vector validation.

**Why this matters:** The cascade (edit → recompute 5 scores → walk streak chain forward) must be atomic. If scoring lives in TypeScript, the cascade requires multiple IPC round-trips that can't be wrapped in one transaction. A crash mid-cascade would leave streaks in an inconsistent state.

### Step 5.5.1: Rust Scoring Functions
Port to `src-tauri/src/engine/scoring.rs`:
- `compute_scores(input: ScoringInput) -> ScoringOutput` — direct port of TS `computeScores()`
- All internal helpers: `compute_max_weighted`, `compute_positive_score`, `compute_vice_penalty`, `compute_base_score`, `compute_streak`, `compute_final_score`
- Same guard clauses: maxWeighted=0, vice_cap clamping, finalScore capped at 1.0
- Phone tier logic: identical to TS version

### Step 5.5.2: Rust Cascade Function
Port to `src-tauri/src/engine/cascade.rs`:
- `compute_cascade(edited_date, daily_logs, config) -> Vec<CascadeUpdate>`
- Same convergence logic as TS version
- Runs within a single SQLite transaction (BEGIN → compute → UPDATE multiple rows → COMMIT)

### Step 5.5.3: Rust Scoring Tests
- Port all 20 test vectors from `scoring.test.ts` to Rust `#[test]` functions
- Values must match to 3 decimal places (identical to TS assertions)
- Cascade test vectors from Phase 3.3 ported as well
- **This is the critical cross-validation:** if any test vector produces a different result in Rust vs TS, there's a bug that must be resolved before proceeding

**Output:** Rust scoring engine passing all 20 test vectors identically to the TypeScript version.

---

## Phase 6: Data Access Layer (Tauri IPC Commands)

**Goal:** Rust commands that the React frontend calls via `invoke()`. Each command is a clean IPC boundary: TypeScript calls Rust, Rust queries/writes SQLite, returns typed results.

### Step 6.1: Daily Log Commands
Implement Tauri commands:
- `get_daily_log(date: String) → Option<DailyLog>` — fetch single day
- `get_daily_logs(start: String, end: String) → Vec<DailyLog>` — date range query
- `save_daily_log(entry: DailyLogInput) → ()` — upsert + score computation + cascade
  - This is the most complex command: receives habit/vice values, calls scoring engine, writes scores, runs cascade within single transaction
  - **Critical:** The scoring engine (Phase 3) must be callable from Rust. Two options:
    - **Option A:** Port scoring to Rust (duplicates logic, keeps cascade atomic)
    - **Option B:** Keep scoring in TS, call via IPC round-trip (simpler but cascade isn't atomic in one transaction)
  - **Recommended: Option A** — port scoring to Rust for atomicity. The TS version becomes the reference implementation for tests.
- `get_streak_at_date(date: String) → i32` — needed for cascade lookups

### Step 6.2: Journal Commands
- `get_journal(date: String) → Option<Journal>`
- `save_journal(entry: JournalInput) → ()`
- No cascade — journal has no scoring interaction

### Step 6.3: Study Session Commands
- `get_study_sessions(date: String) → Vec<StudySession>` — by date
- `get_study_sessions_range(start: String, end: String) → Vec<StudySession>` — date range
- `save_study_session(session: StudySessionInput) → ()`
- `update_study_session(id: i64, session: StudySessionInput) → ()`
- `delete_study_session(id: i64) → ()`

### Step 6.4: Application & Status Commands
- `get_applications(filters: AppFilters) → Vec<Application>` — with status/search filters
- `get_application(id: i64) → Option<Application>`
- `save_application(app: ApplicationInput) → ()`
- `update_application(id: i64, app: ApplicationInput) → ()`
- `archive_application(id: i64) → ()` — soft delete (set archived=1)
- `add_status_change(app_id: i64, status: StatusChangeInput) → ()` — append-only, updates denormalized current_status
- `get_status_history(app_id: i64) → Vec<StatusChange>`

### Step 6.5: Recovery Commands (Relapse + Urge)
- `get_relapse_entries(date: String) → Vec<RelapseEntry>`
- `save_relapse_entry(entry: RelapseEntryInput) → ()`
- `update_relapse_entry(id: i64, entry: RelapseEntryInput) → Result<(), String>` — checks 24h window
- `get_urge_entries(date: String) → Vec<UrgeEntry>`
- `save_urge_entry(entry: UrgeEntryInput) → ()`
- `update_urge_entry(id: i64, entry: UrgeEntryInput) → Result<(), String>` — checks 24h window
- 24-hour lock enforcement: Rust checks `NOW - created_at > 24h`, returns error if locked

### Step 6.6: Config & Settings Commands
- `get_config() → AppConfig`
- `save_config(config: AppConfigInput) → Result<(), ValidationErrors>` — validates before write
- `get_habit_configs() → Vec<HabitConfig>`
- `save_habit_config(habit: HabitConfigInput) → Result<(), ValidationErrors>`
- `retire_habit(id: i64) → Result<(), String>` — sets retired_at, checks not-last-active
- `reorder_habits(ids: Vec<i64>) → ()` — bulk update sort_order

### Step 6.7: Weekly Review Commands
- `get_weekly_review(week_start: String) → Option<WeeklyReview>`
- `compute_weekly_stats(week_start: String) → WeeklyStats` — live computation (not saved)
- `save_weekly_review(review: WeeklyReviewInput) → ()` — freezes snapshot

### Step 6.8: Analytics Queries
- `get_score_trend(start: String, end: String) → Vec<ScoreTrendPoint>` — date, finalScore, 7-day MA
- `get_habit_completion_rates(start: String, end: String) → Vec<HabitCompletionRate>`
- `get_vice_frequency(start: String, end: String) → Vec<ViceFrequency>`
- `get_day_of_week_averages(start: String, end: String) → Vec<DayOfWeekAvg>`
- `get_correlation_data(start: String, end: String) → Vec<DailyLogRow>` — raw data for TS correlation engine
- `get_study_summary(start: String, end: String) → StudySummary`
- `get_application_pipeline() → PipelineSummary` — funnel counts by status
- `get_recovery_frequency(start: String, end: String) → RecoveryFrequency`

### Step 6.9: Milestone Commands
- `get_milestones() → Vec<Milestone>` — all milestones with achievement state
- `check_milestones(context: MilestoneContext) → Vec<Milestone>` — checks all milestone conditions, returns newly achieved milestones
  - Called after: `save_daily_log` (score/streak/clean milestones), `save_weekly_review` (study/tracking milestones), `save_application` (application milestones)
  - `MilestoneContext` includes: current streak, total days tracked, total study hours, total applications, consecutive clean days, score trends
- Milestone achievement is a one-way flip: `achieved` 0→1, `achieved_date` set, never reversed

### Step 6.10: Data Management Commands
- `export_data() → String` — JSON export (self-describing with config + habit_config + _meta block)
- `import_data(json: String) → Result<(), String>` — validates JSON structure and schema version, overwrites within transaction, rollback on error
- `get_db_stats() → DbStats` — file size, record counts per table
- `get_db_path() → String` — for Settings UI display
- `backup_now(destination: String) → Result<String, String>` — manual backup to user-selected location via OS file picker, returns path of created backup

**Output:** Complete IPC layer. Every DB operation accessible from TypeScript via `invoke()`.

---

## Phase 7: Frontend Foundation

**Goal:** React app shell with routing, sidebar navigation, TanStack Query setup, Zustand store, and shared components.

### Step 7.1: TanStack Query + Zustand Setup
- Create `src/lib/query-keys.ts`: centralized query key constants per ADR-005 SD3:
  - `QUERY_KEYS.dailyLog(date)` → `['daily-log', date]`
  - `QUERY_KEYS.dailyLogList` → `['daily-log', 'list']`
  - `QUERY_KEYS.journal(date)` → `['journal', date]`
  - `QUERY_KEYS.scoreTrend` → `['score-trend']`
  - `QUERY_KEYS.streakHistory` → `['streak-history']`
  - `QUERY_KEYS.habitCompletionRates` → `['habit-completion-rates']`
  - `QUERY_KEYS.correlationData` → `['correlation-data']`
  - `QUERY_KEYS.studySessions(date)` → `['study-sessions', date]`
  - `QUERY_KEYS.applications` → `['applications']`
  - `QUERY_KEYS.relapseEntries(date)` → `['relapse-entries', date]`
  - `QUERY_KEYS.urgeEntries(date)` → `['urge-entries', date]`
  - `QUERY_KEYS.weeklyReview(weekStart)` → `['weekly-review', weekStart]`
  - `QUERY_KEYS.config` → `['config']`
  - `QUERY_KEYS.habitConfigs` → `['habit-configs']`
  - `QUERY_KEYS.milestones` → `['milestones']`
- Configure `QueryClient` with global defaults (per ADR-005):
  - `staleTime: Infinity`
  - `refetchOnWindowFocus: false`
  - `refetchOnMount: false`
  - `retry: 1`
- Create Zustand store (`src/stores/ui-store.ts`):
  - `selectedDate: string` (YYYY-MM-DD, defaults to today)
  - `sidebarOpen: boolean`
  - `activeAnalyticsSection: string | null`
  - `analyticsWindow: '7d' | '30d' | '90d' | 'all'` (default '30d')
  - Actions: `setSelectedDate`, `toggleSidebar`, `setActiveAnalyticsSection`, `setAnalyticsWindow`

### Step 7.2: App Shell & Routing
- Implement sidebar layout (240px fixed sidebar + flex content area)
- Set up React Router with all routes:
  - `/` → Daily Log
  - `/journal` → Journal
  - `/analytics` → Analytics
  - `/study` → Study Log
  - `/apps` → App Log
  - `/review` → Weekly Review
  - `/settings` → Settings
  - `/recovery/urge` → Urge Log
  - `/recovery/relapse` → Relapse Log
- Sidebar navigation with primary/secondary/recovery grouping per UI_SPEC
- Active route highlighting
- Design tokens: apply Tailwind theme (colors, spacing, typography from UI_SPEC)

### Step 7.3: Shared Components (Batch 1 — Used Everywhere)
- `DateNavigator`: ← date → arrows, clickable center date opens `DatePicker`, drives `selectedDate` in Zustand
- `DatePicker`: calendar popup for date selection (use a lightweight library like `react-day-picker` or build custom). Opens on click, closes on selection or outside click. Constrains selectable range to `start_date` through today.
- `ScoreGradient`: utility function `scoreColor(value: number): string` → red→amber→green (0.0=#CC4125, 0.5=#FFD966, 1.0=#6AA84F)
- `ScoreStrip`: displays 5 KPI values (Final, Base, Streak, Pos%, Vice%) with gradient coloring
- `DotRating`: 1–N clickable dot input. Visual states: filled dots up to selected value, empty after. Click to select, keyboard left/right to adjust. Used by: Journal (mood 1–5, energy 1–5), Study Log (focus 1–5), Recovery (intensity 1–10, effectiveness 1–5)
- `Toast`: brief success notification (auto-dismiss after 3s). Variant for milestone achievement: shows emoji + milestone name
- `ConfirmDialog`: modal confirmation dialog (used for: delete, unsaved changes, archive, overwrite import)

### Step 7.4: Shared Components (Batch 2 — Used by Specific Pages)
- `EmptyStateCard`: threshold-gated placeholder ("Need N more days for this chart")
- `ExpandableRow`: click to expand/collapse content (App Log)
- `InlineForm`: expands in-place for data entry (Study Log, App Log)
- `StepperInput`: [−] N [+] counter (vice counts)
- `StatusBadge`: color-coded status pill with status-to-color mapping

### Step 7.5: TanStack Query Hooks
Create custom hooks in `src/hooks/` that wrap `invoke()` calls:
- `useDailyLog(date)` — query key: `['daily-log', date]`
- `useJournal(date)` — query key: `['journal', date]`
- `useStudySessions(date)` — query key: `['study-sessions', date]`
- `useApplications(filters)` — query key: `['applications', filters]`
- `useConfig()` — query key: `['config']`
- `useHabitConfigs()` — query key: `['habit-configs']`
- Mutation hooks with proper invalidation patterns per ADR-005 SD3:
  - `useSaveDailyLog()` → invalidates: daily-log, score-trend, streak-history, habit-completion-rates, correlation-data
  - `useSaveJournal()` → invalidates: journal
  - etc. (each mutation invalidates only its relevant query keys)

**Output:** Navigable app shell with sidebar, all routes rendering placeholder pages, shared components built, TanStack Query + Zustand wired up.

---

## Phase 8: Daily Log Page (Core Loop)

**Goal:** The most important page. Toggle habits, see score update. This is the 30-second nightly ritual.

### Step 8.1: Daily Log Layout
- Date navigator at top (shared component)
- Score strip below date (5 KPIs, updating in real-time)
- Three habit sections: Productivity, Health, Growth (collapsible, category-colored headers)
- Vice section below habits

### Step 8.2: Habit Input Components
- Checkbox habits: click to toggle, green background when checked
- Dropdown habits (meal_quality, social): dropdown selector with options from config
- Each habit shows: display name, points (muted), current value
- Category multiplier shown in section header

### Step 8.3: Vice Input Components
- Checkbox vices: click to toggle, red background when active
- Number input (porn): StepperInput component, count × penalty displayed
- Phone minutes: number input with tier indicator (shows current tier + penalty)
- Each vice shows: display name, penalty value, current state

### Step 8.4: Real-Time Score Computation
- On any habit/vice change: immediately call `save_daily_log` mutation
- Mutation returns updated scores → TanStack Query updates ScoreStrip
- No explicit "Save" button — auto-save on every change (DU1 from UI_SPEC)
- Debounce rapid changes (e.g., phone minutes typing): 300ms debounce on number inputs

### Step 8.5: Previous Day Editing
- Date navigator allows selecting any past date
- Loading state while fetching that day's data
- Editing past day triggers cascade (handled by backend)
- Visual indicator when viewing a past date (not today)

**Output:** Fully functional daily logging with real-time score updates.

---

## Phase 9: Journal Page

**Goal:** Mood, energy, and four text fields with explicit save.

### Step 9.1: Journal Form
- Date display (from Zustand `selectedDate`, no independent navigator — DU2)
- Mood: DotRating (1–5)
- Energy: DotRating (1–5)
- Four textareas: Highlight, Gratitude, Reflection, Tomorrow's Goal
- Explicit "Save" button (partial saves prevented)
- Unsaved changes detection: warn on navigation away (ConfirmDialog)

### Step 9.2: Journal Data Binding
- `useJournal(selectedDate)` hook for loading
- `useSaveJournal()` mutation
- Empty state when no entry exists for selected date
- Loading/error states

**Output:** Working journal page with save/load.

---

## Phase 10: Study Log & App Log Pages

**Goal:** Two data entry pages for occasional use (not daily). These are independent of each other and can be built in parallel if splitting across sessions.

### Step 10.1: Study Log — Session List
- Week navigator (independent of selectedDate)
- Week stats header: total hours, session count, average focus
- Sessions table: date, subject, type, duration, focus score
- Sortable columns

### Step 10.2: Study Log — Add/Edit Session
- InlineForm component: expands on "+ Add Session" click
- Fields: date (default today), subject (dropdown from config), type (dropdown), start time, end time, focus (DotRating 1–5), location (dropdown), topic, resources, notes
- Duration auto-calculated from start/end times
- Edit: click existing row to expand inline edit form
- Delete with confirmation

### Step 10.3: App Log — Application List
- Filter bar: status filter (multi-select), search (fulltext on company/role)
- Sort options: date applied, company, status
- ExpandableRow for each application: summary row shows company, role, status badge, date
- Expanded view: full details + status history timeline

### Step 10.4: App Log — Add Application & Status Updates
- "+ Add Application" opens InlineForm
- Fields: company, role, source (dropdown from config), URL, notes, follow_up_date, salary, contact info, login credentials
- Within expanded row: "Add Status Update" button → inline status change form
- Status history: chronological list of status changes with dates and notes
- Archive button (soft delete) with confirmation

**Output:** Both pages functional with full CRUD.

---

## Phase 11: Recovery Pages (Urge + Relapse)

**Goal:** Event-driven logging for urges and relapses. Form-heavy, with 24-hour edit window.

### Step 11.1: Urge Log Page
- Form fields: time (default now), intensity (DotRating 1–10), trigger (free text), duration (dropdown), technique (dropdown from config), effectiveness (DotRating 1–5), did_pass (dropdown), notes
- On submit: success toast, form clears, stay on page
- Below form: recent urge entries list (last 7 days)
- Edit button visible only within 24h of created_at (disappears after)

### Step 11.2: Relapse Log Page
- Form fields: date (default today), time (default now), duration (dropdown), trigger (dropdown from config), location (dropdown), device (dropdown), activity_before (dropdown), emotional_state (dropdown), resistance_technique (dropdown), urge_intensity (DotRating 1–10), link-to-urge (dropdown of today's urge entries), notes
- On submit: success toast, form clears, stay on page
- Below form: recent relapse entries (last 7 days)
- Edit button with 24h window enforcement
- All dropdowns populated from `dropdown_options` in config

### Step 11.3: 24-Hour Edit Window UI
- Edit button rendered only when `NOW - created_at < 24h`
- Click opens entry in edit form (same form, pre-populated)
- On save: `last_modified` updated, `created_at` unchanged
- Backend enforces window as secondary guard (returns error if locked)

**Output:** Both recovery pages with full logging and edit window.

---

## Phase 12: Weekly Review Page

**Goal:** Sunday reflection ritual. Auto-computed stats + manual reflection + snapshot freeze.

### Step 12.1: Weekly Review Layout
- Week navigator (Monday-keyed)
- Two-column layout: left = auto-computed stats, right = reflection fields
- Auto-computed stats (live until saved):
  - Average score, days tracked, best/worst day scores
  - Habits completed, study hours, applications sent
  - Relapses count, urges resisted, streak at end of week
- Reflection fields: biggest win, biggest challenge, next week goal, free reflection

### Step 12.2: Snapshot Logic
- "Save Snapshot" button: freezes all stats into `weekly_review` row
- Score snapshot: JSON array of 7 final_score values
- Once saved: shows snapshot timestamp
- Divergence warning: if live scores differ from snapshot (due to post-save edits), show indicator
- Stats computed live (from daily_log queries) until explicit save

**Output:** Weekly review with live stats and snapshot freeze.

---

## Phase 13: Analytics Dashboard

**Goal:** The data analysis surface. Four sections, lazy-loaded, with window selector.

### Step 13.1: Analytics Shell
- Window selector: 7d / 30d / 90d / All time (driven by Zustand `analyticsWindow`)
- Four collapsible sections with sticky headers
- Lazy loading: each section queries independently on render/expand (ADR-003 SD1)
- Empty state cards with data-driven thresholds:
  - Score trends: require ≥ 7 log entries for 7d, ≥ 14 for 30d
  - Correlation engine: require ≥ 30 entries (Pearson's r meaningless below this)
  - Day-of-week patterns: require ≥ 4 weeks of data (28 entries)
  - Study/Application records: require ≥ 1 entry
- Each section hook checks data sufficiency before rendering charts

### Step 13.2: Overview Section
- KPI cards: average score (with gradient), current streak, days tracked, longest streak
- Habit completion bar chart (Recharts): horizontal bars, one per habit, colored by category
- Completion rate = days completed / days tracked

### Step 13.3: Trends Section
- Score trend line chart: daily finalScore + 7-day moving average overlay
- Day-of-week heatmap: average score by day of week (Mon–Sun)
- Vice frequency over time: stacked area or line chart showing vice occurrence trends

### Step 13.4: Correlations Section
- Wire the correlation engine (already built and tested in Phase 3.5) to the analytics UI:
  - Fetch raw `DailyLogRow[]` from `get_correlation_data()` IPC command
  - Pass to `computeCorrelations()` from `src/engine/correlation.ts`
  - Correlation window: reads `config.correlation_window_days` (0=all-time, or 30/60/90/180/365)
- Display: sorted table of habit × r value, colored by correlation strength
- Top 3 positive and top 3 negative correlators highlighted in summary cards
- Insufficient data state: show EmptyStateCard if < 30 entries in window

### Step 13.5: Records Section
- Study hours by subject: horizontal bar chart (Recharts BarChart), colored by subject
- Application pipeline: funnel/horizontal stacked bar (Applied → Phone Screen → Interview → Offer, with Rejected/Withdrawn/No Response shown separately)
- Recovery frequency: dual-line chart (relapses and urges as separate lines, weekly granularity), aggregate counts only — no individual entry details visible in analytics (UI_SPEC.md constraint)

**Output:** Full analytics dashboard with four lazy-loaded sections.

---

## Phase 14: Settings Page

**Goal:** Tabbed settings for all configurable parameters.

### Step 14.1: Settings Shell + General Tab
- Tabbed layout: General, Scoring, Habits, Vices, Data
- General tab: app name (display only), start date (read-only if data exists), DB file path (read-only + "Open folder" button)

### Step 14.2: Scoring Tab
- Multiplier inputs: Productivity, Health, Growth (with validation feedback)
- Target fraction, vice cap, streak threshold
- Streak bonus per day, max streak bonus
- Phone tier thresholds (3 fields) and penalties (3 fields)
- Cross-field validation shown in real-time (tiers must be ascending)
- Save button: runs `validateConfig()` → blocks on error, shows warnings

### Step 14.3: Habits Tab
- Table of active good habits: name, display name, category, input type, points, sort order
- Inline editing for each habit
- "+ Add Habit" form
- Drag handle for reordering (updates sort_order)
- "Retire" button (with confirmation, blocked if last active)
- For dropdown habits: edit options (values + labels)

### Step 14.4: Vices Tab
- Table of active vices: name, display name, penalty, penalty mode
- Inline editing for penalty values
- Dropdown option management: all 15 dropdown lists from config
  - Editable lists: add/remove/reorder items
  - Read-only lists: display only, no edit controls

### Step 14.5: Data Tab
- DB stats: file size, record counts per table
- Export JSON button → OS file picker → self-describing JSON export
- Import JSON button → OS file picker → validation → overwrite confirmation → import
- Manual backup button (copies DB file to user-selected location)

**Output:** Full settings page with validated config editing and data management.

---

## Phase 15: Data Management (Export/Import/Backup)

**Goal:** The data durability features that V1 lacked. JSON export for LLM analysis, import for restore, backup system already built in Phase 5.

### Step 15.1: JSON Export
- Implement in Rust: serializes all tables + app_config + habit_config + `_meta` block
- `_meta` includes: export timestamp, schema version, row counts per table
- User selects save location via OS file picker (Tauri dialog)
- Progress indicator for large exports

### Step 15.2: JSON Import
- Implement in Rust: validates JSON structure, checks schema version compatibility
- Import flow: select file → validate → show diff summary (row counts) → confirm overwrite → import within transaction
- Rollback on any error during import
- After import: clear all TanStack Query cache, reload

### Step 15.3: Manual Backup
- "Backup Now" button in Settings → Data tab
- Copies current `ltu.db` to user-selected location via OS file picker
- Shows backup size and timestamp on completion

**Output:** Complete data lifecycle: export, import, backup.

---

## Phase 16: Milestones & Polish

**Goal:** Achievement system + UI polish + edge case handling.

### Step 16.1: Milestone Detection
- Implement milestone checking logic:
  - After each `save_daily_log`: check score milestones, streak milestones, clean day milestones
  - After weekly review save: check study hour milestones, tracking milestones
  - After application save: check application milestones
- Mark milestone as achieved (one-way flip), set achieved_date
- Show toast notification when milestone newly achieved

### Step 16.2: Milestone Display
- Milestone panel: grid of achievements with emoji, name, achieved status
- Achieved: full color + date. Unachieved: grayed out + threshold description
- Accessible from sidebar or as a section on the Daily Log page

### Step 16.3: UI Polish
- Loading states for all data-fetching pages
- Error states with retry buttons
- Empty states with helpful messaging
- Responsive behavior (minimum viable — sidebar collapse on narrow screens)
- Keyboard navigation for the daily log (tab through habits)
- Focus management for inline forms

### Step 16.4: Edge Case Handling
- First launch experience: no data exists yet, guide user through first daily log
- Gap days: date navigator shows visual indicator for missing days
- Midnight crossing: study sessions that cross midnight display correctly
- Very long streaks (100+ days): score strip handles large numbers gracefully

**Output:** Polished, production-ready UI with achievements.

---

## Phase 17: Integration Testing & Bug Fixes

**Goal:** End-to-end verification that the full stack works together.

### Step 17.1: Critical Path Integration Tests
- Test the core loop end-to-end: launch app → log habits → see score → change habit → see score update → close and reopen → data persists
- Test cascade: edit a past day → verify streak chain updates correctly
- Test config change: modify multiplier → verify future scores change, past scores don't
- Test backup: launch app → verify backup created → verify rolling retention

### Step 17.2: Data Integrity Tests
- Export → wipe DB → import → verify all data matches (field-by-field comparison of random record subset, handle timestamp rounding)
- Concurrent rapid edits: toggle habits quickly, verify no lost writes
- 24-hour window: create relapse entry → mock time past 24h → verify edit blocked at both UI (no button) and Rust command level (returns error)
- Weekly review snapshot: save review → edit past day's score → verify snapshot JSON unchanged, live stats show different values, divergence warning appears
- Cascade edge cases: edit day at end of history (no forward walk needed), edit causing gap day streak break, very long streak (50+ days) with mid-streak edit
- Milestone integrity: achieve a milestone → verify achieved_date set → verify it's never reversed even if conditions no longer hold

### Step 17.3: Scoring Engine Cross-Validation
- For every test vector: create the scenario through the UI → verify the scores shown match the expected test vector values
- This catches any disconnect between the TS reference implementation and the Rust scoring engine

### Step 17.4: Test Data Generation & Performance
- Create a test data generator script (`scripts/generate-test-data.ts`):
  - Generates 365 days of realistic daily_log entries (varying habits, vices, scores)
  - Generates corresponding journal entries, study sessions, applications, relapse/urge entries
  - Seeds via Tauri IPC commands or direct SQLite insertion
- Performance benchmarking:
  - Analytics queries on 365+ days: must respond < 200ms
  - Score trend with 7-day MA: profile and optimize if needed
  - Correlation engine on 365 entries: measure computation time
  - If any query exceeds threshold: add indexes, optimize SQL, or implement pagination

### Step 17.5: Bug Fix Pass
- Address any issues found during integration testing and performance benchmarking
- Verify all error states surface correctly (not swallowed silently)
- Verify all loading states render correctly (no blank screens during data fetch)
- Final pass through all 20 test vectors via UI to confirm Rust/TS parity

**Output:** Verified, working application ready for daily use.

---

## Prompt Engineering Notes for Claude Code

### General Principles

1. **One step per prompt.** Each step above is roughly one prompt. Don't combine steps from different phases.

2. **Always provide context.** Each prompt should reference the relevant spec documents. Claude Code won't remember previous sessions. Start each prompt with: "I'm building Life Tracker Ultimate. Here are the relevant specs: [paste relevant section]."

3. **Paste types, not prose.** When Claude Code needs to implement something that depends on types from Phase 2, paste the actual TypeScript interfaces, not a prose description. Types are unambiguous; prose is not.

4. **Test-first when possible.** For Phases 3 and 4, consider giving Claude Code the test vectors first and asking it to implement the functions that make them pass. This produces higher-quality code than "implement this spec."

5. **Don't skip the Rust question.** Phase 6.1 has a critical architectural choice: does the scoring engine live in Rust or TypeScript? The recommendation is Rust for atomicity, but this means the logic exists in two languages. Decide this before starting Phase 6.

### Prompt Sizing

- **Small prompts (1 step):** Types, shared components, individual pages
- **Medium prompts (2–3 steps):** Scoring engine + tests, config validator + tests
- **Never combine:** Frontend + backend in the same prompt. They're different languages and different mental models.

### What to Include in Every Prompt

1. The relevant type definitions (from Phase 2 output)
2. The specific spec section being implemented
3. The file paths where code should go
4. What "done" looks like (tests pass, component renders, command returns correct shape)
5. Any design decisions (DS#, D#, DU#) that affect the implementation

### What NOT to Include

1. The entire spec (too much context dilutes focus)
2. Future phase details (creates temptation to over-engineer)
3. Multiple languages in one prompt (keep Rust and TypeScript separate)

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scoring engine Rust/TS divergence | Silently different scores | Cross-validation in Phase 17.3 |
| Schema migration breaks on update | Data loss | Migration runs in transaction, rollback on error |
| TanStack Query cache staleness | Stale UI after mutations | Explicit invalidation per ADR-005 SD3 |
| Phone tier logic off-by-one | Wrong penalties | Boundary tests in Phase 3.2 (60, 61, 180, 181, etc.) |
| Config change retroactive | Unexpected score changes | Prospective-only enforcement (ADR-002 SD1) |
| Large analytics queries slow | Bad UX | Lazy loading + limit to 365 days default window |
| Import overwrites good data | Data loss | Confirmation dialog + backup before import |

---

## Estimated Effort (Claude Code Sessions)

| Phase | Steps | Est. Sessions | Notes |
|-------|-------|---------------|-------|
| 1. Scaffold | 2 | 1–2 | Straightforward setup |
| 2. Types | 4 | 2–3 | Dense but mechanical |
| 3. Scoring Engine | 3 | 3–4 | Most complex logic, extensive tests |
| 3.5. Correlation Engine | 2 | 1–2 | Pure function + tests |
| 4. Config Validator | 4 | 3–4 | Many rules, many tests |
| 5. Tauri Backend | 4 | 3–4 | Rust + SQL, schema is large |
| 5.5. Rust Scoring Port | 3 | 2–3 | Port + cross-validate 20 test vectors |
| 6. Data Access | 10 | 7–9 | Many commands, many entity types |
| 7. Frontend Foundation | 5 | 4–5 | Shell, routing, components, hooks |
| 8. Daily Log | 5 | 3–4 | Core page, real-time updates |
| 9. Journal | 2 | 1–2 | Simple page |
| 10. Study + Apps | 4 | 3–4 | Two pages, CRUD-heavy |
| 11. Recovery | 3 | 2–3 | Form-heavy, 24h window |
| 12. Weekly Review | 2 | 2 | Stats + snapshot logic |
| 13. Analytics | 5 | 4–5 | Charts, wiring correlation engine |
| 14. Settings | 5 | 4–5 | Tabs, validation UI, config CRUD |
| 15. Data Management | 3 | 2–3 | Export/Import/Backup |
| 16. Milestones + Polish | 4 | 3–4 | Achievements, edge cases |
| 17. Integration Testing | 5 | 4–5 | Cross-validation, perf, bug fixes |
| **Total** | **75** | **~52–66** | |

---

## Decision Log (Decisions Made During Roadmap Creation)

**RD1: Pure-function phases first.** Scoring engine and config validator are built and fully tested before any Tauri or React code. Rationale: these contain the hardest logic and are easiest to test in isolation. A bug here propagates everywhere.

**RD2: Rust scoring engine recommended.** The cascade (edit → recompute → walk forward) must be atomic within a single SQLite transaction. If scoring lives in TypeScript, the cascade requires multiple IPC round-trips that can't be wrapped in one transaction. Porting scoring to Rust keeps the TS version as a reference implementation for test vectors.

**RD3: UI built page-by-page, not component-by-component.** Each page prompt produces a complete, testable feature. Building all components first and then wiring them creates integration risk.

**RD4: Analytics correlation engine stays in TypeScript.** Per ADR-003, Pearson's r is unmaintainable in SQL and doesn't need transactional guarantees. It receives pre-fetched data from a Rust IPC command and computes in the frontend.

**RD5: Settings page is late in the build order.** Even though config validation is built early (Phase 4), the Settings UI comes after all data entry pages. Rationale: you need to use the app with seed config before you know what editing config should feel like. Also, bugs in settings can corrupt config — better to have the validator battle-tested first.

**RD6: Correlation engine stays in TypeScript, built as a separate pure-function phase.** Per ADR-003, Pearson's r doesn't need transactional guarantees and is unmaintainable in SQL. Building it as Phase 3.5 (right after scoring) keeps all pure-function logic grouped together and fully tested before any Tauri/React work.

**RD7: Milestone checking is a post-save side effect, not a separate pipeline.** After `save_daily_log` returns, the frontend calls `check_milestones()` with the updated context. Newly achieved milestones trigger a toast. This keeps milestone logic out of the critical save path while still being timely.

**RD8: Test data generation is a Phase 17 task, not earlier.** Generating realistic test data requires all entity types to be insertable. Building the generator late ensures it exercises the full IPC layer and catches integration bugs.
