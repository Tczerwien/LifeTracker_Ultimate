# ADR-001: Storage Backend

**Status:** Decided  
**Date:** 2026-02-17  
**Deciders:** Thomas (sole developer, sole user)

---

## Context

Life Tracker Ultimate stores years of personal behavioral data: daily habit logs, study sessions, job applications, relapse entries, journal entries, and computed scores. The storage backend is the single most expensive architectural decision to reverse — changing it after real data exists requires a full migration of every entity.

V1 used Dexie.js (IndexedDB). This was never explicitly decided: it was the default for React PWAs and was "arrived at." The consequences:
- Browser storage eviction could silently delete years of data
- Data was invisible on the filesystem — no file to copy, back up, or inspect
- No export path existed; data was trapped in the browser profile
- There was no backup strategy at all

V2 demands an explicit decision with documented rationale.

---

## Options Considered

### Option A: Tauri + SQLite via `tauri-plugin-sql` ← **Selected**

The React frontend talks to SQLite through Tauri's IPC bridge. The Rust backend mediates all database reads and writes. The database is a single `.db` file on the local filesystem.

### Option B: Tauri + Node sidecar + `better-sqlite3`

Tauri spawns a Node.js sidecar process. `better-sqlite3` provides a synchronous SQLite API. More control over the database layer; higher complexity in the sidecar process and IPC protocol.

### Option C: Tauri + PGlite (PostgreSQL as WASM)

Full PostgreSQL semantics (window functions, arrays, CTEs) running in-process as a WASM binary. More powerful analytics queries; less mature tooling; ~3MB WASM overhead.

---

## Decision

**Tauri + SQLite via `tauri-plugin-sql`.**

PGlite's Postgres query power is not a real advantage at LTU's data volumes (estimated maximum: ~5,000 rows across all tables after 5 years of daily use). Adding 3MB of WASM and early-stage tooling for analytics headroom that will never be reached is premature optimization.

The `better-sqlite3` sidecar's synchronous API is genuinely superior for SQLite — but the async IPC bridge of `tauri-plugin-sql` is not a practical bottleneck for a single-user desktop app with no concurrent writes. The complexity cost of managing a sidecar process isn't justified.

`tauri-plugin-sql` is the official Tauri plugin, well-documented, stable, and sufficient.

---

## Sub-Decisions

### SD1: Database File Location

**Decision: Fixed path at `app_data_dir()`. Not user-configurable in V1.**

