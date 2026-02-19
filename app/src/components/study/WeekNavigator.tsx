import { formatWeekRange } from '../../lib/date-utils';

interface WeekNavigatorProps {
  weekStart: string;
  weekEnd: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  canGoNext: boolean;
}

export default function WeekNavigator({
  weekStart,
  weekEnd,
  onPrev,
  onNext,
  onToday,
  canGoNext,
}: WeekNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        type="button"
        onClick={onPrev}
        className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Previous week"
      >
        &#8592;
      </button>

      <span className="min-w-[220px] text-center text-body font-medium text-surface-dark">
        {formatWeekRange(weekStart, weekEnd)}
      </span>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next week"
      >
        &#8594;
      </button>

      <button
        type="button"
        onClick={onToday}
        className="ml-2 rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
      >
        Today
      </button>
    </div>
  );
}
