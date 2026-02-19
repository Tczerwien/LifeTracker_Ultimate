export const QUERY_KEYS = {
  // Daily Log
  dailyLog: (date: string) => ['daily-log', date] as const,
  dailyLogList: ['daily-log', 'list'] as const,

  // Journal
  journal: (date: string) => ['journal', date] as const,

  // Scores & Streaks
  scoreTrend: ['score-trend'] as const,
  streakHistory: ['streak-history'] as const,

  // Habit Analytics
  habitCompletionRates: ['habit-completion-rates'] as const,
  viceFrequency: ['vice-frequency'] as const,
  dayOfWeekAverages: ['day-of-week-averages'] as const,
  correlationData: ['correlation-data'] as const,

  // Study Sessions
  studySessions: (date: string) => ['study-sessions', date] as const,
  studySessionsRange: ['study-sessions', 'range'] as const,
  studySummary: ['study-summary'] as const,

  // Applications
  applications: ['applications'] as const,
  application: (id: number) => ['applications', id] as const,
  statusHistory: (appId: number) => ['status-history', appId] as const,
  applicationPipeline: ['application-pipeline'] as const,

  // Recovery
  relapseEntries: (date: string) => ['relapse-entries', date] as const,
  urgeEntries: (date: string) => ['urge-entries', date] as const,
  recoveryFrequency: ['recovery-frequency'] as const,

  // Weekly Review
  weeklyReview: (weekStart: string) => ['weekly-review', weekStart] as const,
  weeklyStats: (weekStart: string) => ['weekly-stats', weekStart] as const,

  // Config & Settings
  config: ['config'] as const,
  habitConfigs: ['habit-configs'] as const,

  // Milestones
  milestones: ['milestones'] as const,

  // Data Management
  dbStats: ['db-stats'] as const,
} as const;
