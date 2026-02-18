# Life Tracker Ultimate — Claude Code Context

## Project Overview

Life Tracker Ultimate (LTU) is a local-first desktop app for personal habit tracking, built with Tauri 2 + React + TypeScript + SQLite. It tracks daily habits, study sessions, job applications, journal entries, and behavioral patterns through a two-pool scoring engine with real-time analytics.

## Project Structure

```
C:\Users\Thomas_C\Documents\Professional\LifeTracker_Ultimate\
├── app/                    # All application code (Tauri + React + TypeScript)
│   ├── src/                # Frontend TypeScript/React code
│   │   ├── types/          # TypeScript types and enums
│   │   ├── engine/         # Pure business logic (scoring, validation, correlation)
│   │   ├── hooks/          # TanStack Query hooks
│   │   ├── stores/         # Zustand stores
│   │   ├── components/     # React components (shared/ + feature folders)
│   │   ├── pages/          # Top-level route components
│   │   └── lib/            # Utilities (constants, date formatting, etc.)
│   ├── src-tauri/          # Rust backend
│   │   └── src/
│   │       ├── commands/   # Tauri IPC handlers
│   │       ├── db/         # SQLite connection, migrations
│   │       └── engine/     # Rust scoring engine
│   └── package.json
├── docs/                   # Planning & specification documents (DO NOT MODIFY)
│   ├── PRODUCT_BRIEF.md
│   ├── DATA_MODEL.md       # 11 tables, all columns, types, constraints, seed data
│   ├── SCORING_SPEC.md     # Scoring formulas, 20 test vectors, edge cases
│   ├── CONFIG_SCHEMA.md    # Validation rules, defaults, Patches A & B
│   ├── UI_SPEC.md          # Page specs, design tokens, component library
│   ├── CODING_ROADMAP.md   # Build order, phase dependencies
│   └── ADRs/               # 6 Architecture Decision Records
├── CLAUDE.md               # This file
├── PROGRESS.md             # Build progress tracker
└── verify.sh               # Post-session verification script
```

## Rules — Read These Carefully

### Never Do

- **Never modify any file in `docs/`** — these are planning documents, not code
- **Never use `any` type in TypeScript** — strict mode is enforced
- **Never skip tests** — every session includes testing before commit
- **Never modify this file** unless explicitly asked

### Always Do

- **Run `npx tsc --noEmit` before committing** — zero errors required
- **Run `npm run test` before committing** — all tests must pass
- **Run `cargo test` before committing** (after Phase 5+) — all Rust tests must pass
- **Use exact field names from DATA_MODEL.md** — the data model is the source of truth
- **Reference ADR decisions by ID** (e.g., ADR-002 SD1) when implementing related features
- **Follow best practice** - enterprise coding

### Code Style

- TypeScript: strict mode, `noUncheckedIndexedAccess: true`
- No `any` types, no loose generics like `Record<string, unknown>` for known structures
- Tailwind CSS for styling — no custom CSS files
- TanStack Query: `staleTime: Infinity`, explicit invalidation on mutations (ADR-005)
- Zustand: UI-only ephemeral state (selectedDate, sidebarOpen, etc.)

## Key Architecture Decisions (Quick Reference)

- **ADR-001 SD1:** SQLite via rusqlite, DB at `app_data_dir()/ltu.db`
- **ADR-001 SD2:** JSON export with `_meta` block (self-describing)
- **ADR-002 SD1:** Config changes are prospective only — never recompute past scores
- **ADR-002 SD3:** Weekly review snapshots frozen at save time, never auto-updated
- **ADR-003 SD2:** Correlation engine (Pearson's r) stays in TypeScript, not Rust
- **ADR-005 SD3:** TanStack Query with centralized query keys and explicit invalidation
- **ADR-006:** 24-hour correction window for relapse/urge entries, enforced in Rust

## Tech Stack

| Layer     | Choice                          |
| --------- | ------------------------------- |
| Language  | TypeScript (strict) + Rust      |
| Framework | React 18+                       |
| Desktop   | Tauri 2                         |
| Build     | Vite 5+                         |
| Styling   | Tailwind CSS 3+                 |
| Charts    | Recharts                        |
| Storage   | SQLite (rusqlite)               |
| Query     | TanStack Query                  |
| State     | Zustand (UI only)               |
| Testing   | Vitest (TS) + cargo test (Rust) |
