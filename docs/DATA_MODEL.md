# Life Tracker Ultimate — Data Model

> V2 Rebuild | February 2026
> Every entity, field, type, relationship, and constraint — defined before any code.
> This document is the authoritative reference for the database schema.

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Entity Overview](#2-entity-overview)
3. [Entity Definitions](#3-entity-definitions)
   - [3.1 habit_config](#31-habit_config)
   - [3.2 daily_log](#32-daily_log)
   - [3.3 journal](#33-journal)
   - [3.4 study_session](#34-study_session)
   - [3.5 application](#35-application)
   - [3.6 status_change](#36-status_change)
   - [3.7 relapse_entry](#37-relapse_entry)
   - [3.8 urge_entry](#38-urge_entry)
   - [3.9 weekly_review](#39-weekly_review)
   - [3.10 app_config](#310-app_config)
   - [3.11 milestone](#311-milestone)
4. [Seed Data](#4-seed-data)
5. [Entity Relationships](#5-entity-relationships)
6. [Mutability Rules](#6-mutability-rules)
7. [Cascade & Recomputation Rules](#7-cascade--recomputation-rules)
8. [Migration Patterns](#8-migration-patterns)
9. [Conventions](#9-conventions)

---

## 1. Design Decisions

These decisions were made deliberately during planning. Each resolves a tension identified before entity design began. Reference these when reviewing or modifying the schema.

### D1: Habit Storage — Hybrid Typed Columns + Config Table

**Decision:** Each habit has a typed column on `daily_log` and a corresponding row in `habit_config` for scoring metadata.

**Rationale:** Typed columns provide SQL queryability, type safety, and simple single-row reads. The `habit_config` table decouples scoring parameters (points, multipliers, categories) from the data columns. Adding a habit requires `ALTER TABLE daily_log ADD COLUMN` + a config row — a trivial migration for infrequent changes.

**Tradeoffs accepted:** Schema migration required when habits change. Acceptable because habits are calibrated to one user and change infrequently (estimated: 1–2 times per semester).

### D2: Stored Scores — All Five Frozen at Computation Time

**Decision:** `daily_log` stores all five computed scores: `positive_score`, `vice_penalty`, `base_score`, `streak`, `final_score`. Scores are frozen at the time they are computed.

**Rationale:** Historical scores reflect the scoring rules and config values in effect when computed. This aligns with the prospective-only config policy (D4). Storing all five eliminates the need to load historical config versions for derivation. The storage cost is negligible (5 REAL columns).

### D3: Edit Cascade — Recompute Edited Day + Streak Chain

**Decision:** When a `daily_log` entry is edited, recompute that day's five scores, then walk the streak chain forward day-by-day until stored streak values converge with recomputed values.

**Rationale:** `positive_score`, `vice_penalty`, and `base_score` are independent per day — only the edited day needs recomputation. `streak` and `final_score` have sequential dependencies (day N's streak depends on day N-1), requiring a forward walk. The walk terminates at the first day where the recomputed streak matches the stored streak (usually at the next streak-breaking day).

### D4: Config Changes — Prospective Only

**Decision:** Changing scoring parameters (multipliers, target fraction, vice penalties, etc.) affects only future score computations. Past scores are not retroactively recomputed.

**Rationale:** Historical scores reflect the scoring rules in effect at the time. This preserves the narrative integrity of the data — a 75% score from January means the same thing in June as it did in January, even if the formula has been tuned since then.

### D5: Application Status — Append-Only with Denormalized Current Status

**Decision:** Status transitions are append-only rows in `status_change`. The `application` table carries a denormalized `current_status` field synced by the application layer on every status append.

**Rationale:** Append-only status history enables pipeline velocity analytics (avg days between stages, conversion rates by source). Denormalized `current_status` avoids a subquery on every application list view. The sync invariant is simple: the function that inserts a `status_change` row also updates `application.current_status` in the same transaction.

### D6: Relapse/Urge Immutability — 24-Hour Correction Window

**Decision:** Relapse and urge entries are editable within 24 hours of `created_at`, then permanently locked. Enforced at the application layer.

**Rationale:** These are incident records where retroactive editing could corrupt trigger analysis. The 24-hour window allows correction of same-night data entry errors (wrong dropdown selection when tired) without enabling narrative revision weeks later.

### D7: Entity Relationships — Join on Date, Not Foreign Keys

**Decision:** `daily_log` and `journal` share a date key but have no foreign key relationship. Cross-entity analytics join on `date` text matching.

**Rationale:** The nightly ritual fills in both, but they are logically independent. A user might journal on a day they forgot to log habits, or vice versa. A foreign key would impose ordering constraints on the UI flow (can't create journal entry without daily_log row) for no analytical benefit.

### D8: Soft Delete — No Hard Deletes

**Decision:** No entity supports hard deletion through normal app use. Applications use an `archived` flag. Other entities are permanent.

**Rationale:** Aligns with the Product Brief: "Everything is permanent and append-only." The `archived` flag on `application` hides closed/irrelevant applications from the default list view without destroying pipeline history. Other entities have no archive mechanism — they are always visible in their respective views.

**Exception — `study_session` hard delete:** `study_session` supports hard deletion as a deliberate exception to this rule. Justification: (1) study sessions have no FK dependents, (2) they have no impact on scoring, (3) they are not referenced by any analytics that would create a data integrity concern from deletion, (4) mis-entered sessions (wrong subject, duplicate entry) have no value to preserve. The UI requires explicit confirmation before deletion. This exception is intentional and does not weaken the principle for any other entity.

### D9: Cascade Behavior — ON DELETE RESTRICT

**Decision:** Foreign keys use `ON DELETE RESTRICT`. Attempts to delete a parent row with children fail.

**Rationale:** Combined with D8 (no hard deletes), RESTRICT acts as a safety net. If a bug or manual database edit attempts to delete an application with status history, the operation fails loudly rather than silently cascading. The one exception is `relapse_entry.urge_entry_id` which uses `ON DELETE SET NULL` — if a linked urge entry is somehow removed, the relapse survives with the link cleared.

---

## 2. Entity Overview

| Entity | Rows per Day | Mutable | Key Relationship |
|--------|-------------|---------|-----------------|
| `habit_config` | Static (~22 rows) | Yes (Settings page) | Drives `daily_log` column definitions and scoring |
| `daily_log` | 1 | Yes + cascade recompute (D3) | Joined by date to `journal` |
| `journal` | 1 | Yes | Joined by date to `daily_log` |
| `study_session` | 0–5 | Yes | Standalone |
| `application` | 0–3 | Yes (fields only, not status) | Parent of `status_change` |
| `status_change` | 0–3 | Append-only (D5) | Child of `application` |
| `relapse_entry` | 0–1 | 24h correction window (D6) | Optional FK to `urge_entry` |
| `urge_entry` | 0–3 | 24h correction window (D6) | Referenced by `relapse_entry` |
| `weekly_review` | 1 per week | Yes (reflections); snapshots immutable | Standalone; snapshots from `daily_log` |
| `app_config` | 1 (singleton) | Yes (Settings page) | Read by scoring engine |
| `milestone` | Static (~20 rows) | One-way (`achieved` flag) | Standalone |

---

## 3. Entity Definitions

### 3.1 habit_config

Source of truth for what habits exist, how they score, and how they render in the UI.

```sql
CREATE TABLE habit_config (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  pool          TEXT NOT NULL CHECK(pool IN ('good', 'vice')),
  category      TEXT CHECK(
                  (pool = 'good' AND category IN ('Productivity', 'Health', 'Growth'))
                  OR (pool = 'vice' AND category IS NULL)
                ),
  input_type    TEXT NOT NULL CHECK(input_type IN ('checkbox', 'dropdown', 'number')),
  points        REAL NOT NULL DEFAULT 0,
  penalty       REAL NOT NULL DEFAULT 0,
  penalty_mode  TEXT NOT NULL DEFAULT 'flat' CHECK(penalty_mode IN ('flat', 'tiered', 'per_instance')),
  options_json  TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  column_name   TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  retired_at    TEXT,

  -- Points and penalty are mutually exclusive by pool
  CHECK((pool = 'good' AND points > 0 AND penalty = 0)
     OR (pool = 'vice' AND points = 0))
);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key |
| `name` | TEXT | No | Internal identifier. Unique. e.g., `'gym'`, `'phone_use'` |
| `display_name` | TEXT | No | UI label. e.g., `'Gym'`, `'Phone (min)'` |
| `pool` | TEXT | No | `'good'` or `'vice'`. Determines scoring pool. |
| `category` | TEXT | Yes | `'Productivity'`, `'Health'`, `'Growth'` for good habits. NULL for vices (enforced by CHECK). |
| `input_type` | TEXT | No | `'checkbox'` (boolean), `'dropdown'` (text selection), `'number'` (integer input). |
| `points` | REAL | No | Scoring weight for good habits. Must be 0 for vices (enforced by CHECK). |
| `penalty` | REAL | No | Base penalty for vices. 0 for tiered vices (phone_use) where penalty is computed from thresholds. Must be 0 for good habits (enforced by CHECK). |
| `penalty_mode` | TEXT | No | `'flat'` (boolean trigger), `'tiered'` (threshold-based), `'per_instance'` (count × penalty). Only meaningful for vices. |
| `options_json` | TEXT | Yes | JSON object mapping display labels to numeric values for dropdown habits. e.g., `'{"Poor":0,"Okay":1,"Good":2,"Great":3}'`. NULL for non-dropdown habits. |
| `sort_order` | INTEGER | No | Display order within pool. UI sorts by pool → category (good habits) → sort_order. Supports drag-to-reorder within categories. |
| `is_active` | INTEGER | No | `1` = active (shown in UI, included in scoring). `0` = retired (hidden from UI, excluded from scoring, column and historical data preserved). |
| `column_name` | TEXT | No | Exact column name on `daily_log` table. Unique. Decoupled from `display_name` — renaming a habit's display doesn't require migration. |
| `created_at` | TEXT | No | ISO 8601 datetime. When the habit was added to the system. |
| `retired_at` | TEXT | Yes | ISO 8601 datetime. When `is_active` was set to 0. NULL if active. |

#### Design Notes

- **`column_name` decouples display from schema.** Renaming "Wake by 8am" to "Wake by 7:30am" updates `display_name` only — no migration needed.
- **`penalty_mode`** encodes three vice calculation strategies. The scoring engine switches on this value: `flat` applies `penalty` when triggered, `per_instance` multiplies `penalty × count`, `tiered` looks up thresholds from `app_config`.
- **`options_json`** is JSON only for dropdown configuration metadata, not for daily data storage. Acceptable because it's loaded once at app startup and never queried with SQL.
- **Mutual exclusivity CHECK.** Good habits must have `points > 0` and `penalty = 0`. Vices must have `points = 0`. Vices are not required to have `penalty > 0` because tiered vices (phone_use) derive penalty from thresholds.

---

### 3.2 daily_log

Core tracking table. One row per day. Typed columns for every active habit and vice, plus frozen computed scores and timestamps.

```sql
CREATE TABLE daily_log (
  id              INTEGER PRIMARY KEY,
  date            TEXT NOT NULL UNIQUE,

  -- Productivity (good habits)
  schoolwork       INTEGER NOT NULL DEFAULT 0,
  personal_project INTEGER NOT NULL DEFAULT 0,
  classes          INTEGER NOT NULL DEFAULT 0,
  job_search       INTEGER NOT NULL DEFAULT 0,

  -- Health (good habits)
  gym              INTEGER NOT NULL DEFAULT 0,
  sleep_7_9h       INTEGER NOT NULL DEFAULT 0,
  wake_8am         INTEGER NOT NULL DEFAULT 0,
  supplements      INTEGER NOT NULL DEFAULT 0,
  meal_quality     TEXT NOT NULL DEFAULT 'None',
  stretching       INTEGER NOT NULL DEFAULT 0,

  -- Growth (good habits)
  meditate         INTEGER NOT NULL DEFAULT 0,
  read             INTEGER NOT NULL DEFAULT 0,
  social           TEXT NOT NULL DEFAULT 'None',

  -- Vices
  porn             INTEGER NOT NULL DEFAULT 0,
  masturbate       INTEGER NOT NULL DEFAULT 0,
  weed             INTEGER NOT NULL DEFAULT 0,
  skip_class       INTEGER NOT NULL DEFAULT 0,
  binged_content   INTEGER NOT NULL DEFAULT 0,
  gaming_1h        INTEGER NOT NULL DEFAULT 0,
  past_12am        INTEGER NOT NULL DEFAULT 0,
  late_wake        INTEGER NOT NULL DEFAULT 0,
  phone_use        INTEGER NOT NULL DEFAULT 0,

  -- Computed scores (frozen at computation time — see D2)
  positive_score   REAL,
  vice_penalty     REAL,
  base_score       REAL,
  streak           INTEGER,
  final_score      REAL,

  -- Timestamps
  logged_at        TEXT NOT NULL,
  last_modified    TEXT NOT NULL,

  -- Constraints
  CHECK(porn >= 0 AND porn <= 10),
  CHECK(phone_use >= 0 AND phone_use <= 1440)
);

CREATE INDEX idx_daily_log_date ON daily_log(date);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. Unique. Natural key for lookups. Sorts lexicographically. |
| Habit columns | INTEGER/TEXT | No | One column per habit. Checkbox habits: `0`/`1`. Dropdown habits: text key (e.g., `'Good'`). Number habits: integer value. All default to 0 or `'None'`. |
| `positive_score` | REAL | Yes | 0.0–1.0. Weighted sum of completed habits as fraction of target. |
| `vice_penalty` | REAL | Yes | 0.0–0.4 (capped by `vice_cap`). Sum of triggered vice penalties. |
| `base_score` | REAL | Yes | 0.0–1.0. `positive_score × (1 - vice_penalty)`. |
| `streak` | INTEGER | Yes | 0+. Consecutive days with `base_score >= streak_threshold`. Sequential dependency on previous day. |
| `final_score` | REAL | Yes | 0.0–1.0. `base_score × (1 + min(streak × bonus_per_day, max_bonus))`. Capped at 1.0. |
| `logged_at` | TEXT | No | ISO 8601 datetime. Set on first interaction with this day's entry. Never updated. |
| `last_modified` | TEXT | No | ISO 8601 datetime. Updated on every save. Also serves as the time-of-day analysis timestamp (morning vs. midnight loggers). |

#### Design Notes

- **Score columns are nullable.** A row can exist with habits entered but scores not yet computed. Once scored, scores are never set back to NULL. `NULL` means "not yet scored"; `0.0` means "scored zero."
- **Dropdown values stored as text keys.** `meal_quality` stores `'Good'`, not `2`. The numeric mapping lives in `habit_config.options_json` and is resolved by the scoring engine at computation time. Stored scores reflect the mapping that was active when computed (prospective-only config, D4).
- **CHECK constraints on numeric ranges only.** `porn` (0–10) and `phone_use` (0–1440) have database-level validation. Dropdown values are validated at the app layer against `habit_config.options_json` to avoid migration when dropdown options change.
- **Adding a new habit.** Workflow: (1) `INSERT INTO habit_config` with new habit metadata, (2) `ALTER TABLE daily_log ADD COLUMN <column_name> <type> NOT NULL DEFAULT <default>`, (3) all historical rows get the default value, (4) historical scores are untouched (prospective-only). The scoring engine's `maxWeighted` changes, which shifts the target — note this in the UI.
- **Retiring a habit.** Set `habit_config.is_active = 0` and `retired_at`. The column stays on `daily_log` (historical data preserved). The scoring engine excludes inactive habits from computation. Future rows still have the column (with default value) but it's ignored.

---

### 3.3 journal

Daily reflection entry. One per day. Linked to `daily_log` by shared date key, no foreign key (D7).

```sql
CREATE TABLE journal (
  id            INTEGER PRIMARY KEY,
  date          TEXT NOT NULL UNIQUE,
  mood          INTEGER NOT NULL CHECK(mood >= 1 AND mood <= 5),
  energy        INTEGER NOT NULL CHECK(energy >= 1 AND energy <= 5),
  highlight     TEXT NOT NULL DEFAULT '',
  gratitude     TEXT NOT NULL DEFAULT '',
  reflection    TEXT NOT NULL DEFAULT '',
  tomorrow_goal TEXT NOT NULL DEFAULT '',
  logged_at     TEXT NOT NULL,
  last_modified TEXT NOT NULL
);

CREATE INDEX idx_journal_date ON journal(date);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. Unique. One journal entry per day. |
| `mood` | INTEGER | No | 1–5. Self-reported emotional state. |
| `energy` | INTEGER | No | 1–5. Self-reported physical energy level. |
| `highlight` | TEXT | No | Best moment of the day. Defaults to `''`. |
| `gratitude` | TEXT | No | What you're grateful for. Defaults to `''`. |
| `reflection` | TEXT | No | Open reflection. Defaults to `''`. |
| `tomorrow_goal` | TEXT | No | One thing to focus on tomorrow. Defaults to `''`. |
| `logged_at` | TEXT | No | ISO 8601 datetime. Set on first interaction. |
| `last_modified` | TEXT | No | ISO 8601 datetime. Updated on every save. |

#### Design Notes

- **No foreign key to `daily_log`.** See D7. Join on `date` for cross-entity analytics (mood ↔ habit correlations).
- **Text fields default to empty string.** `''` means "not filled in." No NULL semantics needed for a single-user reflection app.
- **Correlation analytics.** `mood` and `energy` are the primary analytical fields. Correlating `mood` with `daily_log.final_score` reveals whether habit completion predicts subjective wellbeing. Correlating `logged_at` time-of-day with `mood` reveals whether journaling timing affects self-reported state.

---

### 3.4 study_session

Per-session academic tracking. Multiple sessions per day.

```sql
CREATE TABLE study_session (
  id                INTEGER PRIMARY KEY,
  date              TEXT NOT NULL,
  subject           TEXT NOT NULL,
  study_type        TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  end_time          TEXT NOT NULL,
  duration_minutes  INTEGER NOT NULL,
  focus_score       INTEGER NOT NULL CHECK(focus_score >= 1 AND focus_score <= 5),
  location          TEXT NOT NULL,
  topic             TEXT NOT NULL DEFAULT '',
  resources         TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  logged_at         TEXT NOT NULL,
  last_modified     TEXT NOT NULL
);

CREATE INDEX idx_study_session_date ON study_session(date);
CREATE INDEX idx_study_session_subject ON study_session(subject);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. Not unique — multiple sessions per day allowed. |
| `subject` | TEXT | No | From dropdown config. e.g., `'Quantum Computing'`. |
| `study_type` | TEXT | No | From dropdown config. e.g., `'Self-Study'`, `'Lab Work'`. |
| `start_time` | TEXT | No | `'HH:MM'` (24-hour format). |
| `end_time` | TEXT | No | `'HH:MM'` (24-hour format). |
| `duration_minutes` | INTEGER | No | Computed by app layer from start/end time. Stored to avoid time-math edge cases (midnight crossing). |
| `focus_score` | INTEGER | No | 1–5. Self-assessed focus quality for the session. |
| `location` | TEXT | No | From dropdown config. e.g., `'Library'`, `'Home'`. |
| `topic` | TEXT | No | Optional. Specific topic within the subject. Defaults to `''`. |
| `resources` | TEXT | No | Optional. Materials used. Defaults to `''`. |
| `notes` | TEXT | No | Free text session notes. Defaults to `''`. |
| `logged_at` | TEXT | No | ISO 8601 datetime. |
| `last_modified` | TEXT | No | ISO 8601 datetime. |

#### Design Notes

- **`duration_minutes` is stored, not derived.** Avoids midnight-crossing edge cases at query time. App layer computes on save and recomputes on edit.
- **No `duration_hours` column.** Derive in queries: `SUM(duration_minutes) / 60.0 AS total_hours`. One source of truth.
- **Subject/type/location are TEXT, not FK to lookup tables.** Dropdown options are small and rarely change. If an option is renamed in config, old rows keep the old value — historical records reflect what was true at the time.
- **No CHECK constraint on time ordering.** Midnight-crossing sessions (11pm–1am) are valid. The app layer handles duration math correctly; `duration_minutes` is always positive.

---

### 3.5 application

Job application tracking. Fields are mutable; status transitions are append-only via `status_change` (D5).

```sql
CREATE TABLE application (
  id              INTEGER PRIMARY KEY,
  date_applied    TEXT NOT NULL,
  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  source          TEXT NOT NULL,
  current_status  TEXT NOT NULL DEFAULT 'Applied',
  url             TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  follow_up_date  TEXT,
  salary          TEXT NOT NULL DEFAULT '',
  contact_name    TEXT NOT NULL DEFAULT '',
  contact_email   TEXT NOT NULL DEFAULT '',
  login_username  TEXT NOT NULL DEFAULT '',
  login_password  TEXT NOT NULL DEFAULT '',
  archived        INTEGER NOT NULL DEFAULT 0,
  logged_at       TEXT NOT NULL,
  last_modified   TEXT NOT NULL
);

CREATE INDEX idx_application_status ON application(current_status);
CREATE INDEX idx_application_date ON application(date_applied);
CREATE INDEX idx_application_company ON application(company);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date_applied` | TEXT | No | `'YYYY-MM-DD'`. When the application was submitted. |
| `company` | TEXT | No | Company name. Required. |
| `role` | TEXT | No | Position title. Required. |
| `source` | TEXT | No | From dropdown config. Where the listing was found. |
| `current_status` | TEXT | No | Denormalized from `status_change`. Always equals the most recent status transition's `status` value. Synced by app layer. Default `'Applied'`. |
| `url` | TEXT | No | Link to listing. Defaults to `''`. |
| `notes` | TEXT | No | General application notes. Defaults to `''`. |
| `follow_up_date` | TEXT | Yes | `'YYYY-MM-DD'` or NULL. When to follow up. NULL = no follow-up scheduled. |
| `salary` | TEXT | No | Salary range or offer amount. Defaults to `''`. |
| `contact_name` | TEXT | No | Recruiter or hiring manager name. Defaults to `''`. |
| `contact_email` | TEXT | No | Contact email. Defaults to `''`. |
| `login_username` | TEXT | No | Application portal username. Stored as plaintext. Defaults to `''`. |
| `login_password` | TEXT | No | Application portal password. Stored as plaintext. Defaults to `''`. Security relies on filesystem-level protection (full-disk encryption, OS access controls), not application-level encryption. User accepts this risk. |
| `archived` | INTEGER | No | `0` = active, `1` = archived. Soft delete (D8). Default view filters to active only. |
| `logged_at` | TEXT | No | ISO 8601 datetime. |
| `last_modified` | TEXT | No | ISO 8601 datetime. |

#### Design Notes

- **`current_status` sync invariant.** Every function that inserts a `status_change` row MUST also update `application.current_status` in the same transaction. This is the only denormalization in the schema.
- **`follow_up_date` is nullable, not empty string.** A date field is either set or it isn't. NULL = "no follow-up scheduled." This is distinct from text fields where `''` means "not filled in."
- **Credentials stored as plaintext.** See field reference. Not ideal, but application-layer encryption without a key management strategy is security theater. The SQLite file itself is the security boundary.

---

### 3.6 status_change

Append-only record of application status transitions. Child of `application`.

```sql
CREATE TABLE status_change (
  id              INTEGER PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES application(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL CHECK(status IN (
                    'Applied', 'Phone Screen', 'Interview', 'Offer',
                    'Rejected', 'Withdrawn', 'No Response'
                  )),
  date            TEXT NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_status_change_app ON status_change(application_id);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. Also serves as ordering tiebreaker (insert order). |
| `application_id` | INTEGER | No | FK to `application.id`. ON DELETE RESTRICT (D9). |
| `status` | TEXT | No | Pipeline stage. CHECK constraint enforces valid values. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. When this status change happened in reality (not when it was logged). Used for pipeline velocity analytics. |
| `notes` | TEXT | No | Per-stage notes. e.g., interviewer name, questions asked. Defaults to `''`. |
| `created_at` | TEXT | No | ISO 8601 datetime. When this row was inserted. Used for ordering guarantees alongside `id`. |

#### Design Notes

- **Append-only (D5).** No UPDATE or DELETE operations exposed through the data access layer. Once inserted, a status transition is permanent. Enforced at the application layer.
- **CHECK constraint on `status` values.** Pipeline statuses are structural — the Kanban view, funnel chart, and velocity analytics depend on the exact set. Adding a status (e.g., "Technical Screen") is a deliberate schema migration, not a casual config change.
- **`date` vs `created_at`.** `date` = when it happened in the real world. `created_at` = when the user logged it. Pipeline velocity uses `date`. Ordering uses `created_at` + `id`.
- **Ordering guarantee.** Status transitions for a given application are ordered by `created_at ASC, id ASC`. Current status = `SELECT status FROM status_change WHERE application_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`.
- **Initialization.** When a new application is created, one `status_change` row is inserted: `{ status: 'Applied', date: date_applied, created_at: NOW }`.
- **ON DELETE RESTRICT.** An application with status history cannot be hard-deleted. Use `archived = 1` on the application instead (D8).

---

### 3.7 relapse_entry

Per-incident tracking for relapses. All dropdown fields required for complete intelligence gathering.

```sql
CREATE TABLE relapse_entry (
  id                    INTEGER PRIMARY KEY,
  date                  TEXT NOT NULL,
  time                  TEXT NOT NULL,
  duration              TEXT NOT NULL,
  trigger               TEXT NOT NULL,
  location              TEXT NOT NULL,
  device                TEXT NOT NULL,
  activity_before       TEXT NOT NULL,
  emotional_state       TEXT NOT NULL,
  resistance_technique  TEXT NOT NULL,
  urge_intensity        INTEGER NOT NULL CHECK(urge_intensity >= 1 AND urge_intensity <= 10),
  notes                 TEXT NOT NULL DEFAULT '',
  urge_entry_id         INTEGER REFERENCES urge_entry(id) ON DELETE SET NULL,
  created_at            TEXT NOT NULL,
  last_modified         TEXT NOT NULL
);

CREATE INDEX idx_relapse_date ON relapse_entry(date);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. Multiple per day possible. |
| `time` | TEXT | No | `'HH:MM'` (24-hour). Exact time of incident. Also used to derive time-of-day bucket for analytics (see Design Notes). |
| `duration` | TEXT | No | From dropdown config. How long the incident lasted. |
| `trigger` | TEXT | No | From dropdown config. What triggered the incident. Structured data for distribution analysis. |
| `location` | TEXT | No | From dropdown config. Where it happened. |
| `device` | TEXT | No | From dropdown config. Phone/Laptop/Tablet. |
| `activity_before` | TEXT | No | From dropdown config. What you were doing before. |
| `emotional_state` | TEXT | No | From dropdown config. How you were feeling. |
| `resistance_technique` | TEXT | No | From dropdown config. What you tried (if anything). |
| `urge_intensity` | INTEGER | No | 1–10. How strong the urge was. |
| `notes` | TEXT | No | Free text. Additional context. Defaults to `''`. |
| `urge_entry_id` | INTEGER | Yes | Optional FK to `urge_entry.id`. Links to the urge that preceded this relapse. ON DELETE SET NULL (D9 exception). |
| `created_at` | TEXT | No | ISO 8601 datetime. When the entry was created. Anchor for 24-hour correction window. |
| `last_modified` | TEXT | No | ISO 8601 datetime. Updated on edits within the correction window. |

#### Design Notes

- **`time_of_day` is derived, not stored.** The time-of-day bucket (e.g., "Night (9pm-12am)") is computed from `time` using the time ranges defined in `app_config.dropdown_options`. This eliminates inconsistency between `time` and a manually-selected bucket. Analytics queries derive the bucket: `CASE WHEN time >= '21:00' THEN 'Night (9pm-12am)' ... END` or compute in the app layer.
- **24-hour correction window (D6).** Editable if `NOW - created_at < 24 hours`. After 24 hours, the entry is locked. Enforced at the application layer, not the database.
- **All dropdown fields are NOT NULL with no default.** Complete entry is required. This is intentional friction — the intelligence-gathering value of relapse entries depends on complete data. The UI must enforce full form completion before save.
- **`urge_entry_id` with ON DELETE SET NULL.** If a linked urge entry is removed, the relapse survives with the link cleared. Relapse data is too important to lose due to a referential accident.
- **Privacy consideration.** This page should not be prominently displayed in navigation. Place in a "Recovery" section or behind a "More" menu.

---

### 3.8 urge_entry

Resistance tracking. Moments you successfully resisted an urge.

```sql
CREATE TABLE urge_entry (
  id              INTEGER PRIMARY KEY,
  date            TEXT NOT NULL,
  time            TEXT NOT NULL,
  intensity       INTEGER NOT NULL CHECK(intensity >= 1 AND intensity <= 10),
  technique       TEXT NOT NULL,
  effectiveness   INTEGER NOT NULL CHECK(effectiveness >= 1 AND effectiveness <= 5),
  duration        TEXT NOT NULL,
  did_pass        TEXT NOT NULL,
  trigger         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  last_modified   TEXT NOT NULL
);

CREATE INDEX idx_urge_date ON urge_entry(date);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `date` | TEXT | No | `'YYYY-MM-DD'`. Multiple per day possible. |
| `time` | TEXT | No | `'HH:MM'` (24-hour). When the urge occurred. |
| `intensity` | INTEGER | No | 1–10. How strong the urge was. |
| `technique` | TEXT | No | From dropdown config. Coping strategy used. |
| `effectiveness` | INTEGER | No | 1–5. How well the technique worked. |
| `duration` | TEXT | No | From dropdown config. How long the urge lasted. |
| `did_pass` | TEXT | No | From dropdown config. Outcome of resistance. |
| `trigger` | TEXT | No | Free text. What triggered the urge. Defaults to `''`. |
| `notes` | TEXT | No | Free text. Additional context. Defaults to `''`. |
| `created_at` | TEXT | No | ISO 8601 datetime. Anchor for 24-hour correction window. |
| `last_modified` | TEXT | No | ISO 8601 datetime. |

#### Design Notes

- **`trigger` is free text, not a dropdown.** Intentional asymmetry with `relapse_entry` (which uses a dropdown). Urge logging happens in the moment — freeform text captures the experience without forcing categorization. Relapse logging is retrospective and benefits from structured categories for distribution analysis.
- **Same 24-hour correction window as `relapse_entry` (D6).**
- **Cross-reference direction.** `relapse_entry` links to `urge_entry` (via `urge_entry_id`), not the reverse. The relapse happened after the urge, so the relapse references backward. Query for failed resistance: `SELECT * FROM urge_entry WHERE id IN (SELECT urge_entry_id FROM relapse_entry WHERE urge_entry_id IS NOT NULL)`.

---

### 3.9 weekly_review

Weekly reflection with auto-computed stat snapshots. One per week, keyed by Monday date.

```sql
CREATE TABLE weekly_review (
  id                  INTEGER PRIMARY KEY,
  week_start          TEXT NOT NULL UNIQUE,
  week_end            TEXT NOT NULL,
  week_number         INTEGER NOT NULL,

  -- Auto-computed stats (frozen at save time)
  avg_score           REAL,
  days_tracked        INTEGER,
  best_day_score      REAL,
  worst_day_score     REAL,
  habits_completed    INTEGER,
  study_hours         REAL,
  applications_sent   INTEGER,
  relapses            INTEGER,
  urges_resisted      INTEGER,
  streak_at_end       INTEGER,

  -- Manual reflection
  biggest_win         TEXT NOT NULL DEFAULT '',
  biggest_challenge   TEXT NOT NULL DEFAULT '',
  next_week_goal      TEXT NOT NULL DEFAULT '',
  reflection          TEXT NOT NULL DEFAULT '',

  -- Snapshot data
  snapshot_date       TEXT,
  score_snapshot      TEXT,

  logged_at           TEXT NOT NULL,
  last_modified       TEXT NOT NULL
);

CREATE INDEX idx_weekly_review_week ON weekly_review(week_start);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | No | Auto-increment primary key. |
| `week_start` | TEXT | No | `'YYYY-MM-DD'` (Monday). Unique. Natural key. |
| `week_end` | TEXT | No | `'YYYY-MM-DD'` (Sunday). |
| `week_number` | INTEGER | No | ISO 8601 week number (1–53). |
| `avg_score` | REAL | Yes | Mean of `daily_log.final_score` for the week. Frozen at save. |
| `days_tracked` | INTEGER | Yes | Count of `daily_log` entries for the week. |
| `best_day_score` | REAL | Yes | Max `final_score` for the week. |
| `worst_day_score` | REAL | Yes | Min `final_score` for the week (where > 0). |
| `habits_completed` | INTEGER | Yes | Total habit check-offs across the week. |
| `study_hours` | REAL | Yes | Sum of `study_session.duration_minutes / 60.0` for the week. |
| `applications_sent` | INTEGER | Yes | Count of applications with `date_applied` in the week. |
| `relapses` | INTEGER | Yes | Count of `relapse_entry` rows in the week. |
| `urges_resisted` | INTEGER | Yes | Count of `urge_entry` rows in the week. |
| `streak_at_end` | INTEGER | Yes | Streak value on Sunday of the week. |
| `biggest_win` | TEXT | No | Reflection field. Defaults to `''`. |
| `biggest_challenge` | TEXT | No | Reflection field. Defaults to `''`. |
| `next_week_goal` | TEXT | No | Reflection field. Defaults to `''`. |
| `reflection` | TEXT | No | Open-ended weekly reflection. Defaults to `''`. |
| `snapshot_date` | TEXT | Yes | ISO 8601 datetime. When stats were captured. NULL before save. |
| `score_snapshot` | TEXT | Yes | JSON array of 7 `final_score` values `[Mon, Tue, ..., Sun]`. NULL before save. |

#### Design Notes

- **Stats computed live until explicit save.** Opening a weekly review page shows live-computed stats from `daily_log`. The row is NOT created until the user clicks "Save Review." At save time, stats are frozen as the snapshot. This prevents accidental snapshot freezing from casual navigation.
- **Stat columns are nullable.** Before the review is saved, the row doesn't exist. After save, all stat columns are populated. NULL means "review not yet saved for this week."
- **`score_snapshot` is JSON.** A fixed-length array of 7 numbers, captured once and displayed as-is. Never queried analytically with SQL. Acceptable JSON usage (configuration/snapshot data, not analytical data).
- **Dashboard can show both.** The UI can display live-recomputed stats alongside the frozen snapshot. If they diverge (because daily log entries were edited after the review), show both with an explanation.
- **`week_number` uses ISO 8601.** Week 1 is the week containing the first Thursday of the year. Computed by the app layer from `week_start`.

---

### 3.10 app_config

Singleton configuration table. All scoring parameters, multipliers, and dropdown option lists. Every field is editable via the Settings page UI.

```sql
CREATE TABLE app_config (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  start_date      TEXT NOT NULL,

  -- Category multipliers
  multiplier_productivity  REAL NOT NULL DEFAULT 1.5  CHECK(multiplier_productivity > 0),
  multiplier_health        REAL NOT NULL DEFAULT 1.3  CHECK(multiplier_health > 0),
  multiplier_growth        REAL NOT NULL DEFAULT 1.0  CHECK(multiplier_growth > 0),

  -- Scoring parameters
  target_fraction       REAL NOT NULL DEFAULT 0.85  CHECK(target_fraction > 0 AND target_fraction <= 1.0),
  vice_cap              REAL NOT NULL DEFAULT 0.40  CHECK(vice_cap >= 0 AND vice_cap <= 1.0),
  streak_threshold      REAL NOT NULL DEFAULT 0.65  CHECK(streak_threshold >= 0 AND streak_threshold <= 1.0),
  streak_bonus_per_day  REAL NOT NULL DEFAULT 0.01  CHECK(streak_bonus_per_day >= 0 AND streak_bonus_per_day <= 0.1),
  max_streak_bonus      REAL NOT NULL DEFAULT 0.10  CHECK(max_streak_bonus >= 0 AND max_streak_bonus <= 0.5),

  -- Phone tier thresholds (minutes)
  phone_t1_min  INTEGER NOT NULL DEFAULT 61   CHECK(phone_t1_min >= 0 AND phone_t1_min <= 1440),
  phone_t2_min  INTEGER NOT NULL DEFAULT 181  CHECK(phone_t2_min >= 0 AND phone_t2_min <= 1440),
  phone_t3_min  INTEGER NOT NULL DEFAULT 301  CHECK(phone_t3_min >= 0 AND phone_t3_min <= 1440),

  -- Phone tier penalties
  phone_t1_penalty  REAL NOT NULL DEFAULT 0.03  CHECK(phone_t1_penalty >= 0 AND phone_t1_penalty <= 1.0),
  phone_t2_penalty  REAL NOT NULL DEFAULT 0.07  CHECK(phone_t2_penalty >= 0 AND phone_t2_penalty <= 1.0),
  phone_t3_penalty  REAL NOT NULL DEFAULT 0.12  CHECK(phone_t3_penalty >= 0 AND phone_t3_penalty <= 1.0),

  -- Analytics parameters
  correlation_window_days  INTEGER NOT NULL DEFAULT 90  CHECK(correlation_window_days IN (0, 30, 60, 90, 180, 365)),

  -- Dropdown option lists (JSON — config metadata, not analytical data)
  dropdown_options  TEXT NOT NULL DEFAULT '{}',

  last_modified  TEXT NOT NULL
);
```

#### Field Reference

| Field | Type | Nullable | Default | Valid Range | Description |
|-------|------|----------|---------|-------------|-------------|
| `id` | TEXT | No | `'default'` | — | Singleton key. Only one row exists. |
| `start_date` | TEXT | No | `'2026-01-20'` | Any valid date | First day of tracking. Used for tracking consistency calculation. |
| `multiplier_productivity` | REAL | No | `1.5` | > 0 | Scoring weight for Productivity habits. |
| `multiplier_health` | REAL | No | `1.3` | > 0 | Scoring weight for Health habits. |
| `multiplier_growth` | REAL | No | `1.0` | > 0 | Scoring weight for Growth habits. |
| `target_fraction` | REAL | No | `0.85` | (0, 1.0] | What fraction of max weighted score counts as 100% positive. 0 would cause divide-by-zero. |
| `vice_cap` | REAL | No | `0.40` | [0, 1.0] | Maximum total vice penalty. 0 = vices disabled. 1.0 = single max vice zeroes score. |
| `streak_threshold` | REAL | No | `0.65` | [0, 1.0] | Minimum base score to maintain streak. 0 = every day qualifies. 1.0 = perfect days only. |
| `streak_bonus_per_day` | REAL | No | `0.01` | [0, 0.1] | Per-day streak bonus. 0.01 = 1% per day. Cap at 0.1 (10%) to prevent streak domination. |
| `max_streak_bonus` | REAL | No | `0.10` | [0, 0.5] | Maximum cumulative streak multiplier bonus. 0.10 = 10% cap. |
| `phone_t1_min` | INTEGER | No | `61` | [0, 1440] | Minutes threshold for phone tier 1 penalty. |
| `phone_t2_min` | INTEGER | No | `181` | [0, 1440] | Minutes threshold for phone tier 2 penalty. |
| `phone_t3_min` | INTEGER | No | `301` | [0, 1440] | Minutes threshold for phone tier 3 penalty. |
| `phone_t1_penalty` | REAL | No | `0.03` | [0, 1.0] | Vice penalty applied when phone_use ≥ phone_t1_min but < phone_t2_min. |
| `phone_t2_penalty` | REAL | No | `0.07` | [0, 1.0] | Vice penalty applied when phone_use ≥ phone_t2_min but < phone_t3_min. |
| `phone_t3_penalty` | REAL | No | `0.12` | [0, 1.0] | Vice penalty applied when phone_use ≥ phone_t3_min. |
| `correlation_window_days` | INTEGER | No | `90` | {0, 30, 60, 90, 180, 365} | Lookback window for the correlation engine. `0` = all-time. Restricted to this discrete set to keep analytics queries predictable. |
| `dropdown_options` | TEXT | No | `'{}'` | Valid JSON | JSON object containing all dropdown option lists for UI rendering. |
| `last_modified` | TEXT | No | — | — | ISO 8601 datetime. Updated on every config change. |

#### Design Notes

- **Singleton pattern.** `id = 'default'` is the only row. App reads and writes this one row. No config versioning needed — scores are frozen at computation time (D2), so historical scores don't reference config versions.
- **CHECK constraints enforce valid ranges at the database level.** This is the `validateConfig()` called out in the project plan — enforced by the database, not just the app layer. Invalid config writes fail before corrupting scores.
- **Phone tier ordering (`t1 < t2 < t3`) validated at app layer.** SQLite CHECK constraints can't reliably cross-reference columns in the same row. The app layer validates `phone_t1_min < phone_t2_min < phone_t3_min` before writing.
- **Phone tier penalty ordering (`pt1 < pt2 < pt3`) also validated at app layer.** Same cross-field constraint limitation. `validateConfig()` enforces `phone_t1_penalty < phone_t2_penalty < phone_t3_penalty`.
- **Vice penalty values live in `habit_config`, not here — with one exception.** Each vice's flat or per_instance penalty is an attribute of the vice (stored on its `habit_config` row). The exception is phone: both the tier thresholds (`phone_t1_min`, etc.) and the tier penalties (`phone_t1_penalty`, etc.) live in `app_config` because they are tunable scoring parameters, not fixed attributes of a single habit.
- **`dropdown_options` is JSON.** Contains all dropdown option lists: study subjects, study types, study locations, app sources, relapse triggers/locations/devices/etc., urge techniques/durations. Loaded once at app startup and cached. Never queried with SQL. Acceptable JSON usage.
- **All parameters editable via Settings UI.** Every field in this table must be exposed in the Settings page with appropriate input controls and validation feedback.

---

### 3.11 milestone

Achievement definitions and achievement state. Pre-seeded, with mutable `achieved` flag.

```sql
CREATE TABLE milestone (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  emoji         TEXT NOT NULL,
  category      TEXT NOT NULL CHECK(category IN ('score', 'clean', 'study', 'tracking')),
  threshold     TEXT NOT NULL,
  achieved      INTEGER NOT NULL DEFAULT 0,
  achieved_date TEXT,
  created_at    TEXT NOT NULL
);
```

#### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | TEXT | No | Meaningful identifier. e.g., `'streak_5'`, `'clean_30'`, `'study_50h'`. |
| `name` | TEXT | No | Display name. e.g., `'Streak Starter'`, `'One Month Clean'`. |
| `emoji` | TEXT | No | Display emoji. e.g., `'🔥'`, `'🥇'`. |
| `category` | TEXT | No | `'score'`, `'clean'`, `'study'`, `'tracking'`. Determines which check routine to run. |
| `threshold` | TEXT | No | Human-readable trigger description. e.g., `'streak >= 5'`, `'clean_days >= 30'`. Documentation for seed data readability. The milestone engine uses `category` + `id` to determine check logic. |
| `achieved` | INTEGER | No | `0` = not yet, `1` = achieved. One-way: once set to 1, never reverts. |
| `achieved_date` | TEXT | Yes | `'YYYY-MM-DD'` when first achieved. NULL if not yet achieved. |
| `created_at` | TEXT | No | ISO 8601 datetime. When the milestone definition was seeded. |

#### Design Notes

- **Pre-seeded, not user-created.** Milestone definitions are part of the app's seed data. Only `achieved` and `achieved_date` change during normal use.
- **Combined definition + state table.** Unconventional (normally you'd split `milestone_definition` and `milestone_achievement`), but for a single-user app with ~20 milestones, the simplicity is worth the minor denormalization.
- **Achievement is permanent.** Once `achieved = 1`, it never reverts, even if the triggering condition is no longer met (e.g., streak drops below 5 after earning "Streak Starter"). Milestones are records of having reached a threshold, not live status indicators.
- **`threshold` is documentation.** The milestone engine (`engine/milestones.ts`) contains the check logic. The `threshold` field makes the seed data self-describing for humans reading the database. Future enhancement: make `threshold` machine-readable JSON (`{"metric": "streak", "operator": ">=", "value": 5}`) so new milestones can be added without code changes. Defer to Scoring Spec conversation.

---

## 4. Seed Data

### 4.1 habit_config — Good Habits (13)

| name | display_name | pool | category | input_type | points | penalty | penalty_mode | options_json | sort_order | column_name |
|------|-------------|------|----------|------------|--------|---------|-------------|-------------|-----------|-------------|
| schoolwork | Schoolwork | good | Productivity | checkbox | 3 | 0 | flat | NULL | 1 | schoolwork |
| personal_project | Personal Project | good | Productivity | checkbox | 3 | 0 | flat | NULL | 2 | personal_project |
| classes | Classes | good | Productivity | checkbox | 2 | 0 | flat | NULL | 3 | classes |
| job_search | Job Search | good | Productivity | checkbox | 2 | 0 | flat | NULL | 4 | job_search |
| gym | Gym | good | Health | checkbox | 3 | 0 | flat | NULL | 1 | gym |
| sleep_7_9h | Sleep 7-9h | good | Health | checkbox | 2 | 0 | flat | NULL | 2 | sleep_7_9h |
| wake_8am | Wake by 8am | good | Health | checkbox | 1 | 0 | flat | NULL | 3 | wake_8am |
| supplements | Supplements | good | Health | checkbox | 1 | 0 | flat | NULL | 4 | supplements |
| meal_quality | Meal Quality | good | Health | dropdown | 3 | 0 | flat | `{"Poor":0,"Okay":1,"Good":2,"Great":3}` | 5 | meal_quality |
| stretching | Stretching | good | Health | checkbox | 1 | 0 | flat | NULL | 6 | stretching |
| meditate | Meditate | good | Growth | checkbox | 1 | 0 | flat | NULL | 1 | meditate |
| read | Read | good | Growth | checkbox | 1 | 0 | flat | NULL | 2 | read |
| social | Social | good | Growth | dropdown | 2 | 0 | flat | `{"None":0,"Brief/Text":0.5,"Casual Hangout":1,"Meaningful Connection":2}` | 3 | social |

**Computed values (from seed data):**
- Max Raw Score: 25 (sum of all points)
- Max Weighted Score: (3+3+2+2)×1.5 + (3+2+1+1+3+1)×1.3 + (1+1+2)×1.0 = 15.0 + 14.3 + 4.0 = **33.3**
- Target: 33.3 × 0.85 = **28.305**

### 4.2 habit_config — Vices (9)

| name | display_name | pool | category | input_type | points | penalty | penalty_mode | options_json | sort_order | column_name |
|------|-------------|------|----------|------------|--------|---------|-------------|-------------|-----------|-------------|
| porn | Porn | vice | NULL | number | 0 | 0.25 | per_instance | NULL | 1 | porn |
| masturbate | Masturbate | vice | NULL | checkbox | 0 | 0.10 | flat | NULL | 2 | masturbate |
| weed | Weed | vice | NULL | checkbox | 0 | 0.12 | flat | NULL | 3 | weed |
| skip_class | Skip Class | vice | NULL | checkbox | 0 | 0.08 | flat | NULL | 4 | skip_class |
| binged_content | Binged Content | vice | NULL | checkbox | 0 | 0.07 | flat | NULL | 5 | binged_content |
| gaming_1h | Gaming >1h | vice | NULL | checkbox | 0 | 0.06 | flat | NULL | 6 | gaming_1h |
| past_12am | Past 12am | vice | NULL | checkbox | 0 | 0.05 | flat | NULL | 7 | past_12am |
| late_wake | Late Wake | vice | NULL | checkbox | 0 | 0.03 | flat | NULL | 8 | late_wake |
| phone_use | Phone (min) | vice | NULL | number | 0 | 0 | tiered | NULL | 9 | phone_use |

### 4.3 Milestones (~20)

#### Score Milestones

| id | name | emoji | category | threshold |
|----|------|-------|----------|-----------|
| first_steps | First Steps | 🌱 | tracking | First day tracked |
| one_week_in | One Week In | 📊 | tracking | 7 days tracked |
| streak_5 | Streak Starter | 🔥 | score | 5-day streak |
| streak_7 | Power Week | ⚡ | score | 7-day streak |
| streak_30 | Monthly Master | 🏆 | score | 30-day streak |
| avg_80 | 80% Club | 🎯 | score | 30-day avg ≥ 80% |
| trending_up | Trending Up | 📈 | score | 30d avg > previous 30d avg for 3 consecutive months |

#### Clean Streak Milestones

| id | name | emoji | category | threshold |
|----|------|-------|----------|-----------|
| clean_1 | Day One | 🛡️ | clean | 1 clean day |
| clean_7 | One Week Clean | 💪 | clean | 7 clean days |
| clean_14 | Two Weeks Clean | 🌟 | clean | 14 clean days |
| clean_30 | One Month Clean | 🥇 | clean | 30 clean days |
| clean_60 | Two Months Clean | 🏆 | clean | 60 clean days |
| clean_90 | 90 Days Clean | 👑 | clean | 90 clean days |
| clean_180 | Six Months Clean | 🎖️ | clean | 180 clean days |
| clean_365 | One Year Clean | 🌍 | clean | 365 clean days |

#### Study Milestones

| id | name | emoji | category | threshold |
|----|------|-------|----------|-----------|
| first_session | First Session | 📚 | study | First study log entry |
| study_50h | 50 Hours | ⏱️ | study | Cumulative 50 hours |
| study_100h | 100 Hours | 📖 | study | Cumulative 100 hours |
| study_500h | 500 Hours | 🎓 | study | Cumulative 500 hours |
| focus_master | Focus Master | 🧠 | study | 10 sessions with focus ≥ 4 |

### 4.4 app_config (Singleton)

See Section 3.10 for field defaults. The seed row uses all CHECK-constrained defaults. `dropdown_options` JSON contains all dropdown option lists from the V1 specification (study subjects, study types, study locations, app sources, app statuses, relapse dropdowns, urge dropdowns).

---

## 5. Entity Relationships

```
habit_config ──────────── drives columns on ──────────── daily_log
                                                            │
                                                     (join on date)
                                                            │
                                                         journal

application ◄──── ON DELETE RESTRICT ──── status_change
    (1)                                      (many)

urge_entry ◄──── ON DELETE SET NULL ──── relapse_entry
    (1)                                      (0..1)

app_config ──────────── read by ──────────── scoring engine
                                                 │
                                           writes scores to
                                                 │
                                              daily_log

milestone ──────────── standalone (checked after any data write)

weekly_review ──────── standalone (snapshots from daily_log + study_session + application + relapse_entry + urge_entry)

study_session ──────── standalone
```

### Relationship Details

| Parent | Child | Cardinality | FK | On Delete |
|--------|-------|------------|-----|-----------|
| `application` | `status_change` | 1:many | `status_change.application_id` | RESTRICT |
| `urge_entry` | `relapse_entry` | 1:0..1 | `relapse_entry.urge_entry_id` | SET NULL |
| `daily_log` ↔ `journal` | — | 1:0..1 (by date) | None (join on date) | N/A |

---

## 6. Mutability Rules

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| `habit_config` | Yes (Settings) | Yes | Yes (Settings) | Soft (is_active = 0) |
| `daily_log` | Yes | Yes | Yes (triggers D3 cascade) | No |
| `journal` | Yes | Yes | Yes | No |
| `study_session` | Yes | Yes | Yes | No |
| `application` | Yes | Yes | Yes (fields only) | Soft (archived = 1) |
| `status_change` | Append only | Yes | No | No |
| `relapse_entry` | Yes | Yes | 24h window only (D6) | No |
| `urge_entry` | Yes | Yes | 24h window only (D6) | No |
| `weekly_review` | Yes (explicit save) | Yes | Yes (reflections) | No |
| `app_config` | Seed only | Yes | Yes (Settings) | No |
| `milestone` | Seed only | Yes | One-way (achieved) | No |

---

## 7. Cascade & Recomputation Rules

### When a `daily_log` entry is edited (D3):

1. **Recompute the edited day.** Recalculate `positive_score`, `vice_penalty`, `base_score` from the updated habit/vice values using current `app_config`.
2. **Determine new streak.** Load the previous day's `streak` value. Compute: `base_score >= streak_threshold ? previous_streak + 1 : 0`.
3. **Compute final score.** `min(1.0, base_score × (1 + min(streak × bonus_per_day, max_bonus)))`.
4. **Walk forward.** For each subsequent day (ordered by date):
   a. Load the day's stored `base_score` (not recomputed — only the edited day's scores change).
   b. Recompute streak based on the previous day's (now-updated) streak.
   c. Recompute `final_score` using the new streak.
   d. If the recomputed `streak` and `final_score` match the stored values, **stop** — all subsequent days are already correct.
   e. Otherwise, update the stored `streak` and `final_score`, and continue to the next day.

### When `app_config` is changed (D4):

- **No cascade.** Past scores are untouched. Future score computations use the new config values. The historical record reflects the scoring rules in effect at the time of computation.

### When `habit_config` is changed:

- **Adding a habit:** `ALTER TABLE daily_log ADD COLUMN`. Historical rows get default value (0 or 'None'). Historical scores untouched. Future scoring includes the new habit in `maxWeighted` calculation.
- **Retiring a habit:** Set `is_active = 0`. Column stays. Future scoring excludes retired habits. Historical scores untouched.
- **Changing points/penalty:** Prospective only. Future scores use new values. Historical scores untouched.

---

## 8. Migration Patterns

### Adding a Habit

```sql
-- 1. Add config row
INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, column_name, sort_order, is_active, created_at)
VALUES ('stretching', 'Stretching', 'good', 'Health', 'checkbox', 1, 0, 'flat', 'stretching', 6, 1, '2026-02-16T00:00:00Z');

-- 2. Add column to daily_log
ALTER TABLE daily_log ADD COLUMN stretching INTEGER NOT NULL DEFAULT 0;
```

### Retiring a Habit

```sql
-- Mark inactive (column stays, data preserved)
UPDATE habit_config SET is_active = 0, retired_at = '2026-06-01T00:00:00Z' WHERE name = 'supplements';
```

### Adding a Pipeline Status

```sql
-- Requires migration: update CHECK constraint
-- SQLite doesn't support ALTER CHECK — must recreate table or use a new version
-- Simplest: remove CHECK and enforce at app layer, or rebuild table
```

---

## 9. Conventions

### Date & Time Formats

| Format | Usage | Example |
|--------|-------|---------|
| `'YYYY-MM-DD'` | All date fields | `'2026-02-16'` |
| `'HH:MM'` | Time-of-day fields (24-hour) | `'23:15'` |
| ISO 8601 datetime | All timestamp fields (`logged_at`, `last_modified`, `created_at`) | `'2026-02-16T23:15:00Z'` |

### Null vs Empty String

| Pattern | Usage |
|---------|-------|
| `NULL` | Field has no value and the absence is meaningful (e.g., `follow_up_date`, `achieved_date`, score columns before computation) |
| `''` (empty string) | Optional text field not filled in (e.g., `notes`, `salary`, `topic`). Simplifies app layer — check for empty string, not null. |

### Boolean Representation

SQLite has no native boolean. Use `INTEGER`: `0` = false, `1` = true. Applies to: all checkbox habit columns, `archived`, `is_active`, `achieved`.

### Indexing Strategy

Every table has a primary key index (automatic). Additional indexes on:
- Date columns used in range queries (`daily_log.date`, `study_session.date`, etc.)
- Foreign keys (`status_change.application_id`)
- Columns used in WHERE/filter clauses (`application.current_status`, `application.company`, `study_session.subject`)
