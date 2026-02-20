# Phase 17: Manual Integration Test Checklist

These tests require a running Tauri app and cannot be automated in Vitest.

---

## M1: Data Persistence (Core Loop)

1. Launch app → navigate to Daily Log
2. Toggle 3 habits on (schoolwork, gym, meditate)
3. Verify score appears in ScoreStrip
4. Close app completely (quit from system tray)
5. Reopen app → navigate to the same date
6. **Expected:** All 3 habits still checked, scores match what was shown before close
7. Navigate to yesterday → verify data loads (or empty state if no data)

## M2: Cascade Visual Verification

1. Log 3 consecutive perfect days (e.g., Feb 18, 19, 20 — all habits checked)
2. Note streak values: should be 0, 1, 2 respectively
3. Navigate back to Feb 19 → uncheck all habits → save
4. **Expected:** Feb 19 score drops to 0.0, streak resets to 0
5. Navigate to Feb 20
6. **Expected:** Feb 20 streak is now 1 (was 2), finalScore changed

## M3: Config Change — Prospective Only (ADR-002 SD1)

1. Log a day with default config (e.g., schoolwork + gym checked)
2. Note the displayed score
3. Go to Settings → Scoring → change `multiplier_productivity` to 2.0
4. Return to the same date
5. **Expected:** Score has NOT changed (past scores are frozen)
6. Navigate to tomorrow → log the same habits
7. **Expected:** Score is higher than before (uses new multiplier)

## M4: Backup Rolling Retention

1. Go to Settings → Data tab
2. Note the backup directory path
3. Click "Backup Now" 8 times
4. Open the backup directory in file explorer
5. **Expected:** Only 7 backup files exist (oldest was deleted)

## M5: Export/Import Full Cycle

1. Log data across multiple pages:
   - Daily Log: 2 days with different habits
   - Journal: 1 entry with mood/energy/highlight
   - Study: 1 session
   - Applications: 1 application
   - Recovery: 1 urge entry
2. Go to Settings → Data → Export → save JSON file
3. Open JSON in text editor → verify `_meta` block present with schema_version
4. Delete the database (or use Settings → Data → clear if available)
5. Go to Settings → Data → Import → select the exported file
6. **Expected:** All data restored — verify each page shows the original data

## M6: 24-Hour Correction Window (ADR-006)

1. Create a relapse entry (Recovery → Relapse → add new)
2. **Expected:** Edit button is visible on the entry
3. Edit the entry → verify changes save successfully
4. Wait 24+ hours (or adjust system clock forward by 25 hours)
5. **Expected:** Edit button is no longer visible
6. (Optional) Via dev tools console: `invoke('update_relapse_entry', { id: <id>, entry: {...} })`
7. **Expected:** Rust returns error: "Entry locked after 24-hour correction window"

## M7: Weekly Review Snapshot Immutability (ADR-002 SD3)

1. Log 7 days of data (Monday–Sunday) with varying scores
2. Navigate to Weekly Review page for that week
3. Note the auto-computed stats (avg_score, days_tracked, etc.)
4. Save the review with reflection text
5. Navigate back to Wednesday → edit habits to be all empty → save
6. Return to Weekly Review page
7. **Expected:** Snapshot shows ORIGINAL avg_score (not the updated one)
8. If implemented: verify a divergence warning appears (live stats ≠ snapshot)

## M8: Milestone Permanence

1. Track enough consecutive days to achieve a streak milestone (e.g., 7-day streak)
2. Navigate to Milestones page → verify milestone shows as achieved with date
3. Go back and edit a mid-streak day to have 0 habits (breaking the streak)
4. Return to Milestones page
5. **Expected:** Milestone STILL shows as achieved (never revoked)

## M9: Rapid Toggle Stress Test

1. Navigate to Daily Log
2. Rapidly toggle habits on/off 20 times in quick succession
3. **Expected:** No error toasts appear, no frozen UI
4. Wait 2 seconds for all mutations to settle
5. Verify final state of each habit matches what was last toggled
6. Verify ScoreStrip score matches the final habit state
