import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DailyLog, HabitConfig, AppConfig } from '../../../types/models';
import { HabitPool, HabitCategory, InputType, PenaltyMode } from '../../../types/enums';
import DailyLogShell from '../DailyLogShell';

// Mock date-utils to control "today"
vi.mock('../../../lib/date-utils', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/date-utils')>('../../../lib/date-utils');
  return {
    ...actual,
    todayYMD: () => '2026-02-18',
  };
});

// Mock shared components to simplify testing
vi.mock('../../shared/DateNavigator', () => ({
  default: () => <div data-testid="date-navigator">DateNavigator</div>,
}));
vi.mock('../../shared/ScoreStrip', () => ({
  default: ({ finalScore }: { finalScore: number }) => <div data-testid="score-strip">Score: {finalScore}</div>,
}));
vi.mock('../HabitForm', () => ({
  default: () => <div data-testid="habit-form">HabitForm</div>,
}));

const mockConfig: AppConfig = {
  id: 'default',
  start_date: '2026-01-20',
  multiplier_productivity: 1.5,
  multiplier_health: 1.3,
  multiplier_growth: 1.0,
  target_fraction: 0.85,
  vice_cap: 0.40,
  streak_threshold: 0.65,
  streak_bonus_per_day: 0.01,
  max_streak_bonus: 0.10,
  phone_t1_min: 61, phone_t2_min: 181, phone_t3_min: 301,
  phone_t1_penalty: 0.03, phone_t2_penalty: 0.07, phone_t3_penalty: 0.12,
  correlation_window_days: 90,
  dropdown_options: '{}',
  last_modified: '2026-01-20T00:00:00Z',
};

const habits: HabitConfig[] = [
  {
    id: 1, name: 'schoolwork', display_name: 'Schoolwork', column_name: 'schoolwork',
    pool: HabitPool.Good, category: HabitCategory.Productivity, input_type: InputType.Checkbox,
    points: 3, penalty: 0, penalty_mode: PenaltyMode.Flat, options_json: null,
    sort_order: 1, is_active: true, created_at: '2026-01-20T00:00:00Z', retired_at: null,
  },
];

const mockDailyLog: DailyLog = {
  id: 1, date: '2026-02-18',
  schoolwork: 1, personal_project: 0, classes: 0, job_search: 0,
  gym: 0, sleep_7_9h: 0, wake_8am: 0, supplements: 0,
  meal_quality: 'None', stretching: 0,
  meditate: 0, read: 0, social: 'None',
  porn: 0, masturbate: 0, weed: 0, skip_class: 0,
  binged_content: 0, gaming_1h: 0, past_12am: 0, late_wake: 0, phone_use: 0,
  positive_score: 0.5, vice_penalty: 0.0, base_score: 0.5, streak: 1, final_score: 0.5,
  logged_at: '2026-02-18T22:00:00Z',
  last_modified: '2026-02-18T22:00:00Z',
};

describe('DailyLogShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders score placeholder when dailyLog is null', () => {
    render(
      <DailyLogShell date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />,
    );
    expect(screen.getByText('Scores appear after first habit toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('score-strip')).not.toBeInTheDocument();
  });

  it('renders ScoreStrip when scores are present', () => {
    render(
      <DailyLogShell date="2026-02-18" dailyLog={mockDailyLog} habits={habits} config={mockConfig} />,
    );
    expect(screen.getByTestId('score-strip')).toBeInTheDocument();
    expect(screen.queryByText('Scores appear after first habit toggle')).not.toBeInTheDocument();
  });

  it('renders past-date banner for past dates', () => {
    // todayYMD mocked to '2026-02-18', so '2026-02-16' is in the past
    render(
      <DailyLogShell date="2026-02-16" dailyLog={null} habits={habits} config={mockConfig} />,
    );
    expect(screen.getByText(/Viewing/)).toBeInTheDocument();
    // formatDisplayDate should produce a human-readable date
    expect(screen.getByText(/February 16, 2026/)).toBeInTheDocument();
  });

  it('does not render past-date banner for today', () => {
    render(
      <DailyLogShell date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />,
    );
    expect(screen.queryByText(/Viewing/)).not.toBeInTheDocument();
  });

  it('renders DateNavigator and HabitForm', () => {
    render(
      <DailyLogShell date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />,
    );
    expect(screen.getByTestId('date-navigator')).toBeInTheDocument();
    expect(screen.getByTestId('habit-form')).toBeInTheDocument();
  });
});
