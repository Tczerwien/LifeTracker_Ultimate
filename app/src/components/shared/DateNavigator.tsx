import { useState } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { addDays, compareDates, formatDisplayDate, todayYMD } from '../../lib/date-utils';
import DatePicker from './DatePicker';

interface DateNavigatorProps {
  readOnly?: boolean;
  minDate?: string;
  hasLogEntry?: boolean;
}

export default function DateNavigator({
  readOnly = false,
  minDate,
  hasLogEntry,
}: DateNavigatorProps) {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = todayYMD();
  const atStart = minDate != null && compareDates(selectedDate, minDate) <= 0;
  const atEnd = compareDates(selectedDate, today) >= 0;

  if (readOnly) {
    return (
      <div className="flex items-center justify-center py-3">
        <span className="text-body font-medium text-surface-dark">
          {formatDisplayDate(selectedDate)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        type="button"
        aria-label="Previous day"
        disabled={atStart}
        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        &#8592;
      </button>

      <div className="relative">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className="text-body font-medium text-surface-dark hover:text-productivity"
          >
            {formatDisplayDate(selectedDate)}
          </button>
          {hasLogEntry === false && !atEnd && (
            <span className="text-subdued text-amber-500" title="No log entry for this date">
              (no entry)
            </span>
          )}
        </div>
        {pickerOpen && (
          <DatePicker
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              setPickerOpen(false);
            }}
            minDate={minDate}
            maxDate={today}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={atEnd}
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        &#8594;
      </button>
    </div>
  );
}
