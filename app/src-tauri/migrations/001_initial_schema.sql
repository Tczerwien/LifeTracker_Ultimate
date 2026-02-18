-- 001_initial_schema.sql
-- Life Tracker Ultimate — Full initial schema
-- Source of truth: docs/DATA_MODEL.md + docs/CONFIG_SCHEMA.md Patches A & B
-- 11 tables, 11 indexes, 43 seed rows

-- ============================================================================
-- 1. app_config — Singleton configuration (DATA_MODEL.md Section 3.10)
-- ============================================================================

CREATE TABLE app_config (
  id                       TEXT PRIMARY KEY DEFAULT 'default',
  start_date               TEXT NOT NULL,

  -- Category multipliers
  multiplier_productivity   REAL NOT NULL DEFAULT 1.5  CHECK(multiplier_productivity > 0),
  multiplier_health         REAL NOT NULL DEFAULT 1.3  CHECK(multiplier_health > 0),
  multiplier_growth         REAL NOT NULL DEFAULT 1.0  CHECK(multiplier_growth > 0),

  -- Scoring parameters
  target_fraction           REAL NOT NULL DEFAULT 0.85  CHECK(target_fraction > 0 AND target_fraction <= 1.0),
  vice_cap                  REAL NOT NULL DEFAULT 0.40  CHECK(vice_cap >= 0 AND vice_cap <= 1.0),
  streak_threshold          REAL NOT NULL DEFAULT 0.65  CHECK(streak_threshold >= 0 AND streak_threshold <= 1.0),
  streak_bonus_per_day      REAL NOT NULL DEFAULT 0.01  CHECK(streak_bonus_per_day >= 0 AND streak_bonus_per_day <= 0.1),
  max_streak_bonus          REAL NOT NULL DEFAULT 0.10  CHECK(max_streak_bonus >= 0 AND max_streak_bonus <= 0.5),

  -- Phone tier thresholds (minutes)
  phone_t1_min              INTEGER NOT NULL DEFAULT 61   CHECK(phone_t1_min >= 0 AND phone_t1_min <= 1440),
  phone_t2_min              INTEGER NOT NULL DEFAULT 181  CHECK(phone_t2_min >= 0 AND phone_t2_min <= 1440),
  phone_t3_min              INTEGER NOT NULL DEFAULT 301  CHECK(phone_t3_min >= 0 AND phone_t3_min <= 1440),

  -- Phone tier penalties (CONFIG_SCHEMA.md Patch B)
  phone_t1_penalty          REAL NOT NULL DEFAULT 0.03  CHECK(phone_t1_penalty >= 0 AND phone_t1_penalty <= 1.0),
  phone_t2_penalty          REAL NOT NULL DEFAULT 0.07  CHECK(phone_t2_penalty >= 0 AND phone_t2_penalty <= 1.0),
  phone_t3_penalty          REAL NOT NULL DEFAULT 0.12  CHECK(phone_t3_penalty >= 0 AND phone_t3_penalty <= 1.0),

  -- Analytics parameters (CONFIG_SCHEMA.md Patch A)
  correlation_window_days   INTEGER NOT NULL DEFAULT 90  CHECK(correlation_window_days IN (0, 30, 60, 90, 180, 365)),

  -- Dropdown option lists (JSON blob — CONFIG_SCHEMA.md Section 4)
  dropdown_options           TEXT NOT NULL DEFAULT '{}',

  last_modified              TEXT NOT NULL
);

-- ============================================================================
-- 2. habit_config — Habit metadata (DATA_MODEL.md Section 3.1)
-- ============================================================================

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

  CHECK((pool = 'good' AND points > 0 AND penalty = 0)
     OR (pool = 'vice' AND points = 0))
);

-- ============================================================================
-- 3. daily_log — Daily tracking (DATA_MODEL.md Section 3.2)
-- ============================================================================

