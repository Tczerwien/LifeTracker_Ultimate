# Life Tracker Ultimate — Product Brief

> V2 Rebuild | February 2026
> This document is the filter for every downstream decision. If a feature, data model choice, or UI pattern can't trace back to something here, it doesn't belong.

---

## What This Is

A native desktop app for end-of-day personal reflection and behavior tracking. You fill it out each night in 30–45 minutes, logging what you did, how you felt, and what happened — then a scoring engine and analytics pipeline turn that raw data into patterns you can act on.

It is not a quick-tap habit tracker. It is a **nightly reflection workstation** — a structured ritual that forces you to confront your day honestly, assigns a score that reflects your values, and over time reveals the hidden patterns behind your best and worst days.

## Who This Is For

Thomas. One user. Every habit, vice, category, and scoring weight is calibrated to his life, goals, and struggles. There is no onboarding, no generic templates, no multi-user support. If someone else wants to use it, they fork it.

Commercialization (Play Store, premium features, general-purpose habit tracking) is a future fork — it will not influence any decision in this version.

## Core Philosophy

**"Track what you control, penalize what you choose, and turn data into self-knowledge."**

The two-pool scoring model separates positive effort from vice penalties. A productive day with a relapse still scores meaningfully higher than a lazy day without one. You are never incentivized to think "the day is already ruined." The relapse journal exists for intelligence gathering, not shame — when you can see that 70% of relapses happen Saturday nights at home when you're bored, you can build a defense for that exact scenario.

## The Core Loop

```
Every evening, 30–45 minutes:

  1. Log habits    — checkboxes and dropdowns for 12 positive habits
  2. Log vices     — checkboxes and inputs for 9 vices
  3. See score     — real-time scoring as you toggle inputs
  4. Journal       — mood, energy, highlight, gratitude, reflection, tomorrow's goal
  5. Log sessions  — study sessions, job applications (if any happened today)
  6. Done          — close the app, see your streak

On-demand:
  - Browse dashboard for trends, correlations, and pattern insights
  - Weekly review every Sunday (auto-stats + written reflection)
  - Log relapses or resisted urges when they occur (event-driven)
```

The default path through the app is **sequential** — habits → vices → score → journal → sessions → done. Navigation exists for jumping to any section or reviewing past entries, but the nightly ritual follows a guided flow.

## Success Criteria (Behavioral Outcomes)

This app succeeds if, after 3 months of use:

1. **Longer clean streaks** — relapse frequency decreasing, streaks between incidents growing
2. **Habit consistency** — daily completion rates for core habits trending upward
3. **Trigger pattern recognition** — you can name your top 3 relapse triggers with time, place, and emotional context
4. **Job pipeline signal** — you know which application sources produce callbacks vs. silence
5. **Score trajectory** — 30-day average score is higher than it was 60 days ago

These are the metrics that matter. Features that don't serve at least one of these outcomes should be questioned.

## Feature Tiers

### Tier 1 — The Nightly Ritual (every day, 25–35 min)

The core product. If you only use one part of the app, this is it.

- **Daily Log**: 12 positive habits (checkboxes + dropdowns), 9 vices (checkboxes + number inputs)
- **Scoring Engine**: Two-pool model computes in real-time as inputs change
- **Journal**: Mood (1–5), energy (1–5), highlight, gratitude, reflection, tomorrow's goal
- **Score Review**: Today's positive score, vice penalty, base score, streak, final score

### Tier 2 — Session Logging (event-driven, 5–10 min each)

Logged when they happen, not on a schedule. Can be logged during the nightly ritual or at the time of occurrence.

- **Study Sessions**: Subject, type, start/end time, duration, focus score, location, notes
- **Job Applications**: Company, role, source, status with full transition history, follow-up date
- **Relapse Journal**: Per-incident analysis — time, trigger, location, device, emotional state, intensity
- **Urge Log**: Resistance tracking — intensity, technique used, effectiveness, outcome

### Tier 3 — Weekly Reflection (Sundays, 10–15 min)

Zoom-out perspective on the week.

- **Auto-computed stats**: Average score, days tracked, study hours, apps sent, relapses, urges resisted
- **Written reflection**: Biggest win, biggest challenge, next week's goal, open reflection
- **Score snapshot**: Captures point-in-time weekly scores to prevent retroactive stat drift

### Tier 4 — Analytics & Insights (on-demand)

The dashboard. This is where raw data becomes self-knowledge. Browse whenever you want to understand patterns.

- **Score trends**: Daily scores with 7-day and 30-day moving averages
- **Habit completion rates**: Per-habit completion percentage over time
- **Correlations**: Which habits correlate most with high scores
- **Day-of-week patterns**: Which days are your strongest/weakest
- **Vice frequency**: Which vices occur most often
- **Trigger analysis**: Relapse trigger distribution, time-of-day patterns
- **Pipeline analytics**: Application conversion rates by source and stage
- **Calendar heatmap**: Color-coded month view of daily scores
- **Milestone badges**: Achievement system for streaks, clean days, study hours

### Explicitly Cut

- **GitHub Activity Log** — Vanity metric. Doesn't connect to any success outcome. If you want to track coding, the `personal_project` habit checkbox covers it.

## Non-Goals

These are things this app will **not** do. If a feature request touches one of these, the answer is no (for this version).