**Rationale:**  
User-configurable paths require a settings UI, path validation, a "file not found" error state on launch (e.g., if a synced drive isn't mounted), and logic for handling the user moving the file manually. This is non-trivial surface area for a solo personal app.

More importantly: the raw `.db` binary is not useful for LLM analysis — LLMs cannot open SQLite files. The use case that motivated configurable paths ("easy to give to an LLM") is better served by a dedicated JSON export feature.

**Platform paths (Tauri `app_data_dir()`):**
| Platform | Path |
|---|---|
| Windows | `%APPDATA%\life-tracker-ultimate\ltu.db` |
| macOS | `~/Library/Application Support/life-tracker-ultimate/ltu.db` |
| Linux | `~/.local/share/life-tracker-ultimate/ltu.db` |

**Settings UI:** The exact resolved file path is displayed as a read-only field in Settings with an "Open folder" button that opens the containing directory in the system file manager. The user can always find and manually copy the file from here.

### SD2: LLM Export

**Decision: Dedicated JSON export feature. The SQLite file is the durable artifact; JSON is the LLM interface.**

The export produces a single self-describing JSON file containing:
- All data from all tables (excluding schema metadata)
- The `app_config` and `habit_config` rows inline, so the LLM understands scoring parameters without external documentation
- A `_meta` block with export timestamp, schema version, and row counts per table

**Export location:** User-selected via OS file picker dialog at export time. No fixed path.

**Format target:** Structured so an LLM can understand the data and scoring model without being given the planning documents. The `_meta` block should include a brief plain-English description of what each table contains.

This feature is **not optional** — it is part of V1 scope. It is the data portability and long-term archival strategy.

### SD3: Backup Strategy

**Decision: Automatic backup on every app launch. Rolling 7-copy retention.**

**Rationale:**  
A 6-month backup interval means up to 6 months of data loss on failure. For a tracker whose entire value is longitudinal data, this is an unacceptable risk. An on-launch backup costs nothing — SQLite file copy is a sub-second operation regardless of database size.

**Behavior:**
1. On every app launch, before any database connection is opened for use, copy `ltu.db` → `backups/ltu_YYYY-MM-DD_HH-MM.db`
2. After copying, delete any backup files beyond the 7 most recent (sorted by filename, which sorts chronologically by the timestamp in the name)
3. If the backup directory doesn't exist, create it
4. If the copy fails (e.g., disk full), log the error and continue — a failed backup must never block app launch

**Backup location:** `app_data_dir()/backups/`

**Retention:** 7 copies. At daily use, this provides ~1 week of recovery window. At less frequent use, it covers the 7 most recent sessions regardless of calendar time.

**Manual backup:** The user can copy `ltu.db` at any time using the "Open folder" button in Settings.

### SD4: Migration Tooling

**Decision: Numbered raw SQL migration files, version-tracked in a `schema_migrations` table, applied by the app layer at startup. No external migration library.**

**File location:** `src/db/migrations/`

**Naming convention:** `NNN_description.sql` where `NNN` is a zero-padded integer (e.g., `001_initial_schema.sql`, `002_add_stretching_habit.sql`).

**Runtime behavior:**
1. On startup, ensure `schema_migrations` table exists:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
     version   INTEGER PRIMARY KEY,
     name      TEXT NOT NULL,
     applied_at TEXT NOT NULL
   );
   ```
2. Read the highest `version` from `schema_migrations`. If no rows, version = 0.
3. Scan `src/db/migrations/` for files with a number higher than the current version, sorted ascending.
4. Execute each in order within a transaction. On success, insert a row into `schema_migrations`.
5. If any migration fails, roll back and abort startup with a clear error message.

**Invariant: Migration files are append-only.** A migration that has been applied to any real database instance must never be edited. Corrections to past migrations are new migration files.

**Rationale for no library:** `sqlx` and similar tools add a Rust dependency, a build step, and a learning curve for a problem that changes twice a year at most. The migration files themselves are the documentation — readable, auditable, committable to git without tooling.

---

## Consequences

**What this enables:**
- Data durability: years of personal data protected from browser storage eviction
- Data visibility: the user always knows where their data lives and can access it
- LLM portability: structured JSON export for AI-assisted behavioral analysis
- Recovery: 7 rolling backups mean any session from the past week is recoverable
- Auditability: SQL migration files are human-readable history of every schema change

**What this constrains:**
- Multi-device sync is not possible without a sync layer (explicitly a non-goal in V1)
- All database access goes through the Tauri IPC bridge — no direct JS → SQLite calls. Every query is async.
- Schema changes require a migration file. You cannot change a column type or add a NOT NULL column without a migration that handles existing data.
- The backup directory will grow to ~35MB maximum (7 × ~5MB). Not a concern in practice.

**What must be decided in future ADRs:**
- Analytics architecture: do analytics queries hit the live `daily_log` table directly, or are aggregates pre-computed? (ADR-003)
- State management: how does the React layer handle the async IPC boundary? (ADR-005)
- Correction window: if a relapse is logged within 24h, does it trigger a score recomputation and backup overwrite? (ADR-006)

---

## References

- `PRODUCT_BRIEF.md` — Platform & Storage section, Data Lifecycle section
- `DATA_MODEL.md` — Migration Patterns section (D1, D2, D3, D4)
- V1 lesson: *"IndexedDB with no backup strategy was a data lifecycle question that should have been answered on day one."*
