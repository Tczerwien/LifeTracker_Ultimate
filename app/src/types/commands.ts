// ---------------------------------------------------------------------------
// IPC Input Types — mirror Rust command input structs field-for-field
// ---------------------------------------------------------------------------

import type { CorrelationWindow } from './enums';

// ---------------------------------------------------------------------------
// Daily Log
// ---------------------------------------------------------------------------

/** Input for save_daily_log. Matches Rust DailyLogInput. */
export interface DailyLogInput {
  date: string;

  // Productivity
  schoolwork: number;
  personal_project: number;
  classes: number;
  job_search: number;

  // Health
  gym: number;
  sleep_7_9h: number;
  wake_8am: number;
  supplements: number;
  meal_quality: string;
  stretching: number;

  // Growth
  meditate: number;
  read: number;
  social: string;

  // Vices
  porn: number;
  masturbate: number;
  weed: number;
  skip_class: number;
  binged_content: number;
  gaming_1h: number;
  past_12am: number;
  late_wake: number;
  phone_use: number;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

/** Input for save_journal. Matches Rust JournalInput. */
export interface JournalInput {
  date: string;
  mood: number;
  energy: number;
  highlight: string;
  gratitude: string;
  reflection: string;
  tomorrow_goal: string;
}

// ---------------------------------------------------------------------------
// Study Sessions
// ---------------------------------------------------------------------------

/** Input for save_study_session / update_study_session. Matches Rust StudySessionInput. */
export interface StudySessionInput {
  date: string;
  subject: string;
  study_type: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  focus_score: number;
  location: string;
  topic: string;
  resources: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/** Input for save_application / update_application. Matches Rust ApplicationInput. */
export interface ApplicationInput {
  date_applied: string;
  company: string;
  role: string;
  source: string;
  url: string;
  notes: string;
  follow_up_date: string | null;
  salary: string;
  contact_name: string;
  contact_email: string;
  login_username: string;
  login_password: string;
}

/** Filter parameters for get_applications. Matches Rust AppFilters. */
export interface AppFilters {
  status?: string[];
  search?: string;
  include_archived?: boolean;
}

/** Input for add_status_change. Matches Rust StatusChangeInput. */
export interface StatusChangeInput {
  status: string;
  changed_date: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

/** Input for save_relapse_entry / update_relapse_entry. Matches Rust RelapseEntryInput. */
export interface RelapseEntryInput {
  date: string;
  time: string;
  duration: string;
  trigger: string;
  location: string;
  device: string;
  activity_before: string;
  emotional_state: string;
  resistance_technique: string;
  urge_intensity: number;
  notes: string;
  urge_entry_id: number | null;
}

/** Input for save_urge_entry / update_urge_entry. Matches Rust UrgeEntryInput. */
export interface UrgeEntryInput {
  date: string;
  time: string;
  intensity: number;
  technique: string;
  effectiveness: number;
  duration: string;
  did_pass: string;
  trigger: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Config & Habits
// ---------------------------------------------------------------------------

/** Input for save_config. Matches Rust AppConfigInput. */
export interface AppConfigInput {
  start_date: string;
  multiplier_productivity: number;
  multiplier_health: number;
  multiplier_growth: number;
  target_fraction: number;
  vice_cap: number;
  streak_threshold: number;
  streak_bonus_per_day: number;
  max_streak_bonus: number;
  phone_t1_min: number;
  phone_t2_min: number;
  phone_t3_min: number;
  phone_t1_penalty: number;
  phone_t2_penalty: number;
  phone_t3_penalty: number;
  correlation_window_days: CorrelationWindow;
  dropdown_options: string;
}

/**
 * Input for save_habit_config. Matches Rust HabitConfigInput.
 * Named differently from the validation-only HabitConfigInput in engine.ts.
 */
export interface HabitConfigSaveInput {
  id: number | null;
  name: string;
  display_name: string;
  pool: string;
  category: string | null;
  input_type: string;
  points: number;
  penalty: number;
  penalty_mode: string;
  options_json: string | null;
  sort_order: number;
  is_active: boolean;
  column_name: string;
}

// ---------------------------------------------------------------------------
// Weekly Review
// ---------------------------------------------------------------------------

/** Input for save_weekly_review. Matches Rust WeeklyReviewInput. */
export interface WeeklyReviewInput {
  week_start: string;
  week_end: string;
  week_number: number;
  biggest_win: string;
  biggest_challenge: string;
  next_week_goal: string;
  reflection: string;
}

/** Live-computed weekly stats returned by compute_weekly_stats. Matches Rust WeeklyStats. */
export interface WeeklyStats {
  avg_score: number | null;
  days_tracked: number;
  best_day_score: number | null;
  worst_day_score: number | null;
  total_study_hours: number;
  applications_sent: number;
  relapses: number;
  urges_resisted: number;
  current_streak: number | null;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/** Context for check_milestones. Matches Rust MilestoneContext. */
export interface MilestoneContext {
  current_streak: number;
  total_days_tracked: number;
  total_study_hours: number;
  total_applications: number;
  consecutive_clean_days: number;
  highest_score: number;
  avg_score_7d: number;
  high_focus_sessions: number;
}

// ---------------------------------------------------------------------------
// Analytics Return Types
// ---------------------------------------------------------------------------

/** Score trend data point. Matches Rust ScoreTrendPoint. */
export interface ScoreTrendPoint {
  date: string;
  final_score: number;
  moving_avg_7d: number | null;
}

/** Habit completion rate. Matches Rust HabitCompletionRate. */
export interface HabitCompletionRate {
  habit_name: string;
  display_name: string;
  category: string;
  rate: number;
  days_completed: number;
  total_days: number;
}

/** Vice frequency data. Matches Rust ViceFrequency. */
export interface ViceFrequency {
  vice_name: string;
  display_name: string;
  frequency: number;
  total_days: number;
}

/** Day of week average. Matches Rust DayOfWeekAvg. */
export interface DayOfWeekAvg {
  day: number;
  avg_score: number;
  count: number;
}

/** Study summary. Matches Rust StudySummary. */
export interface StudySummary {
  total_hours: number;
  session_count: number;
  avg_focus: number;
  hours_by_subject: SubjectHours[];
}

/** Subject hours breakdown. Matches Rust SubjectHours. */
export interface SubjectHours {
  subject: string;
  hours: number;
}

/** Application pipeline summary. Matches Rust PipelineSummary. */
export interface PipelineSummary {
  stages: PipelineStage[];
}

/** Pipeline stage. Matches Rust PipelineStage. */
export interface PipelineStage {
  status: string;
  count: number;
}

/** Recovery frequency data. Matches Rust RecoveryFrequency. */
export interface RecoveryFrequency {
  relapse_count: number;
  urge_count: number;
  urges_resisted: number;
  weekly_data: WeeklyRecoveryData[];
}

/** Weekly recovery breakdown. Matches Rust WeeklyRecovery. */
export interface WeeklyRecoveryData {
  week_start: string;
  relapses: number;
  urges: number;
  urges_resisted: number;
}

// ---------------------------------------------------------------------------
// Data Management
// ---------------------------------------------------------------------------

/** Test data generation summary. Matches Rust TestDataSummary. */
export interface TestDataSummary {
  daily_logs: number;
  journals: number;
  study_sessions: number;
  applications: number;
  relapse_entries: number;
  urge_entries: number;
  weekly_reviews: number;
}

/** Database statistics. Matches Rust DbStats. */
export interface DbStats {
  file_size_bytes: number;
  table_counts: TableCount[];
}

/** Individual table count. Matches Rust TableCount. */
export interface TableCount {
  table_name: string;
  count: number;
}
