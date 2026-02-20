# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Life Tracker Ultimate, please report it responsibly.

**Do not open a public issue.** Instead, email **tczerwien03@gmail.com** with:

1. A description of the vulnerability
2. Steps to reproduce
3. The potential impact
4. Any suggested fixes (optional)

You can expect an acknowledgment within 48 hours and a resolution timeline within 7 days.

## Security Model

Life Tracker Ultimate is a **local-first desktop application**. Key security properties:

- **No network communication** — all data stays on your machine. No cloud sync, no telemetry, no analytics.
- **Single SQLite file** — your data lives at your OS data directory in `ltu.db`. Access is governed by your OS file permissions.
- **No authentication** — this is a single-user personal tool. Anyone with access to your machine can access the app and its data.
- **Automatic backups** — rolling 7-copy backup on every app launch, stored alongside the database.
- **Content Security Policy** — currently disabled (`null`) for the local Tauri context. This is acceptable for a local-only app but would need to be configured for any web-facing deployment.

## Data Privacy

- No data leaves your machine
- No third-party services are contacted
- The JSON export feature produces a self-contained file — you control where it goes
- Database files (`.db`, `.db-wal`, `.db-shm`) are excluded from version control via `.gitignore`
