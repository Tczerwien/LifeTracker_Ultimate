-- 003_reset_start_date.sql
-- Reset start_date to 2026-02-22 and wipe all tracking data.
-- Preserves: table structure, app_config (updated), habit_config, milestone definitions.

-- Update start_date
UPDATE app_config SET start_date = '2026-02-22', last_modified = '2026-02-22T00:00:00Z' WHERE id = 'default';

-- Delete children before parents (FK constraints)
DELETE FROM status_change;       -- FK → application (RESTRICT)
DELETE FROM relapse_entry;       -- FK → urge_entry (SET NULL)
DELETE FROM urge_entry;
DELETE FROM daily_log;
DELETE FROM journal;
DELETE FROM study_session;
DELETE FROM application;
DELETE FROM weekly_review;

-- Reset milestones to unachieved (keep definitions)
UPDATE milestone SET achieved = 0, achieved_date = NULL;