| Non-Goal | Rationale |
|----------|-----------|
| Social features | No sharing, friends, leaderboards, accountability partners. This is private. |
| Cloud sync | Data lives on your machine. Multi-device sync is a future problem if it becomes a real need. |
| General-purpose habit tracking | Your habits, your vices, your scoring model. Not customizable for strangers. |
| Study scheduling / calendar | Tracks sessions after they happen. Does not plan your schedule. Future: Google Calendar read integration for context. |
| Job board / application sourcing | Tracks your pipeline. Does not find jobs for you. |
| Mobile app | Desktop-first (Tauri). Mobile is a future consideration after the desktop tool proves its value. |
| AI-generated insights | The analytics engine computes correlations and patterns. It does not generate natural language advice. Future: LLM-readable export format for manual analysis. |

## Platform & Storage

**Tauri + SQLite native desktop app.** The frontend is React/TypeScript rendered in a native Tauri webview. Data is stored in a SQLite database file on the local filesystem — a real file you can see, back up, copy, and version control.

Why not a PWA with IndexedDB:
- Browser can evict IndexedDB data under storage pressure
- Data is tied to one browser profile, invisible on the filesystem
- Years of personal data deserves more durability than a browser cache

Why Tauri over Electron:
- ~5MB binary vs ~150MB
- Native performance, lower memory footprint
- Rust backend provides safe file system operations

The SQLite file is the user's data. It can be backed up by copying a single file. It can be exported to JSON for LLM analysis or archival. It can be imported to restore from backup.

## Data Lifecycle

- **Everything is permanent and append-only.** No entries are ever hard-deleted through normal use.
- **Edits are allowed** — past entries can be modified (with `lastModified` timestamp tracking).
- **Archive/export**: When the database grows large, export to a self-describing JSON file (or SQLite dump) that includes the config schema alongside the data, structured so an LLM can read and understand it without external documentation.
- **Backup**: The SQLite `.db` file can be manually copied at any time. Future: automated periodic backup to a user-specified directory.

## Visual Standard

The app must look good enough that opening it feels like a reward, not a chore. If the UI doesn't meet this bar, it won't get used — this is a learned lesson from V1.

**Reference apps for visual direction:**
- **Habitify** — Clean streak visualizations, charts that are immediately understandable
- **Loop Habit Tracker** — Simplicity, no visual clutter, information density without overwhelm
- **Google Calendar** — Color-coded categories, easy data entry, clean grid layouts

**Design principles:**
- Category-colored sections (blue/productivity, green/health, purple/growth, red/vices)
- Score gradient (red → amber → green) used universally for any quality metric
- Dark header (`#1F2937`) with clean white/light content areas
- Minimal chrome — the data is the interface, not buttons and labels
- Responsive within the desktop window (sidebar collapses at narrow widths)

## Cold Start Strategy

An empty app is a depressing app. The first-week experience needs to feel valuable before analytics kick in.

- **Day 1**: Focus on the score. Fill in habits, see a number, understand the formula. That's the hook.
- **Days 2–7**: Streak counter becomes motivating. Show "X days tracked" prominently.
- **Week 2+**: Enough data for 7-day moving averages and basic habit completion rates.
- **Month 1+**: Correlations, day-of-week patterns, and trigger analysis become meaningful.

The dashboard should **gracefully degrade** — show only the metrics that have enough data to be meaningful, with placeholder cards that say "Need 7 more days of data" or "Log your first study session to see stats here." Never show empty charts or zero-value KPIs.

## What Was Over-Built in V1 (Lessons)

1. **GitHub Activity Log** — Cut. Vanity metric with no behavioral outcome.
2. **Study resource/topic tracking** — Keep the fields, but they're optional. Don't pretend you'll analyze textbook-vs-YouTube effectiveness.
3. **Urge technique effectiveness rankings** — The urge log itself is valuable, but building a technique-comparison analytics engine is over-engineering for V1 data volumes.
4. **Application Kanban board with drag-and-drop** — A sortable/filterable table is sufficient. Kanban is a UI luxury for a future phase.
5. **50+ page specification before any usage data** — This time, plan enough to build right, then let real usage inform what to expand.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Shell | Tauri 2 | Lightweight native wrapper, real filesystem access, ~5MB binary |
| Frontend | React 18+ / TypeScript (strict) | Ecosystem, AI-assisted dev support, Recharts compatibility |
| Build | Vite 5+ | Sub-second HMR, industry standard |
| Styling | Tailwind CSS 3+ | Utility-first, design tokens map to color palette |
| Charts | Recharts | React-native composable charts, handles all needed chart types |
| Database | SQLite (via Tauri SQL plugin) | Real file on disk, full SQL, durable, portable, backupable |
| Testing | Vitest | Scoring engine needs 100% test coverage |

## What Comes Next

This brief feeds directly into five more planning documents, in order:

1. **Data Model** (`DATA_MODEL.md`) — Every entity, field, type, relationship, constraint
2. **Scoring Spec** (`SCORING_SPEC.md`) — Formulas, edge cases, test vectors
3. **Architecture Decisions** (`ADR/`) — Storage, state management, analytics, extensibility
4. **UI/UX Structure** (`UI_SPEC.md`) — Pages, components, interaction flows
5. **Config Schema** (`CONFIG_SCHEMA.md`) — Parameters, validation, defaults

No code until these six documents exist.
