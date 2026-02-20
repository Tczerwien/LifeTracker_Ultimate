import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useStudySummary,
  useApplicationPipeline,
  useRecoveryFrequency,
} from '../../hooks/use-analytics';
import { APPLICATION_STATUS_DISPLAY, VICE_COLOR } from '../../lib/constants';
import { ApplicationStatus } from '../../types/enums';
import { formatShortDate } from '../../lib/analytics-utils';
import type { PipelineStage } from '../../types/commands';
import EmptyStateCard from '../shared/EmptyStateCard';

// ---------------------------------------------------------------------------
// Pipeline order and data prep
// ---------------------------------------------------------------------------

const PIPELINE_ORDER: ApplicationStatus[] = [
  ApplicationStatus.Applied,
  ApplicationStatus.PhoneScreen,
  ApplicationStatus.TechnicalScreen,
  ApplicationStatus.Interview,
  ApplicationStatus.Offer,
  ApplicationStatus.Rejected,
  ApplicationStatus.Withdrawn,
  ApplicationStatus.NoResponse,
];

function buildPipelineRow(
  stages: PipelineStage[],
): Record<string, number | string> {
  const row: Record<string, number | string> = { name: 'Applications' };
  for (const status of PIPELINE_ORDER) {
    const stage = stages.find((s) => s.status === status);
    row[status] = stage?.count ?? 0;
  }
  return row;
}

function hasPipelineData(stages: PipelineStage[]): boolean {
  return stages.some((s) => s.count > 0);
}

// ---------------------------------------------------------------------------
// RecordsSection
// ---------------------------------------------------------------------------

interface RecordsSectionProps {
  start: string;
  end: string;
}

export default function RecordsSection({ start, end }: RecordsSectionProps) {
  const studyQuery = useStudySummary(start, end);
  const pipelineQuery = useApplicationPipeline();
  const recoveryQuery = useRecoveryFrequency(start, end);

  const isLoading =
    studyQuery.isLoading || pipelineQuery.isLoading || recoveryQuery.isLoading;
  const isError =
    studyQuery.isError || pipelineQuery.isError || recoveryQuery.isError;

  const study = studyQuery.data;
  const pipeline = pipelineQuery.data;
  const recovery = recoveryQuery.data;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 rounded-lg bg-gray-100" />
        <div className="h-24 rounded-lg bg-gray-100" />
        <div className="h-48 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyStateCard
        icon="⚠️"
        title="Could not load records data"
        message="Try changing the time window or refreshing."
      />
    );
  }

  const hasStudy = study !== undefined && study.session_count >= 1;
  const hasPipeline =
    pipeline !== undefined && hasPipelineData(pipeline.stages);
  const hasRecovery =
    recovery !== undefined &&
    (recovery.relapse_count >= 1 || recovery.urge_count >= 1);

  if (!hasStudy && !hasPipeline && !hasRecovery) {
    return (
      <EmptyStateCard
        icon="📋"
        title="No records yet"
        message="Log study sessions, applications, or recovery entries to see data here."
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Study Hours by Subject */}
      {hasStudy && study !== undefined && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Study Hours by Subject
          </h3>
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-kpi p-component text-center">
              <div className="text-kpi-value font-bold text-gray-800">
                {study.total_hours.toFixed(1)}
              </div>
              <div className="mt-1 text-kpi-label text-gray-500">
                Total Hours
              </div>
            </div>
            <div className="rounded-lg bg-surface-kpi p-component text-center">
              <div className="text-kpi-value font-bold text-gray-800">
                {study.session_count}
              </div>
              <div className="mt-1 text-kpi-label text-gray-500">Sessions</div>
            </div>
            <div className="rounded-lg bg-surface-kpi p-component text-center">
              <div className="text-kpi-value font-bold text-gray-800">
                {study.avg_focus.toFixed(1)}
              </div>
              <div className="mt-1 text-kpi-label text-gray-500">Avg Focus</div>
            </div>
          </div>
          {study.hours_by_subject.length > 0 && (
            <ResponsiveContainer
              width="100%"
              height={study.hours_by_subject.length * 36 + 40}
            >
              <BarChart
                layout="vertical"
                data={study.hours_by_subject}
                margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `${v.toFixed(1)}h`}
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <YAxis
                  type="category"
                  dataKey="subject"
                  width={120}
                  tick={{ fontSize: 12, fill: '#1F2937' }}
                />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)} hours`, 'Hours']}
                />
                <Bar dataKey="hours" fill="#3D85C6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Application Pipeline */}
      {hasPipeline && pipeline !== undefined && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Application Pipeline
          </h3>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart
              layout="vertical"
              data={[buildPipelineRow(pipeline.stages)]}
              margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12, fill: '#1F2937' }}
              />
              <Tooltip />
              {PIPELINE_ORDER.map((status) => (
                <Bar
                  key={status}
                  dataKey={status}
                  stackId="pipeline"
                  fill={APPLICATION_STATUS_DISPLAY[status].color}
                  name={APPLICATION_STATUS_DISPLAY[status].label}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recovery Frequency */}
      {hasRecovery && recovery !== undefined && recovery.weekly_data.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Recovery Frequency (Weekly)
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={recovery.weekly_data}>
              <XAxis
                dataKey="week_start"
                tickFormatter={formatShortDate}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
              />
              <Tooltip labelFormatter={(label) => formatShortDate(String(label))} />
              <Line
                type="monotone"
                dataKey="relapses"
                stroke={VICE_COLOR}
                strokeWidth={2}
                dot={false}
                name="Relapses"
              />
              <Line
                type="monotone"
                dataKey="urges"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                name="Urges"
              />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