CREATE TABLE daily_log (
  id               INTEGER PRIMARY KEY,
  date             TEXT NOT NULL UNIQUE,

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

  -- Computed scores (frozen at computation time)
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

-- ============================================================================
-- 4. journal — Daily journal entries (DATA_MODEL.md Section 3.3)
-- ============================================================================

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

-- ============================================================================
-- 5. study_session — Study tracking (DATA_MODEL.md Section 3.4)
-- ============================================================================

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

-- ============================================================================
-- 6. application — Job application tracking (DATA_MODEL.md Section 3.5)
-- ============================================================================

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

-- ============================================================================
-- 7. status_change — Application status history (DATA_MODEL.md Section 3.6)
-- ============================================================================

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

-- ============================================================================
-- 8. urge_entry — Urge tracking (DATA_MODEL.md Section 3.8)
--    Must precede relapse_entry (FK dependency)
-- ============================================================================

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

-- ============================================================================
-- 9. relapse_entry — Relapse incident records (DATA_MODEL.md Section 3.7)
-- ============================================================================

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

-- ============================================================================
-- 10. weekly_review — Weekly reflection snapshots (DATA_MODEL.md Section 3.9)
-- ============================================================================

CREATE TABLE weekly_review (
  id                  INTEGER PRIMARY KEY,
  week_start          TEXT NOT NULL UNIQUE,
  week_end            TEXT NOT NULL,
  week_number         INTEGER NOT NULL,

  -- Auto-computed stats (frozen at save time — ADR-002 SD3)
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

-- ============================================================================
-- 11. milestone — Achievement definitions (DATA_MODEL.md Section 3.12)
-- ============================================================================

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


-- ============================================================================
-- SEED DATA
-- ============================================================================

-- ---------------------------------------------------------------------------
-- app_config singleton row (DATA_MODEL.md Section 4.4 + CONFIG_SCHEMA.md Section 4)
-- dropdown_options JSON matches SEED_DROPDOWN_OPTIONS from app/src/types/options.ts
-- ---------------------------------------------------------------------------

INSERT INTO app_config (
  id, start_date,
  multiplier_productivity, multiplier_health, multiplier_growth,
  target_fraction, vice_cap, streak_threshold, streak_bonus_per_day, max_streak_bonus,
  phone_t1_min, phone_t2_min, phone_t3_min,
  phone_t1_penalty, phone_t2_penalty, phone_t3_penalty,
  correlation_window_days,
  dropdown_options,
  last_modified
) VALUES (
  'default', '2026-01-20',
  1.5, 1.3, 1.0,
  0.85, 0.40, 0.65, 0.01, 0.10,
  61, 181, 301,
  0.03, 0.07, 0.12,
  90,
  '{"study_subjects":["Quantum Computing","Mobile App Development","Data Communications","IT Labs","Networking Labs","Certs","Project"],"study_types":["Self-Study","Review","Homework","Personal-Project","Lab Work","Cert Study"],"study_locations":["Library","Home","Coffee Shop","Campus","Other"],"app_sources":["JobRight","Simplify","LinkedIn","Indeed","Company Site","Referral","Other"],"relapse_time_options":["Early Morning (3-6am)","Morning (6-9am)","Late Morning (9am-12pm)","Afternoon (12-5pm)","Evening (5-9pm)","Night (9pm-12am)","Late Night (12-3am)"],"relapse_duration_options":["< 5 min","5-15 min","15-30 min","30-60 min","1-2 hours","2+ hours"],"relapse_trigger_options":["Boredom","Stress","Loneliness","Arousal","Habit/Autopilot","Insomnia","Anxiety","Sadness","Anger","Rejection","Celebration"],"relapse_location_options":["Bedroom","Desk/Office","Bathroom","Living Room","Other"],"relapse_device_options":["Phone","Laptop","Tablet"],"relapse_activity_before_options":["Studying","Scrolling Social Media","In Bed (Not Sleeping)","Watching TV/YouTube","Working","Nothing/Idle","Browsing Internet","Gaming","Other"],"relapse_emotional_state_options":["Anxious","Bored","Sad","Angry","Restless","Lonely","Tired","Stressed","Neutral","Happy"],"relapse_resistance_technique_options":["Left Room","Exercise","Called/Texted Someone","Cold Water","Meditation","Distraction Activity","Turned Off Device","None","Other"],"urge_technique_options":["Left Room","Exercise","Called/Texted Someone","Cold Water","Meditation","Went for Walk","Journaled","Push-ups","Distraction Activity","Turned Off Device","Deep Breathing","Other"],"urge_duration_options":["< 1 min","1-5 min","5-15 min","15-30 min","30-60 min","1+ hour"],"urge_pass_options":["Yes - completely","Yes - mostly","Partially","No (but I resisted anyway)"]}',
  '2026-01-20T00:00:00Z'
);

-- ---------------------------------------------------------------------------
-- habit_config seed: 13 good habits (DATA_MODEL.md Section 4.1)
-- ---------------------------------------------------------------------------

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('schoolwork', 'Schoolwork', 'good', 'Productivity', 'checkbox', 3, 0, 'flat', NULL, 1, 1, 'schoolwork', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('personal_project', 'Personal Project', 'good', 'Productivity', 'checkbox', 3, 0, 'flat', NULL, 2, 1, 'personal_project', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('classes', 'Classes', 'good', 'Productivity', 'checkbox', 2, 0, 'flat', NULL, 3, 1, 'classes', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('job_search', 'Job Search', 'good', 'Productivity', 'checkbox', 2, 0, 'flat', NULL, 4, 1, 'job_search', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('gym', 'Gym', 'good', 'Health', 'checkbox', 3, 0, 'flat', NULL, 1, 1, 'gym', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('sleep_7_9h', 'Sleep 7-9h', 'good', 'Health', 'checkbox', 2, 0, 'flat', NULL, 2, 1, 'sleep_7_9h', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('wake_8am', 'Wake by 8am', 'good', 'Health', 'checkbox', 1, 0, 'flat', NULL, 3, 1, 'wake_8am', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('supplements', 'Supplements', 'good', 'Health', 'checkbox', 1, 0, 'flat', NULL, 4, 1, 'supplements', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('meal_quality', 'Meal Quality', 'good', 'Health', 'dropdown', 3, 0, 'flat', '{"Poor":0,"Okay":1,"Good":2,"Great":3}', 5, 1, 'meal_quality', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('stretching', 'Stretching', 'good', 'Health', 'checkbox', 1, 0, 'flat', NULL, 6, 1, 'stretching', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('meditate', 'Meditate', 'good', 'Growth', 'checkbox', 1, 0, 'flat', NULL, 1, 1, 'meditate', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('read', 'Read', 'good', 'Growth', 'checkbox', 1, 0, 'flat', NULL, 2, 1, 'read', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('social', 'Social', 'good', 'Growth', 'dropdown', 2, 0, 'flat', '{"None":0,"Brief/Text":0.5,"Casual Hangout":1,"Meaningful Connection":2}', 3, 1, 'social', '2026-01-20T00:00:00Z', NULL);

-- ---------------------------------------------------------------------------
-- habit_config seed: 9 vices (DATA_MODEL.md Section 4.2)
-- ---------------------------------------------------------------------------

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('porn', 'Porn', 'vice', NULL, 'number', 0, 0.25, 'per_instance', NULL, 1, 1, 'porn', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('masturbate', 'Masturbate', 'vice', NULL, 'checkbox', 0, 0.10, 'flat', NULL, 2, 1, 'masturbate', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('weed', 'Weed', 'vice', NULL, 'checkbox', 0, 0.12, 'flat', NULL, 3, 1, 'weed', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('skip_class', 'Skip Class', 'vice', NULL, 'checkbox', 0, 0.08, 'flat', NULL, 4, 1, 'skip_class', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('binged_content', 'Binged Content', 'vice', NULL, 'checkbox', 0, 0.07, 'flat', NULL, 5, 1, 'binged_content', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('gaming_1h', 'Gaming >1h', 'vice', NULL, 'checkbox', 0, 0.06, 'flat', NULL, 6, 1, 'gaming_1h', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('past_12am', 'Past 12am', 'vice', NULL, 'checkbox', 0, 0.05, 'flat', NULL, 7, 1, 'past_12am', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('late_wake', 'Late Wake', 'vice', NULL, 'checkbox', 0, 0.03, 'flat', NULL, 8, 1, 'late_wake', '2026-01-20T00:00:00Z', NULL);

INSERT INTO habit_config (name, display_name, pool, category, input_type, points, penalty, penalty_mode, options_json, sort_order, is_active, column_name, created_at, retired_at)
VALUES ('phone_use', 'Phone (min)', 'vice', NULL, 'number', 0, 0, 'tiered', NULL, 9, 1, 'phone_use', '2026-01-20T00:00:00Z', NULL);

-- ---------------------------------------------------------------------------
-- milestone seed: 20 milestones (DATA_MODEL.md Section 4.3)
-- ---------------------------------------------------------------------------

-- Tracking milestones (2)
INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('first_steps', 'First Steps', '🌱', 'tracking', 'First day tracked', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('one_week_in', 'One Week In', '📊', 'tracking', '7 days tracked', 0, NULL, '2026-01-20T00:00:00Z');

-- Score milestones (5)
INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('streak_5', 'Streak Starter', '🔥', 'score', '5-day streak', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('streak_7', 'Power Week', '⚡', 'score', '7-day streak', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('streak_30', 'Monthly Master', '🏆', 'score', '30-day streak', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('avg_80', '80% Club', '🎯', 'score', '30-day avg >= 80%', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('trending_up', 'Trending Up', '📈', 'score', '30d avg > previous 30d avg for 3 consecutive months', 0, NULL, '2026-01-20T00:00:00Z');

-- Clean streak milestones (8)
INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_1', 'Day One', '🛡️', 'clean', '1 clean day', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_7', 'One Week Clean', '💪', 'clean', '7 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_14', 'Two Weeks Clean', '🌟', 'clean', '14 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_30', 'One Month Clean', '🥇', 'clean', '30 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_60', 'Two Months Clean', '🏆', 'clean', '60 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_90', '90 Days Clean', '👑', 'clean', '90 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_180', 'Six Months Clean', '🎖️', 'clean', '180 clean days', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('clean_365', 'One Year Clean', '🌍', 'clean', '365 clean days', 0, NULL, '2026-01-20T00:00:00Z');

-- Study milestones (5)
INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('first_session', 'First Session', '📚', 'study', 'First study log entry', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('study_50h', '50 Hours', '⏱️', 'study', 'Cumulative 50 hours', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('study_100h', '100 Hours', '📖', 'study', 'Cumulative 100 hours', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('study_500h', '500 Hours', '🎓', 'study', 'Cumulative 500 hours', 0, NULL, '2026-01-20T00:00:00Z');

INSERT INTO milestone (id, name, emoji, category, threshold, achieved, achieved_date, created_at)
VALUES ('focus_master', 'Focus Master', '🧠', 'study', '10 sessions with focus >= 4', 0, NULL, '2026-01-20T00:00:00Z');
