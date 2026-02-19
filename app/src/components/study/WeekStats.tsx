import type { StudySession } from '../../types/models';

interface WeekStatsProps {
  sessions: StudySession[];
}

export default function WeekStats({ sessions }: WeekStatsProps) {
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalHours = totalMinutes / 60;
  const sessionCount = sessions.length;
  const avgFocus =
    sessionCount > 0
      ? sessions.reduce((sum, s) => sum + s.focus_score, 0) / sessionCount
      : 0;

  return (
    <div className="mt-4 grid grid-cols-3 gap-4">
      <div className="rounded-lg bg-surface-kpi px-4 py-3 text-center">
        <p className="text-kpi-value font-semibold text-productivity">
          {totalHours.toFixed(1)}h
        </p>
        <p className="text-kpi-label text-gray-500">Total Hours</p>
      </div>

      <div className="rounded-lg bg-surface-kpi px-4 py-3 text-center">
        <p className="text-kpi-value font-semibold text-productivity">
          {sessionCount}
        </p>
        <p className="text-kpi-label text-gray-500">Sessions</p>
      </div>

      <div className="rounded-lg bg-surface-kpi px-4 py-3 text-center">
        <p className="text-kpi-value font-semibold text-productivity">
          {sessionCount > 0 ? avgFocus.toFixed(1) : '—'}/5
        </p>
        <p className="text-kpi-label text-gray-500">Avg Focus</p>
      </div>
    </div>
  );
}
