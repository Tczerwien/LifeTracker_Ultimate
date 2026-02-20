export const QUERY_KEYS = {
  // Daily Log
  dailyLog: (date: string) => ["daily-log", date] as const,
  dailyLogRange: (start: string, end: string) =>
    ["daily-log", "range", start, end] as const,
  dailyLogList: ["daily-log", "list"] as const,

  // Journal
  journal: (date: string) => ["journal", date] as const,

  // Scores & Streaks
  scoreTrend: (start: string, end: string) =>
    ["score-trend", start, end] as const,
  streakAtDate: (date: string) => ["streak-history", date] as const,

  // Habit Analytics
  habitCompletionRates: (start: string, end: string) =>
    ["habit-completion-rates", start, end] as const,
  viceFrequency: (start: string, end: string) =>
    ["vice-frequency", start, end] as const,
  dayOfWeekAverages: (start: string, end: string) =>
    ["day-of-week-averages", start, end] as const,
  correlationData: (start: string, end: string) =>
    ["correlation-data", start, end] as const,

  // Study Sessions
  studySessions: (date: string) => ["study-sessions", date] as const,
  studySessionsRange: (start: string, end: string) =>
    ["study-sessions", "range", start, end] as const,
  studySummary: (start: string, end: string) =>
    ["study-summary", start, end] as const,

  // Applications
  applications: ["applications"] as const,
  application: (id: number) => ["applications", id] as const,
  statusHistory: (appId: number) => ["status-history", appId] as const,
  applicationPipeline: ["application-pipeline"] as const,

  // Recovery
  relapseEntries: (start: string, end: string) =>
    ["relapse-entries", start, end] as const,
  urgeEntries: (start: string, end: string) =>
    ["urge-entries", start, end] as const,
  recoveryFrequency: (start: string, end: string) =>
    ["recovery-frequency", start, end] as const,

  // Weekly Review
  weeklyReview: (weekStart: string) => ["weekly-review", weekStart] as const,
  weeklyStats: (weekStart: string) => ["weekly-stats", weekStart] as const,

  // Config & Settings
  config: ["config"] as const,
  habitConfigs: ["habit-configs"] as const,

  // Milestones
  milestones: ["milestones"] as const,

  // Data Management
  dbStats: ["db-stats"] as const,
  dbPath: ["db-path"] as const,
} as const;

// ---------------------------------------------------------------------------
// Prefix Constants for Invalidation (ADR-005 SD3)
// ---------------------------------------------------------------------------
// Use with queryClient.invalidateQueries({ queryKey: PREFIX })
// to invalidate ALL queries sharing the prefix, regardless of parameters.

export const INVALIDATION_PREFIXES = {
  dailyLog: ["daily-log"] as const,
  journal: ["journal"] as const,
  scoreTrend: ["score-trend"] as const,
  streakHistory: ["streak-history"] as const,
  habitCompletionRates: ["habit-completion-rates"] as const,
  viceFrequency: ["vice-frequency"] as const,
  dayOfWeekAverages: ["day-of-week-averages"] as const,
  correlationData: ["correlation-data"] as const,
  studySessions: ["study-sessions"] as const,
  studySummary: ["study-summary"] as const,
  applications: ["applications"] as const,
  statusHistory: ["status-history"] as const,
  applicationPipeline: ["application-pipeline"] as const,
  relapseEntries: ["relapse-entries"] as const,
  urgeEntries: ["urge-entries"] as const,
  recoveryFrequency: ["recovery-frequency"] as const,
  weeklyReview: ["weekly-review"] as const,
  weeklyStats: ["weekly-stats"] as const,
  milestones: ["milestones"] as const,
} as const;
