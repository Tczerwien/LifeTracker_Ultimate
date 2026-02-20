import { useRef, useCallback } from 'react';
import type { WeeklyReview } from '../../types/models';
import type { WeeklyStats } from '../../types/commands';
import {
  addDays,
  formatWeekRange,
  getWeekStart,
  getWeekEnd,
  getISOWeekNumber,
  todayYMD,
  compareDates,
} from '../../lib/date-utils';
import WeeklyReviewForm from './WeeklyReviewForm';

interface WeeklyReviewShellProps {
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  review: WeeklyReview | null;
  liveStats: WeeklyStats;
}

export default function WeeklyReviewShell({
  weekStart,
  onWeekChange,
  review,
  liveStats,
}: WeeklyReviewShellProps) {
  const weekEnd = getWeekEnd(weekStart);
  const currentWeekStart = getWeekStart(todayYMD());
  const atCurrentWeek = compareDates(weekStart, currentWeekStart) >= 0;
  const previousWeekRef = useRef(weekStart);

  const goPrev = useCallback(() => {
    previousWeekRef.current = weekStart;
    onWeekChange(addDays(weekStart, -7));
  }, [weekStart, onWeekChange]);

  const goNext = useCallback(() => {
    previousWeekRef.current = weekStart;
    onWeekChange(addDays(weekStart, 7));
  }, [weekStart, onWeekChange]);

  const handleWeekRevert = useCallback(() => {
    onWeekChange(previousWeekRef.current);
  }, [onWeekChange]);

  return (
    <div className="p-section">
      {/* Week Navigator */}
      <div className="flex items-center justify-center gap-4 py-3">
        <button
          type="button"
          aria-label="Previous week"
          onClick={goPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
        >
          &#8592;
        </button>
        <div className="text-center">
          <span className="text-sm font-medium text-surface-dark">
            Week {getISOWeekNumber(weekStart)} &mdash;{' '}
            {formatWeekRange(weekStart, weekEnd)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Next week"
          disabled={atCurrentWeek}
          onClick={goNext}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          &#8594;
        </button>
      </div>

      <WeeklyReviewForm
        weekStart={weekStart}
        weekEnd={weekEnd}
        review={review}
        liveStats={liveStats}
        onWeekRevert={handleWeekRevert}
      />
    </div>
  );
}
