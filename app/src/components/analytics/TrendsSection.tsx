import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useScoreTrend,
  useDayOfWeekAverages,
  useViceFrequency,
} from '../../hooks/use-analytics';
import { scoreColor } from '../../lib/score-utils';
import { VICE_COLOR } from '../../lib/constants';
import {
  MIN_ENTRIES,
  DAY_ORDER,
  DAY_LABELS,
  formatShortDate,
} from '../../lib/analytics-utils';
import type { DayOfWeekAvg } from '../../types/commands';
import EmptyStateCard from '../shared/EmptyStateCard';

// ---------------------------------------------------------------------------
// Day-of-week heatmap
// ---------------------------------------------------------------------------

function DayOfWeekHeatmap({ data }: { data: DayOfWeekAvg[] }) {
  return (
    <div className="flex items-end gap-2">
      {DAY_ORDER.map((dayIndex, i) => {
        const dayData = data.find((d) => d.day === dayIndex);
        const avg = dayData?.avg_score ?? 0;
        const count = dayData?.count ?? 0;
        const label = DAY_LABELS[i] ?? '';

        return (
          <div key={dayIndex} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded"
              style={{
                backgroundColor: count > 0 ? scoreColor(avg) : '#F3F4F6',
                height: '48px',
                opacity: count > 0 ? 0.5 + avg * 0.5 : 0.3,
              }}
              title={`${label}: ${count > 0 ? avg.toFixed(2) : 'No data'} (${count} days)`}
            />
            <span className="text-kpi-label text-gray-500">{label}</span>
            {count > 0 && (
              <span
                className="text-kpi-label font-medium"
                style={{ color: scoreColor(avg) }}
              >
                {avg.toFixed(2)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrendsSection
// ---------------------------------------------------------------------------

interface TrendsSectionProps {
  start: string;
  end: string;
}

export default function TrendsSection({ start, end }: TrendsSectionProps) {
  const trendQuery = useScoreTrend(start, end);
  const dowQuery = useDayOfWeekAverages(start, end);
  const viceQuery = useViceFrequency(start, end);

  const isLoading =
    trendQuery.isLoading || dowQuery.isLoading || viceQuery.isLoading;
  const isError = trendQuery.isError || dowQuery.isError || viceQuery.isError;

  const trend = trendQuery.data ?? [];
  const dowData = dowQuery.data ?? [];
  const viceData = viceQuery.data ?? [];

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-72 rounded-lg bg-gray-100" />
        <div className="h-20 rounded-lg bg-gray-100" />
        <div className="h-48 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyStateCard
        icon="⚠️"
        title="Could not load trend data"
        message="Try changing the time window or refreshing."
      />
    );
  }

  if (trend.length < MIN_ENTRIES.trends) {
    return (
      <EmptyStateCard
        icon="📈"
        title="Not enough data for trends"
        message={`Need at least ${MIN_ENTRIES.trends} logged days. You have ${trend.length}.`}
      />
    );
  }

  // Compute vice rate for bar chart display
  const viceRates = viceData.map((v) => ({
    ...v,
    rate: v.total_days > 0 ? v.frequency / v.total_days : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Score Trend Line Chart */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Score Trend
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend}>
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fontSize: 12, fill: '#6B7280' }}
            />
            <Tooltip
              labelFormatter={(label) => formatShortDate(String(label))}
              formatter={(v, name) => [
                Number(v).toFixed(3),
                name === 'final_score' ? 'Score' : '7d Avg',
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === 'final_score' ? 'Daily Score' : '7-Day Average'
              }
            />
            <Line
              type="monotone"
              dataKey="final_score"
              stroke="#3D85C6"
              strokeWidth={2}
              dot={false}
              name="final_score"
            />
            <Line
              type="monotone"
              dataKey="moving_avg_7d"
              stroke="#8E7CC3"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              connectNulls
              name="moving_avg_7d"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Day-of-Week Heatmap */}
      {dowData.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Average Score by Day of Week
          </h3>
          <DayOfWeekHeatmap data={dowData} />
        </div>
      )}

      {/* Vice Frequency */}
      {viceRates.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Vice Frequency
          </h3>
          <ResponsiveContainer width="100%" height={viceRates.length * 36 + 40}>
            <BarChart
              layout="vertical"
              data={viceRates}
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
                formatter={(v) => [
                  `${(Number(v) * 100).toFixed(1)}%`,
                  'Frequency',
                ]}
              />
              <Bar dataKey="rate" fill={VICE_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
