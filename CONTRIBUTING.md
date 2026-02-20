# Contributing to Life Tracker Ultimate

Thanks for your interest in contributing! This document covers everything you need to get started.

## Prerequisites

You'll need the following installed:

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Rust stable toolchain** — [rustup.rs](https://rustup.rs/)
- **Tauri 2 system dependencies** — [platform-specific guide](https://v2.tauri.app/start/prerequisites/)

## Development Setup

```bash
# Clone the repo
git clone https://github.com/Tczerwien/LifeTracker_Ultimate.git
cd LifeTracker_Ultimate

# Install frontend dependencies
cd app
npm install

# Start the dev server (launches Tauri window with hot reload)
npm run tauri dev
```

The app creates its SQLite database at your OS data directory on first launch. On Linux that's `~/.local/share/life-tracker-ultimate/ltu.db`, on Windows it's `%APPDATA%/life-tracker-ultimate/ltu.db`, and on macOS it's `~/Library/Application Support/life-tracker-ultimate/ltu.db`.

## Running Tests

All three checks must pass before submitting a PR:

```bash
# 1. TypeScript type checking (zero errors required)
cd app
npx tsc --noEmit

# 2. TypeScript tests (Vitest)
npm run test

# 3. Rust tests (292 tests including scoring engine validation)
cargo test --manifest-path src-tauri/Cargo.toml
```

## Project Structure

```
app/
├── src/                    # React + TypeScript frontend
│   ├── types/              # Type definitions (source of truth: docs/DATA_MODEL.md)
│   ├── engine/             # Pure business logic — scoring, validation, correlation
│   ├── hooks/              # TanStack Query hooks for all IPC commands
│   ├── stores/             # Zustand store (UI-only ephemeral state)
│   ├── components/         # React components organized by feature
│   ├── pages/              # Route-level page components
│   └── lib/                # Utilities, constants, query keys
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands/       # Tauri IPC command handlers
│       ├── db/             # SQLite connection, migrations, backup
│       └── engine/         # Rust scoring engine (mirrors TypeScript)
docs/                       # Planning documents (DO NOT MODIFY)
```

## Code Standards

### TypeScript

- **Strict mode enforced** — `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- **No `any` types** — use proper generics, union types, or unknown with type guards
- **Exhaustive switches** — use the `const _exhaustive: never = value` pattern
- **TanStack Query** — `staleTime: Infinity`, explicit invalidation on mutations via `queryKeys.ts`
- **Zustand** — UI-only state (selectedDate, sidebarOpen, etc.). Never put server data in Zustand.
- **Tailwind CSS** — utility-first, no custom CSS files

### Rust

- All IPC commands use `CommandResult<T>` return type
- Database access through `AppState` mutex with lock poisoning checks
- Mutations wrapped in SQLite transactions
- No `unwrap()` in production code paths (tests only)

### Architecture Decision Records

Major design choices are documented in `docs/ADRs/`. Reference them by ID when implementing related features:

| ADR | Topic |
|-----|-------|
| ADR-001 | Storage strategy — SQLite, backup, export format |
| ADR-002 | Score computation — prospective config, frozen snapshots |
| ADR-003 | Analytics — correlation engine in TypeScript |
| ADR-004 | Config — schema validation with cascading defaults |
| ADR-005 | State management — TanStack Query + Zustand split |
| ADR-006 | 24-hour correction window for recovery entries |

## Submitting Changes

1. **Fork the repo** and create a feature branch from `main`
2. **Make your changes** following the code standards above
3. **Run all three test suites** (tsc, vitest, cargo test)
4. **Write tests** for new functionality — the scoring engine requires 100% critical path coverage
5. **Reference ADRs** in commit messages when touching related areas
6. **Open a PR** with a clear description of what changed and why

### Commit Message Format

Use descriptive commit messages that explain the *why*:

```
Add phone tier escalation validation (R26-R29)

Config validator now checks that phone penalty thresholds
increase monotonically (T1 < T2 < T3) per CONFIG_SCHEMA.md
rules R26-R29. Includes 8 new test cases.
```

## Data Model Changes

The data model (`docs/DATA_MODEL.md`) is the source of truth for all entity definitions. If your change requires schema modifications:

1. Add a new numbered migration file in the Rust migrations system
2. Update TypeScript types in `src/types/models.ts` to match
3. Ensure the migration is reversible or document why it isn't
4. Test with both fresh databases and existing data

Schema changes are the most expensive thing to reverse after real data exists. They require careful review.

## Questions?

Open an issue for discussion before starting large changes. This ensures your approach aligns with the project's architecture decisions.
