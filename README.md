# Life Tracker Ultimate

A local-first desktop app for end-of-day personal reflection and behavior tracking. Log habits, vices, journal entries, study sessions, and job applications — then let a two-pool scoring engine and analytics pipeline turn raw data into patterns you can act on.

Built with **Tauri 2 + React + TypeScript + SQLite**.

![Status](https://img.shields.io/badge/status-in%20development-yellow)

---

## What It Does

Life Tracker Ultimate is a **nightly reflection workstation**. Every evening in 30 minutes, you log your day through a structured flow:

1. **Toggle habits** — 12 positive habits across Productivity, Health, and Growth categories
2. **Log vices** — 9 vices with checkboxes, counters, and phone screen time tracking
3. **See your score** — real-time two-pool scoring updates as you toggle inputs
4. **Journal** — mood, energy, highlight, gratitude, reflection, tomorrow's goal
5. **Log sessions** — study sessions and job applications when they happen
6. **Track streaks** — consecutive days above your score threshold

Over time, the analytics dashboard reveals which habits correlate with your best days, which vices spike on weekends, and which job application sources actually produce callbacks.

## Key Features

**Two-Pool Scoring Engine** — Positive effort and vice penalties are scored independently. A productive day with a slip still scores meaningfully higher than a lazy day without one. You're never incentivized to think "the day is already ruined."

**Real-Time Score Computation** — Scores update as you toggle habits. No save button needed for the daily log.

**Edit Cascade** — Edit a past day's log and the scoring engine automatically recomputes streak chains forward until convergence.

**Correlation Engine** — Pearson's r computation identifies which habits most strongly correlate with high scores across configurable time windows.

**Weekly Review Snapshots** — Sunday reflection ritual with auto-computed stats frozen at save time, so retroactive edits don't distort your weekly record.

**Self-Describing JSON Export** — Export your entire dataset to a JSON file that includes the scoring config and schema metadata, structured so an LLM can read and analyze it without external documentation.

**24-Hour Correction Window** — Relapse and urge entries can be edited within 24 hours of creation, then lock permanently.

**Milestone System** — Achievement badges for streaks, clean days, study hours, and application milestones. One-way flip — once earned, never reversed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Tauri 2 |
| Frontend | React 18, TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Local Storage | SQLite (via rusqlite) |
| Server State | TanStack Query |
| Client State | Zustand |
| Testing | Vitest + cargo test |

## Architecture

The scoring engine exists in both **TypeScript** (reference implementation with full test coverage) and **Rust** (production implementation for atomic cascade transactions). Both are cross-validated against 20 test vectors to ensure parity.

All data lives in a single SQLite file on your machine. No cloud, no accounts, no telemetry. The `.db` file can be backed up by copying a single file.

```
app/
├── src/                    # React + TypeScript frontend
│   ├── types/              # Shared type definitions
│   ├── engine/             # Scoring, validation, correlation (pure TS)
│   ├── hooks/              # TanStack Query hooks
│   ├── stores/             # Zustand stores (UI state only)
│   ├── components/         # React components
│   ├── pages/              # Route-level pages
│   └── lib/                # Utilities and constants
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri IPC handlers
│       ├── db/             # SQLite connection + migrations
│       └── engine/         # Rust scoring engine
docs/                       # Product specs, data model, ADRs
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

### Install & Run

```bash
cd app
npm install
npm run tauri dev
```

### Run Tests

```bash
# TypeScript
cd app
npx tsc --noEmit
npm run test

# Rust
cargo test --manifest-path app/src-tauri/Cargo.toml
```

### Build for Production

```bash
cd app
npm run tauri build
```

The built binary will be in `app/src-tauri/target/release/`.

## Customization

This app is built around one person's habits, vices, and scoring weights. If you want to use it for yourself:

1. **Fork the repo**
2. **Edit the seed data** in `docs/DATA_MODEL.md` and the corresponding SQL migration to match your habits
3. **Adjust scoring parameters** — multipliers, target fraction, vice cap, streak thresholds — either in the seed config or through the Settings page at runtime

The scoring engine is fully configurable through the Settings page once the app is running. Habits can be added, retired, and reordered. Dropdown options for study subjects, relapse triggers, etc. are all editable.

## Documentation

The `docs/` folder contains the complete project specification:

- **PRODUCT_BRIEF.md** — Product vision, feature tiers, success criteria
- **DATA_MODEL.md** — All 11 database tables with columns, types, constraints, and seed data
- **SCORING_SPEC.md** — Scoring formulas, 20 test vectors, edge case truth table
- **CONFIG_SCHEMA.md** — Every configurable parameter with validation rules and defaults
- **UI_SPEC.md** — Page specifications, design tokens, component library
- **CODING_ROADMAP.md** — Build order with 17 phases and dependency graph
- **ADRs/** — 6 Architecture Decision Records covering storage, scoring, analytics, config, state management, and the correction window

## License

MIT — see [LICENSE](LICENSE) for details.
