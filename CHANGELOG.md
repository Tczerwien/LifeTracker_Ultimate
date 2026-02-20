# Changelog

All notable changes to Life Tracker Ultimate will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-20

### Added

- **Two-pool scoring engine** — positive effort and vice penalties scored independently, with configurable category multipliers, target fraction, vice cap, and streak bonuses. Implemented in both TypeScript (reference) and Rust (production), cross-validated against 20 test vectors.
- **Daily Log page** — toggle 12 positive habits across Productivity, Health, and Growth categories; log 9 vices with checkboxes, counters, and phone screen time tracking. Real-time score computation as inputs change.
- **Edit cascade** — editing a past day's log automatically recomputes streak chains forward until convergence, all within a single database transaction.
- **Journal page** — mood (1-5), energy (1-5), highlight, gratitude, reflection, and tomorrow's goal fields.
- **Study Log page** — track study sessions with subject, duration, focus rating, and notes. Expandable rows with inline editing.
- **Application Log page** — track job applications with company, role, source, status timeline, and notes.
- **Recovery tracking** — relapse and urge entry logging with 24-hour correction window enforced in Rust. Entries lock permanently after 24 hours.
- **Weekly Review page** — Sunday reflection ritual with auto-computed weekly stats frozen at save time (ADR-002 SD3).
- **Analytics dashboard** — overview stats, trend charts, completion rates, vice frequency, day-of-week patterns, and correlation analysis (Pearson's r) across configurable time windows.
- **Milestone system** — achievement badges for streaks, clean days, study hours, and application milestones. One-way flip: once earned, never reversed.
- **Settings page** — 5-tab configuration UI for scoring parameters, habit management (add, retire, reorder), dropdown option editing, and data management.
- **Data management** — JSON export with self-describing `_meta` block, JSON import with validation, manual backup trigger, and automatic rolling 7-copy backup on app launch.
- **Correlation engine** — Pearson's r computation in TypeScript identifying habit-to-score relationships across 7/14/30/90-day windows.
- **Config validation** — 184+ validation rules (R01-R29) with cross-field checks and warnings for edge cases.
- **SQLite storage** — local-first database with WAL mode, foreign key enforcement, versioned migrations, and automatic backup system.
- **Full test suite** — 292 Rust tests, 44 TypeScript test files, 3 integration test suites, and cross-validation between TS and Rust scoring engines.

### Architecture

- Tauri 2 desktop runtime with React 18 + TypeScript (strict mode) frontend
- SQLite via rusqlite (bundled) — no external database dependency
- TanStack Query for server state with `staleTime: Infinity` and explicit invalidation
- Zustand for UI-only ephemeral state (selected date, sidebar, toast)
- 6 Architecture Decision Records (ADRs) documenting all major design choices
- 6 planning documents (Product Brief, Data Model, Scoring Spec, Config Schema, UI Spec, Coding Roadmap)

[0.1.0]: https://github.com/Tczerwien/LifeTracker_Ultimate/releases/tag/v0.1.0
