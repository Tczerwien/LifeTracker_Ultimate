# Life Tracker Ultimate — UI/UX Structure Specification

> V2 Rebuild | February 2026  
> Page inventory, component hierarchy, interaction flows, and navigation decisions.  
> This is a structure document — not pixel-perfect mockups.

---

## Table of Contents

1. [Design Decisions (UI)](#1-design-decisions-ui)
2. [Application Shell](#2-application-shell)
3. [Navigation Structure](#3-navigation-structure)
4. [Global Components](#4-global-components)
5. [Page Specifications](#5-page-specifications)
   - [5.1 Daily Log](#51-daily-log)
   - [5.2 Journal](#52-journal)
   - [5.3 Analytics](#53-analytics)
   - [5.4 Study Log](#54-study-log)
   - [5.5 App Log](#55-app-log)
   - [5.6 Weekly Review](#56-weekly-review)
   - [5.7 Recovery](#57-recovery)
   - [5.8 Settings](#58-settings)
6. [Shared Component Library](#6-shared-component-library)
7. [State Architecture (UI Layer)](#7-state-architecture-ui-layer)
8. [Design Tokens](#8-design-tokens)

---

## 1. Design Decisions (UI)

Decisions made during Conversation 5. Referenced by ID throughout this document.

| ID | Decision | Rationale |
|----|----------|-----------|
| DU1 | Scores update in real-time on every habit toggle. No explicit Save button on Daily Log. | Every interaction is an immediate database write. No discard-changes escape hatch. Consequence of DU1: misclicks generate two writes — accepted. |
| DU2 | Journal shares `selectedDate` from Daily Log via Zustand. No independent date navigator on Journal page. Opening Journal directly defaults to today. | Single source of truth for date context. Prevents confusion from two date pickers drifting. |
| DU3 | Analytics uses vertical scroll with sticky section headers. No tabs. | Desktop Tauri app with full screen width. Vertical scroll lets all sections coexist without context switching. Sticky headers preserve orientation while scrolling. |
| DU4 | Recovery (Relapse Log + Urge Log) is in the primary nav, visually subdued. No floating action button. | Logging urgency is real — in-the-moment access matters. Subdued visual treatment signals it's not part of the daily ritual while keeping it accessible. |
| DU5 | Daily Log is the home screen. The app opens here. | Optimizes for the most frequent action: the nightly ritual. |
| DU6 | Score strip on Daily Log serves the daily check-in role. Dashboard is analytics-only. | Separates "am I on track today" (Daily Log) from "what patterns exist" (Analytics). The former needs to be instant; the latter can require navigation. |
| DU7 | Recovery entries are reviewed in Analytics under the Records section. Recovery nav items lead to entry forms only, not review dashboards. | Entry (in the moment) and analysis (later, deliberate) are different modes with different UX needs. |

---

## 2. Application Shell

The application shell is the persistent outer frame. All page content renders inside it.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Page Content Area (flex)     │
│                         │                               │
│  [Logo / App Name]      │  ┌───────────────────────┐   │
│                         │  │  Page Header          │   │
│  PRIMARY NAV            │  │  (title + date nav    │   │
│  ○ Daily Log            │  │   where applicable)   │   │
│  ○ Journal              │  ├───────────────────────┤   │
│  ○ Analytics            │  │                       │   │
│                         │  │  Page Content         │   │
│  SECONDARY NAV          │  │  (scrollable)         │   │
│  ○ Study Log            │  │                       │   │
│  ○ App Log              │  │                       │   │
│  ○ Weekly Review        │  │                       │   │
│  ○ Settings             │  └───────────────────────┘   │
│                         │                               │
│  ─────────────────────  │                               │
│  RECOVERY (subdued)     │                               │
│  ▸ Urge Log             │                               │
│  ▸ Relapse Log          │                               │
│                         │                               │
└─────────────────────────────────────────────────────────┘
```

### Sidebar Behavior

- Fixed width: 240px. Does not collapse in desktop Tauri context (no mobile breakpoints needed for V1).
- Primary nav items: full-weight typography, brand accent color on active state.
- Secondary nav items: same size as primary, lighter weight treatment. Separated by a visible but subtle divider.
- Recovery section: pinned to bottom of sidebar above nothing. Rendered with smaller font size, muted gray color. Accordion — clicking "Recovery" expands to show "Urge Log" and "Relapse Log" as sub-items. State (expanded/collapsed) persists in Zustand UI state.
- Active nav item: left border accent + background highlight.

### Page Content Area

- Fills remaining width.
- Each page manages its own scroll independently.
- No global scroll — the sidebar never scrolls with content.

---

## 3. Navigation Structure

### Primary Nav — Used Daily

| Item | Route | Usage Frequency |
|------|-------|-----------------|
| Daily Log | `/` | Every session — home screen |
| Journal | `/journal` | Most sessions |
| Analytics | `/analytics` | Most sessions (glance or deep dive) |

### Secondary Nav — Used Occasionally

| Item | Route | Usage Frequency |
|------|-------|-----------------|
| Study Log | `/study` | After study sessions |
| App Log | `/apps` | When applying or receiving responses |
| Weekly Review | `/review` | Sundays only |
| Settings | `/settings` | Rarely |

### Recovery — Subdued, Primary Nav Bottom

| Item | Route | Usage Pattern |
|------|-------|---------------|
| Urge Log | `/recovery/urge` | In the moment — as needed |
| Relapse Log | `/recovery/relapse` | In the moment — as needed |

**Recovery accordion is collapsed by default.** Expands on click. Sub-item routes navigate directly to entry forms.

---

## 4. Global Components

### 4.1 Date Navigator

Used on Daily Log, Journal (read-only display only — no arrows), Study Log, Weekly Review.

```
← [Tuesday, February 17, 2026] →
```

- Left arrow: go to previous day. Disabled with visual indicator if at earliest record.
- Right arrow: go to next day. Disabled if date is today (cannot navigate to future).
- Center: formatted date, clickable to open a date picker for jumping to a specific date.
- Powered by Zustand `selectedDate` store. All pages that use it read from the same store.
- **Journal exception (DU2):** Journal displays the selected date but renders no arrows. Date changes only happen from Daily Log's navigator or the date picker.

### 4.2 Score Strip

Persistent component displayed at the top of Daily Log only (DU6). Not global — does not appear in the shell header.

```
┌────────────────────────────────────────────────────────────┐
│  Final Score     Base Score    Streak       Pos%   Vice%   │
│   [0.84]          [0.80]       [12 days]   [88%]  [5%]     │
│   ████████░░      ████████░░   🔥          green  low      │
└────────────────────────────────────────────────────────────┘
```

- All five values color-coded using the universal score gradient (red → amber → green).
- Streak displays flame icon and day count. Gold color at streak ≥ 7 days.
- Updates immediately on every habit toggle or vice change (DU1).
- Powered by TanStack Query — invalidated on every `daily_log` mutation.

### 4.3 Empty State Cards

Used across Analytics and other pages when insufficient data exists. Never show empty charts or zero-value KPIs.

Pattern:
```
┌─────────────────────────────────────┐
│  📊  [Chart Title]                  │
│                                     │
│  Need 7 more days of data           │
│  to show this chart.                │
└─────────────────────────────────────┘
```

Threshold rules:
- 7-day trends: require ≥ 7 log entries
- 30-day trends: require ≥ 14 entries (show partial with note if < 30)
- Correlation engine: require ≥ 30 entries
- Day-of-week patterns: require ≥ 4 weeks

---

## 5. Page Specifications

---

### 5.1 Daily Log

**Route:** `/` (home)  
**Purpose:** Primary nightly ritual surface. Habit entry, vice logging, live score.  
**Core loop:** Open → toggle habits → log vices → see score update. Done.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  ← Tuesday, February 17, 2026 →              [📅 picker] │
├──────────────────────────────────────────────────────────┤
│  SCORE STRIP                                             │
│  Final: 0.84  Base: 0.80  Streak: 12d  Pos: 88% Vice: 5%│
├──────────────────────────────────────────────────────────┤
│  ── PRODUCTIVITY ─────────────────────────────────────── │
│  [✓] Schoolwork (3)        [✓] Personal Project (3)     │
│  [✓] Classes (2)           [ ] Job Search (2)            │
│                                                          │
│  ── HEALTH ───────────────────────────────────────────── │
│  [✓] Gym (3)               [✓] Sleep 7-9h (2)           │
│  [ ] Wake by 8am (1)       [✓] Supplements (1)          │
│  [✓] Stretching (1)        Meal Quality: [Good ▼]        │
│                                                          │
│  ── GROWTH ───────────────────────────────────────────── │
│  [✓] Meditate (1)          [ ] Read (1)                  │
│  Social: [None ▼]                                        │
│                                                          │
│  ── VICES ────────────────────────────────────────────── │
│  Porn: [0] [−][+]          Masturbate: [ ]               │
│  Weed: [ ]                 Skip Class: [ ]               │
│  Binged Content: [ ]       Gaming >1h: [ ]               │
│  Past 12am: [ ]            Late Wake: [ ]                │
│  Phone (min): [____]                                     │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- **Checkbox habits:** Toggle on click. Immediate DB write + score recompute (DU1).
- **Dropdown habits (Meal Quality, Social):** Native select or styled dropdown. Change triggers immediate write + recompute.
- **Vice checkboxes (Weed, Masturbate, Skip Class, etc.):** Toggle. Immediate write.
- **Vice counters (Porn):** Stepper `[−][+]` with direct number input. Min 0. Write on change with 300ms debounce to prevent excessive DB writes on rapid increment.
- **Phone minutes:** Number input field. Write on blur (not on keypress). Accepts 0–1440 only — validated at app layer per DATA_MODEL constraint.
- **Score strip:** Rerenders immediately after every write completes. TanStack Query invalidation on `daily_log` mutation.

#### Empty State

If no `daily_log` row exists for the selected date, display all habits in unchecked/default state. First interaction creates the row. `logged_at` is set on row creation. `last_modified` updates on every subsequent write.

#### Previous Day Editing

Navigating back via date navigator loads that day's saved values. All interactions behave identically — writes go to that date's row, score recomputes, streak chain walk runs per ADR-002. No visual distinction between "today" and "past day" editing mode beyond the date shown in the navigator.

---

### 5.2 Journal

**Route:** `/journal`  
**Purpose:** Daily reflection. Mood, energy, and four text fields.  
**When used:** Step 5 of nightly ritual, most evenings.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Journal — Tuesday, February 17, 2026                    │
│  (date display only, no navigation arrows — DU2)         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Mood      [● ● ● ○ ○]  3/5                             │
│  Energy    [● ● ● ● ○]  4/5                             │
│                                                          │
│  Highlight                                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ What went well today?                            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Gratitude                                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ What are you grateful for?                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Reflection                                              │
│  ┌──────────────────────────────────────────────────┐   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Tomorrow's Goal                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│                                        [Save Entry]      │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- **Mood / Energy:** 5-dot slider or clickable star/dot row. Integer 1–5.
- **Text fields:** Standard textarea. Auto-expand to content height. No character limits enforced in UI (validation is DB-layer concern).
- **Save:** Explicit save button — unlike Daily Log, Journal writes are committed on "Save Entry" only. Reason: partial journal entries mid-typing should not be saved. The user signals completion.
- **Unsaved changes:** If user navigates away from Journal with unsaved changes, display a confirmation dialog: "You have unsaved journal changes. Leave anyway?"
- **Existing entry:** If a journal entry exists for the selected date, fields pre-populate with saved values. Save button updates the existing row.

#### Date Context

Journal always displays the `selectedDate` from Zustand. If the user navigates here directly without first visiting Daily Log, `selectedDate` defaults to today. The date shown is read-only — no arrows (DU2). To journal for a different day, user navigates Daily Log's date navigator first, then returns to Journal.

---

### 5.3 Analytics

**Route:** `/analytics`  
**Purpose:** Behavioral pattern analysis. Not a daily check-in surface (DU6) — that's Daily Log's score strip.  
**Layout:** Vertical scroll with sticky section headers (DU3).

#### Section Structure

```
┌──────────────────────────────────────────────────────────┐
│  Analytics                                               │
│  Window: [7d] [30d] [90d] [All time]                    │
├──────────────────────────────────────────────────────────┤
│  ── OVERVIEW ─────────────────────────── (sticky)─────  │
│  Score KPI cards (4 across):                             │
│    Avg Final Score │ Current Streak │ Best Streak │ Days │
│  Habit completion rates (bar chart, current window)      │
│                                                          │
│  ── TRENDS ───────────────────────────── (sticky)─────  │
│  Final Score trend line (selected window)               │
│  7-day moving average overlay                            │
│  Day-of-week heatmap (avg score by day)                 │
│  Vice frequency over time (stacked bar or line)         │
│                                                          │
│  ── CORRELATIONS ─────────────────────── (sticky)─────  │
│  [Empty state if < 30 days of data]                     │
│  Habit × Final Score Pearson r table                    │
│  Top 3 positive correlators callout cards               │
│  Top 3 negative correlators callout cards               │
│                                                          │
│  ── RECORDS ──────────────────────────── (sticky)─────  │
│  Study: hours by subject (bar), sessions table          │
│  Applications: pipeline funnel, status breakdown        │
│  Recovery: urge/relapse frequency over time             │
│            (no individual entry detail — aggregate only)│
└──────────────────────────────────────────────────────────┘
```

#### Window Selector

- Segmented control at page top: **7d / 30d / 90d / All time**
- Selection stored in Zustand UI state. Persists across navigation (returns to last-used window).
- Valid values: `{7, 30, 90, 0}` where `0` = all time. Matches `correlation_window_days` constraint from ADR-003.
- Applies to all sections simultaneously. Each section rerenders when window changes.

#### Lazy Loading

Per ADR-003 SD4: analytics sections load independently. Each section renders a skeleton/loading state while its query runs. A slow correlation query does not block the Overview section from rendering.

#### Empty States

All sections degrade gracefully per Section 4.3 rules. The Correlations section has the highest data threshold (30 days) and will be empty for new users for the first month — this is expected and communicated clearly in the empty state card.

---

### 5.4 Study Log

**Route:** `/study`  
**Purpose:** Log study sessions. Review session history for the selected week.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Study Log                          [+ Add Session]      │
│  Week of Feb 10–16, 2026                                 │
├──────────────────────────────────────────────────────────┤
│  This Week: 12.5 hrs │ 4 sessions │ Avg Focus: 4.2/5    │
├──────────────────────────────────────────────────────────┤
│  Date        Subject     Type       Duration   Focus     │
│  ─────────────────────────────────────────────────────   │
│  Feb 17      DSA         Practice   1h 30m     ●●●●○    │
│  Feb 16      Networks    Lecture    2h 00m     ●●●●●    │
│  ...                                                     │
├──────────────────────────────────────────────────────────┤
│  [Add Session Form — inline, expands on button click]    │
│  Date: [today]  Subject: [______]  Type: [▼]            │
│  Start: [__:__]  End: [__:__]  → 1h 30m (computed)     │
│  Focus: [● ● ● ○ ○]  Location: [______]                 │
│  Topic: [______] (optional)                              │
│                                        [Save Session]    │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- **Week navigation:** Previous/next week arrows. Independent of `selectedDate` — Study Log uses its own week cursor stored in local component state.
- **Add Session form:** Expands inline below the table on "+ Add Session" click. Does not navigate to a new page.
- **Duration:** Auto-computed from Start and End time inputs. Displayed read-only.
- **Delete session:** Row hover reveals a delete icon. Confirmation dialog before deletion. Hard delete — `study_session` is the sole exception to the no-hard-delete policy (DATA_MODEL D8). Sessions have no FK dependents, no scoring impact, and no analytical value once deleted intentionally.

---

### 5.5 App Log

**Route:** `/apps`  
**Purpose:** Track job application pipeline. Log new applications, update status, review history.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  App Log                            [+ Add Application]  │
│  Filter: [All ▼]  Sort: [Date ▼]  Search: [__________]  │
├──────────────────────────────────────────────────────────┤
│  Company      Role              Status        Date       │
│  ────────────────────────────────────────────────────    │
│  Acme Corp    Support Engineer  ● Applied     Feb 17     │
│  Initech      IT Support        ● Interview   Feb 10     │
│  ▼ [expanded row]                                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Status History:                                 │   │
│  │  Feb 10 — Applied                                │   │
│  │  Feb 14 — Phone Screen scheduled                 │   │
│  │  Feb 17 — Interview                              │   │
│  │                                                  │   │
│  │  [+ Add Status Update to status_change]  Notes: [_____] │
│  │  URL: https://...  Contact: John Smith                   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- **Row click:** Expands inline to show status history and edit fields. Click again to collapse. One row expanded at a time.
- **Status color coding:** Applied (blue), Phone Screen (amber), Interview (purple), Offer (green), Rejected (red), Withdrawn (gray), No Response (light gray).
- **Add Status Update:** Inline form within expanded row. Inserts a new row into `status_change`. `current_status` on the `application` row is synced in the same transaction (D5).
- **No Kanban** (explicitly cut in PRODUCT_BRIEF.md). Table only.
- **Filter:** By status (dropdown). Sort: by date applied, company name, or status. Search: fulltext across company and role fields.

---

### 5.6 Weekly Review

**Route:** `/review`  
**Purpose:** Sunday-night ritual. Review the week's computed stats, write reflections, save snapshot.

#### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Weekly Review — Week of Feb 10–16, 2026                 │
│  ← Previous Week                         Next Week →     │
├──────────────────────────────────────────────────────────┤
│  WEEK AT A GLANCE (live-computed)                        │
│  Avg Score: 0.76 │ Streak End: 9d │ Habits: 74% │ ...   │
│  Score sparkline (7 days Mon→Sun)                        │
├──────────────────────────────────────────────────────────┤
│  REFLECTIONS                                             │
│  Biggest Win: [__________________________________________]│
│  Biggest Challenge: [____________________________________]│
│  Next Week Goal: [_______________________________________]│
│  Reflection: [___________________________________________]│
├──────────────────────────────────────────────────────────┤
│  [Save Snapshot]   ← explicitly commits, freezes stats  │
│                                                          │
│  [Snapshot saved Feb 16 at 11:42pm]  ← if already saved │
│  ⚠ Stats diverge from snapshot (2 entries edited since) │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- **Live vs. snapshot:** Stats above always show live-computed values. After "Save Snapshot" is clicked, the saved timestamp appears and stats are frozen in the DB. If the live values subsequently diverge from the snapshot (because a past daily_log entry was edited), show a divergence warning with both values side-by-side.
- **Save Snapshot:** Creates/updates the `weekly_review` row. Sets `snapshot_date` and freezes `score_snapshot`. Reflection fields save at the same time.
- **Week navigation:** Independent of `selectedDate`. Weekly Review manages its own week cursor.

---

### 5.7 Recovery

**Routes:** `/recovery/urge`, `/recovery/relapse`  
**Purpose:** In-the-moment logging of urges and relapses. Entry forms only — no review dashboard here (DU7). Historical analysis lives in Analytics → Records.

#### Urge Log Entry — `/recovery/urge`

```
┌──────────────────────────────────────────────────────────┐
│  Log Urge                                                │
├──────────────────────────────────────────────────────────┤
│  Time: [now]       Intensity: [● ● ● ● ○] 4/10         │
│  Trigger: [__________]  Duration: [______]              │
│  Technique Used: [__________]                           │
│  Effectiveness: [● ● ● ○ ○] 3/5                        │
│  Did it pass?:                                           │
│  ○ Yes - completely   ○ Yes - mostly                     │
│  ○ Partially          ○ No (but I resisted anyway)       │
│  Notes: [______________________________________________] │
│                                                          │
│                                          [Log Urge]      │
└──────────────────────────────────────────────────────────┘
```

#### Relapse Log Entry — `/recovery/relapse`

```
┌──────────────────────────────────────────────────────────┐
│  Log Relapse                                             │
├──────────────────────────────────────────────────────────┤
│  Date: [today]    Time: [now]                           │
│  Duration: [______]  Trigger: [__________]              │
│  Location: [______]  Device: [______]                   │
│  Activity Before: [__________]                          │
│  Emotional State: [__________]                          │
│  Resistance Technique: [__________]                     │
│  Urge Intensity: [● ● ● ● ● ○ ○ ○ ○ ○] 5/10           │
│  Link to prior Urge entry?: [None ▼]                    │
│  Notes: [______________________________________________] │
│                                                          │
│                                        [Log Relapse]     │
└──────────────────────────────────────────────────────────┘
```

#### Interaction Behavior

- Both forms submit on button click. Success: form clears, brief success toast, user remains on the page (they may need to log another).
- Time defaults to current time. Date defaults to today. Both are editable.
- 24-hour edit window per ADR-006: after submission, entries show an "Edit" button that disappears after 24 hours from `created_at`. No delete capability.
- "Link to prior Urge entry" on Relapse form: dropdown populated from that day's urge entries. Optional.

---

### 5.8 Settings

**Route:** `/settings`  
**Purpose:** Configuration editor. Scoring parameters, habit manager, vice manager, data management.

#### Layout — Tabbed Sections

Settings is the one page that uses tabs, because sections are large enough that vertical scroll without tabs becomes unwieldy.

```
Tabs: [General] [Scoring] [Habits] [Vices] [Data]
```

**General:** App name display, start date.

**Scoring:**
- `target_fraction`, `vice_cap`, `streak_threshold`, `streak_bonus_per_day`, `max_streak_bonus`
- Category multipliers (Productivity, Health, Growth)
- Computed display (read-only): Max Weighted Score, Target Score
- All inputs validated on change. Invalid values shown inline with error message — not saved.

**Habits:**
- Table of active habits with columns: Name, Points, Category, Input Type, Active
- Edit inline. Add new habit via row at bottom of table.
- Retire: toggle `is_active`. Does not delete — column preserved in `daily_log`.
- Cannot retire last active habit in a category (validation).
- Reorder via drag handle (affects display order on Daily Log).

**Vices:**
- Table of vices with penalty values.
- Phone tier thresholds and penalties editable (`phone_t1_min`/`phone_t1_penalty`, etc.).
- Dropdown option lists editable (Meal Quality options, Social options — name/value pairs).

**Data:**
- Export: JSON dump of all tables. Triggers file save dialog.
- Import: JSON import. Warns that this will overwrite current data. Requires confirmation.
- Computed display: current DB file size, record counts per table.

---

## 6. Shared Component Library

Components used across multiple pages. Listed here to prevent duplicate implementation.

| Component | Used By | Description |
|-----------|---------|-------------|
| `DateNavigator` | Daily Log, Study Log, Weekly Review | Arrow nav with date display and picker |
| `ScoreGradient` | Daily Log (Score Strip), Analytics | Red→amber→green color utility |
| `DotRating` | Journal, Study Log, Recovery | 1–N dot rating input and display |
| `EmptyStateCard` | Analytics | Threshold-gated placeholder |
| `ExpandableRow` | App Log | Click-to-expand table row |
| `InlineForm` | Study Log, App Log | Form that expands inline rather than navigating |
| `ConfirmDialog` | Study Log (delete), Journal (unsaved changes) | Standard confirmation modal |
| `Toast` | Recovery (success) | Brief non-blocking notification |
| `StepperInput` | Daily Log (vice counts) | `[−] N [+]` numeric input |
| `StatusBadge` | App Log | Color-coded status pill |

---

## 7. State Architecture (UI Layer)

Per ADR-005: Zustand for UI state, TanStack Query for async DB state.

### Zustand Stores

**`useDateStore`**
```typescript
{
  selectedDate: string  // 'YYYY-MM-DD', defaults to today
  setSelectedDate: (date: string) => void
}
```
Consumed by: Daily Log, Journal, Date Navigator component.  
Not consumed by: Study Log, Weekly Review (own their own week cursor in local state).

**`useUIStore`**
```typescript
{
  recoveryNavExpanded: boolean
  toggleRecoveryNav: () => void
  analyticsWindow: 7 | 30 | 90 | 0    // 0 = all time
  setAnalyticsWindow: (w: 7 | 30 | 90 | 0) => void
}
```

### TanStack Query Key Hierarchy

```
['daily-log', date]                    → single DailyLog row
['daily-log-scores', date]             → computed scores for date
['journal', date]                      → journal entry for date
['study-sessions', weekStart]          → sessions for week
['applications']                       → all applications
['application', id]                    → single application with history
['weekly-review', weekStart]           → weekly review row
['relapse-entries', date]              → relapse entries for date
['urge-entries', date]                 → urge entries for date
['analytics', window, 'overview']      → overview section data
['analytics', window, 'trends']        → trends section data
['analytics', window, 'correlations']  → correlation engine data
['analytics', window, 'records']       → records section data
```

Mutations invalidate their own key plus any downstream keys. Daily log mutation also invalidates all `['analytics', ...]` keys — scores changed means analytics are stale.

---

## 8. Design Tokens

These values are the authoritative source for implementation. UI components must use these tokens — no hardcoded color literals in component code.

### Category Colors

| Token | Value | Use |
|-------|-------|-----|
| `color.productivity` | `#3D85C6` | Productivity section header, habit toggles |
| `color.health` | `#6AA84F` | Health section header, habit toggles |
| `color.growth` | `#8E7CC3` | Growth section header, habit toggles |
| `color.vice` | `#CC4125` | Vice section header, vice toggles, alerts |

### Score Gradient

Three-stop interpolation: `0.0 → #CC4125 (red)`, `0.5 → #FFD966 (amber)`, `1.0 → #6AA84F (green)`.  
Implemented as a utility function `scoreColor(value: number): string`. Used everywhere a score or percentage is displayed as a color.

### Structural Colors

| Token | Value | Use |
|-------|-------|-----|
| `color.surface.dark` | `#1F2937` | Sidebar background, page headers |
| `color.surface.kpi` | `#F0F4F8` | KPI card backgrounds |
| `color.surface.good` | `#D5F5E3` | Checked habit background |
| `color.surface.vice` | `#FADBD8` | Active vice background |
| `color.surface.inactive` | `#F8F9FA` | Unchecked habit background |
| `color.text.header` | `#FFFFFF` | Text on dark surfaces |
| `color.text.body` | `#1F2937` | Primary body text |
| `color.text.muted` | `#6B7280` | Secondary labels, subdued nav items |
| `color.streak.gold` | `#FFD700` | Streak counter at ≥ 7 days |

### Typography Scale

| Use | Size | Weight |
|-----|------|--------|
| KPI value | 20px | Bold |
| KPI label | 11px | Regular, `color.text.muted` |
| Section header | 13px | Semibold, category color |
| Body / form labels | 14px | Regular |
| Subdued nav item | 12px | Regular, `color.text.muted` |

### Spacing

Base unit: 4px. All spacing is multiples of 4px. Component padding: 16px. Section gap: 24px. Card gap: 12px.

---

*End of UI_SPEC.md — V2 Rebuild*
