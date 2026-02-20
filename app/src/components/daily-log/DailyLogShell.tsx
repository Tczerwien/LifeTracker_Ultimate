import type { DailyLog } from '../../types/models';
import type { HabitConfig, AppConfig } from '../../types/models';
import { todayYMD, formatDisplayDate } from '../../lib/date-utils';
import DateNavigator from '../shared/DateNavigator';
import ScoreStrip from '../shared/ScoreStrip';
import HabitForm from './HabitForm';

interface DailyLogShellProps {
  date: string;
  dailyLog: DailyLog | null;
  habits: HabitConfig[];
  config: AppConfig;
}

export default function DailyLogShell({
  date,
  dailyLog,
  habits,
  config,
}: DailyLogShellProps) {
  const hasScores =
    dailyLog !== null &&
    dailyLog.final_score !== null &&
    dailyLog.base_score !== null &&
    dailyLog.streak !== null &&
    dailyLog.positive_score !== null &&
    dailyLog.vice_penalty !== null;

  const isPastDate = date < todayYMD();

  return (
    <div className="p-section">
      <DateNavigator minDate={config.start_date} hasLogEntry={dailyLog !== null} />

      {isPastDate && (
        <div className="mt-2 rounded-md bg-blue-50 px-3 py-1.5 text-center text-subdued text-blue-600">
          Viewing {formatDisplayDate(date)}
        </div>
      )}

      <div className="mt-4">
        {hasScores ? (
          <ScoreStrip
            finalScore={dailyLog.final_score!}
            baseScore={dailyLog.base_score!}
            streak={dailyLog.streak!}
            positiveScore={dailyLog.positive_score!}
            vicePenalty={dailyLog.vice_penalty!}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg bg-surface-kpi p-component">
            <span className="text-subdued text-gray-400">
              Scores appear after first habit toggle
            </span>
          </div>
        )}
      </div>

      <HabitForm date={date} dailyLog={dailyLog} habits={habits} config={config} />
    </div>
  );
}
