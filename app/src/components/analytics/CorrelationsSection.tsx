import { useMemo } from 'react';
import { useCorrelationData } from '../../hooks/use-analytics';
import { useConfig, useHabitConfigs } from '../../hooks/use-config';
import { computeCorrelations } from '../../engine/correlation';
import { MIN_ENTRIES } from '../../lib/analytics-utils';
import type { DailyLogRow, CorrelationResult } from '../../types/engine';
import EmptyStateCard from '../shared/EmptyStateCard';

// ---------------------------------------------------------------------------
// Correlation color by strength
// ---------------------------------------------------------------------------

function correlationColor(r: number | null): string {
  if (r === null) return '#9CA3AF';
  if (r > 0.5) return '#6AA84F';
  if (r > 0.2) return '#3D85C6';
  if (r > -0.2) return '#6B7280';
  if (r > -0.5) return '#F59E0B';
  return '#CC4125';
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  title: string;
  items: CorrelationResult[];
  getDisplayName: (name: string) => string;
  color: string;
}

function SummaryCard({ title, items, getDisplayName, color }: SummaryCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg bg-surface-kpi p-component">
      <div className="mb-2 text-kpi-label font-medium text-gray-500">
        {title}
      </div>
      {items.map((item) => (
        <div
          key={item.habit}
          className="flex items-center justify-between py-1"
        >
          <span className="text-body text-gray-800">
            {getDisplayName(item.habit)}
          </span>
          <span className="text-body font-medium" style={{ color }}>
            r = {item.r !== null ? item.r.toFixed(3) : '--'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CorrelationsSection
// ---------------------------------------------------------------------------

interface CorrelationsSectionProps {
  start: string;
  end: string;
}

export default function CorrelationsSection({
  start,
  end,
}: CorrelationsSectionProps) {
  const correlationQuery = useCorrelationData(start, end);
  const habitConfigsQuery = useHabitConfigs();
  const configQuery = useConfig();

  const isLoading =
    correlationQuery.isLoading ||
    habitConfigsQuery.isLoading ||
    configQuery.isLoading;
  const isError =
    correlationQuery.isError ||
    habitConfigsQuery.isError ||
    configQuery.isError;

  const rawLogs = correlationQuery.data ?? [];
  const habitConfigs = habitConfigsQuery.data ?? [];

  // Build display name map
  const displayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of habitConfigs) {
      map.set(h.name, h.display_name);
    }
    return map;
  }, [habitConfigs]);

  const getDisplayName = (name: string) => displayNameMap.get(name) ?? name;

  // Compute correlations client-side (ADR-003 SD2)
  const results = useMemo(() => {
    if (rawLogs.length === 0 || habitConfigs.length === 0) return [];
    // DailyLog is a structural superset of DailyLogRow — safe to pass directly
    return computeCorrelations(rawLogs as unknown as DailyLogRow[], habitConfigs);
  }, [rawLogs, habitConfigs]);

  // Top 3 positive / negative
  const { positives, negatives } = useMemo(() => {
    const withValues = results.filter(
      (r): r is CorrelationResult & { r: number } => r.r !== null,
    );
    const pos = withValues.filter((r) => r.r > 0).slice(0, 3);
    const neg = withValues
      .filter((r) => r.r < 0)
      .sort((a, b) => a.r - b.r)
      .slice(0, 3);
    return { positives: pos, negatives: neg };
  }, [results]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-lg bg-gray-100" />
          <div className="h-24 rounded-lg bg-gray-100" />
        </div>
        <div className="h-48 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyStateCard
        icon="⚠️"
        title="Could not load correlation data"
        message="Try changing the time window or refreshing."
      />
    );
  }

  if (rawLogs.length < MIN_ENTRIES.correlations) {
    return (
      <EmptyStateCard
        icon="🔗"
        title="Not enough data for correlations"
        message={`Need at least ${MIN_ENTRIES.correlations} logged days. You have ${rawLogs.length}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {(positives.length > 0 || negatives.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            title="Top Positive Correlators"
            items={positives}
            getDisplayName={getDisplayName}
            color="#6AA84F"
          />
          <SummaryCard
            title="Top Negative Correlators"
            items={negatives}
            getDisplayName={getDisplayName}
            color="#CC4125"
          />
        </div>
      )}

      {/* Correlation Table */}
      {results.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            All Habit Correlations
          </h3>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-2 text-xs font-medium text-gray-500">
                  Habit
                </th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">
                  r
                </th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">
                  n
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.habit}
                  className="border-b border-gray-50"
                >
                  <td className="py-2 text-sm text-gray-800">
                    {getDisplayName(result.habit)}
                    {result.flag === 'zero_variance' && (
                      <span className="ml-2 text-xs text-gray-400">
                        (no variance)
                      </span>
                    )}
                    {result.flag === 'insufficient_data' && (
                      <span className="ml-2 text-xs text-gray-400">
                        (insufficient data)
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-sm font-medium">
                    <span style={{ color: correlationColor(result.r) }}>
                      {result.r !== null ? result.r.toFixed(3) : '--'}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-gray-400">
                    {result.n}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
