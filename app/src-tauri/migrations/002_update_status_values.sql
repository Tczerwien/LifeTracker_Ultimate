-- ============================================================================
-- Migration 002: Align status values with TypeScript ApplicationStatus enum
-- ============================================================================
--
-- The initial schema used Title Case status values ('Applied', 'Phone Screen')
-- but the TypeScript enum uses snake_case ('applied', 'phone_screen').
-- Also adds 'technical_screen' which was missing from the DB CHECK constraint.
--
-- Safe to drop/recreate: no application data exists yet (Phase 6.4 is the
-- first time application commands are implemented).
-- ============================================================================

-- Drop dependent table first (status_change references application)
DROP INDEX IF EXISTS idx_status_change_app;
DROP TABLE IF EXISTS status_change;

-- Drop application table and its indexes
DROP INDEX IF EXISTS idx_application_status;
DROP INDEX IF EXISTS idx_application_date;
DROP INDEX IF EXISTS idx_application_company;
DROP TABLE IF EXISTS application;

-- Recreate application with snake_case default for current_status
CREATE TABLE application (
  id              INTEGER PRIMARY KEY,
  date_applied    TEXT NOT NULL,
  company         TEXT NOT NULL,
  role            TEXT NOT NULL,
  source          TEXT NOT NULL,
  current_status  TEXT NOT NULL DEFAULT 'applied',
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

-- Recreate status_change with snake_case CHECK constraint values
CREATE TABLE status_change (
  id              INTEGER PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES application(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL CHECK(status IN (
                    'applied', 'phone_screen', 'interview', 'technical_screen',
                    'offer', 'rejected', 'withdrawn', 'no_response'
                  )),
  date            TEXT NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_status_change_app ON status_change(application_id);
