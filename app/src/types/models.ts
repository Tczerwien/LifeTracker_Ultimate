import {
  HabitPool,
  HabitCategory,
  InputType,
  PenaltyMode,
  ApplicationStatus,
  CorrelationWindow,
} from './enums';

// ---------------------------------------------------------------------------
// Milestone category (DATA_MODEL.md Section 3.11)
// ---------------------------------------------------------------------------

export type MilestoneCategory = 'score' | 'clean' | 'study' | 'tracking';

// ---------------------------------------------------------------------------
// 1. HabitConfig (DATA_MODEL.md Section 3.1)
// ---------------------------------------------------------------------------

export interface HabitConfig {
  id: number;
  name: string;
  display_name: string;
  pool: HabitPool;
  category: HabitCategory | null;
  input_type: InputType;
  points: number;
  penalty: number;
  penalty_mode: PenaltyMode;
  options_json: string | null;
  sort_order: number;
  is_active: boolean;
  column_name: string;
  created_at: string;
  retired_at: string | null;
}

// ---------------------------------------------------------------------------
// 2. DailyLog (DATA_MODEL.md Section 3.2)
// ---------------------------------------------------------------------------

export interface DailyLog {
  id: number;
  date: string;

  // Productivity habits
  schoolwork: number;
  personal_project: number;
  classes: number;
  job_search: number;

  // Health habits
  gym: number;
  sleep_7_9h: number;
  wake_8am: number;
  supplements: number;
  meal_quality: string;
  stretching: number;

  // Growth habits
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

  // Computed scores (null if not yet scored)
  positive_score: number | null;
  vice_penalty: number | null;
  base_score: number | null;
  streak: number | null;
  final_score: number | null;

  // Timestamps
  logged_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 3. Journal (DATA_MODEL.md Section 3.3)
// ---------------------------------------------------------------------------

export interface Journal {
  id: number;
  date: string;
  mood: number;
  energy: number;
  highlight: string;
  gratitude: string;
  reflection: string;
  tomorrow_goal: string;
  logged_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 4. StudySession (DATA_MODEL.md Section 3.4)
// ---------------------------------------------------------------------------

export interface StudySession {
  id: number;
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
  logged_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 5. Application (DATA_MODEL.md Section 3.5)
// ---------------------------------------------------------------------------

export interface Application {
  id: number;
  date_applied: string;
  company: string;
  role: string;
  source: string;
  current_status: ApplicationStatus;
  url: string;
  notes: string;
  follow_up_date: string | null;
  salary: string;
  contact_name: string;
  contact_email: string;
  login_username: string;
  login_password: string;
  archived: boolean;
  logged_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 6. StatusChange (DATA_MODEL.md Section 3.6) — append-only
// ---------------------------------------------------------------------------

export interface StatusChange {
  id: number;
  application_id: number;
  status: ApplicationStatus;
  date: string;
  notes: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 7. RelapseEntry (DATA_MODEL.md Section 3.7)
// ---------------------------------------------------------------------------

export interface RelapseEntry {
  id: number;
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
  created_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 8. UrgeEntry (DATA_MODEL.md Section 3.8)
// ---------------------------------------------------------------------------

export interface UrgeEntry {
  id: number;
  date: string;
  time: string;
  intensity: number;
  technique: string;
  effectiveness: number;
  duration: string;
  did_pass: string;
  trigger: string;
  notes: string;
  created_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 9. WeeklyReview (DATA_MODEL.md Section 3.9)
// ---------------------------------------------------------------------------

export interface WeeklyReview {
  id: number;
  week_start: string;
  week_end: string;
  week_number: number;

  // Auto-computed stats (null before save)
  avg_score: number | null;
  days_tracked: number | null;
  best_day_score: number | null;
  worst_day_score: number | null;
  habits_completed: number | null;
  study_hours: number | null;
  applications_sent: number | null;
  relapses: number | null;
  urges_resisted: number | null;
  streak_at_end: number | null;

  // Manual reflection
  biggest_win: string;
  biggest_challenge: string;
  next_week_goal: string;
  reflection: string;

  // Snapshot data
  snapshot_date: string | null;
  score_snapshot: string | null;

  // Timestamps
  logged_at: string;
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 10. AppConfig (DATA_MODEL.md Section 3.10) — singleton, id='default'
// ---------------------------------------------------------------------------

export interface AppConfig {
  id: string;
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
  last_modified: string;
}

// ---------------------------------------------------------------------------
// 11. Milestone (DATA_MODEL.md Section 3.11)
// ---------------------------------------------------------------------------

export interface Milestone {
  id: string;
  name: string;
  emoji: string;
  category: MilestoneCategory;
  threshold: string;
  achieved: boolean;
  achieved_date: string | null;
  created_at: string;
}
