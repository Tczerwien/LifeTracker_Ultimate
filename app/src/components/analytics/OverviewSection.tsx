import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useScoreTrend, useHabitCompletionRates } from '../../hooks/use-analytics';
import { useConfig } from '../../hooks/use-config';
import { scoreColor } from '../../lib/score-utils';
import { CATEGORY_COLORS, STREAK_GOLD } from '../../lib/constants';
import { MIN_ENTRIES } from '../../lib/analytics-utils';
import { HabitCategory } from '../../types/enums';
import type { AnalyticsWindow } from '../../stores/ui-store';
import type { ScoreTrendPoint } from '../../types/commands';
import EmptyStateCard from '../shared/EmptyStateCard';

// ---------------------------------------------------------------------------
// Streak helpers
// ---------------------------------------------------------------------------

function computeStreakStats(
  trend: ScoreTrendPoint[],
  threshold: number,
): { currentStreak: number; longestStreak: number } {
  let longest = 0;
  let streak = 0;

  for (const point of trend) {
    if (point.final_score >= threshold) {
      streak++;
      if (streak > longest) longest = streak;
    } else {
      streak = 0;
    }
  }

  return { currentStreak: streak, longestStreak: longest };
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string;
  color: string;
}

function KpiCard({ label, value, color }: KpiCardProps) {
  return (
    <div className="rounded-lg bg-surface-kpi p-component text-center">
      <div className="text-kpi-value font-bold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-kpi-label text-gray-500">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverviewSection
// ---------------------------------------------------------------------------

interface OverviewSectionProps {
  start: string;
  end: string;
  window: AnalyticsWindow;
}

export default function OverviewSection({
  start,
  end,
  window: analyticsWindow,
}: OverviewSectionProps) {
  const trendQuery = useScoreTrend(start, end);
  const completionQuery = useHabitCompletionRates(start, end);
  const configQuery = useConfig();

  const isLoading =
    trendQuery.isLoading || completionQuery.isLoading || configQuery.isLoading;
  const isError =
    trendQuery.isError || completionQuery.isError || configQuery.isError;

  const trend = trendQuery.data ?? [];
  const habits = completionQuery.data ?? [];
  const streakThreshold = configQuery.data?.streak_threshold ?? 0.65;

  const { avgScore, currentStreak, longestStreak, daysTracked } = useMemo(() => {
    if (trend.length === 0) {
      return { avgScore: 0, currentStreak: 0, longestStreak: 0, daysTracked: 0 };
    }
    const sum = trend.reduce((acc, p) => acc + p.final_score, 0);
    const avg = sum / trend.length;
    const streaks = computeStreakStats(trend, streakThreshold);
    return {
      avgScore: avg,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      daysTracked: trend.length,
    };
  }, [trend, streakThreshold]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyStateCard
        icon="⚠️"
        title="Could not load overview data"
        message="Try changing the time window or refreshing."
      />
    );
  }

  const minRequired = MIN_ENTRIES.overview[analyticsWindow];
  if (trend.length < minRequired) {
    return (
      <EmptyStateCard
        icon="📊"
        title="Not enough data yet"
        message={`Need at least ${minRequired} logged days for this view. You have ${daysTracked}.`}
      />
    );
  }

  const streakColor = currentStreak >= 7 ? STREAK_GOLD : scoreColor(Math.min(currentStreak / 7, 1));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="Avg Score"
          value={(avgScore * 100).toFixed(1) + '%'}
          color={scoreColor(avgScore)}
        />
        <KpiCard
          label="Current Streak"
          value={`${currentStreak}d`}
          color={streakColor}
        />
        <KpiCard
          label="Days Tracked"
          value={String(daysTracked)}
          color="#6B7280"
        />
        <KpiCard
          label="Best Streak"
          value={`${longestStreak}d`}
          color={STREAK_GOLD}
        />
      </div>

      {/* Habit Completion Chart */}
      {habits.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Habit Completion Rates
          </h3>
          <ResponsiveContainer width="100%" height={habits.length * 36 + 40}>
            <BarChart
              layout="vertical"
              data={habits}
              margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <YAxis
                type="category"
                dataKey="display_name"
                width={140}
                tick={{ fontSize: 12, fill: '#1F2937' }}
              />
              <Tooltip
                formatter={(v) => [`${(Number(v) * 100).toFixed(1)}%`, 'Completion']}
              />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                {habits.map((habit) => (
                  <Cell
                    key={habit.habit_name}
                    fill={
                      CATEGORY_COLORS[habit.category as HabitCategory] ?? '#6B7280'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
