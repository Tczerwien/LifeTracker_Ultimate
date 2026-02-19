import { useEffect, useRef } from 'react';
import { DayPicker, getDefaultClassNames, type Matcher } from 'react-day-picker';
import 'react-day-picker/style.css';
import { parseYMD, toYMD } from '../../lib/date-utils';

interface DatePickerProps {
  selected: string;
  onSelect: (date: string) => void;
  minDate?: string;
  maxDate?: string;
  onClose: () => void;
}

export default function DatePicker({
  selected,
  onSelect,
  minDate,
  maxDate,
  onClose,
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const selectedDate = parseYMD(selected);
  const disabled: Matcher[] = [];
  if (minDate) disabled.push({ before: parseYMD(minDate) });
  if (maxDate) disabled.push({ after: parseYMD(maxDate) });

  const defaultClassNames = getDefaultClassNames();

  return (
    <div
      ref={containerRef}
      className="absolute z-30 mt-1 rounded-lg border border-gray-200 bg-white p-card shadow-xl"
    >
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) {
            onSelect(toYMD(date));
            onClose();
          }
        }}
        defaultMonth={selectedDate}
        disabled={disabled}
        classNames={{
          root: `${defaultClassNames.root}`,
          today: 'border-2 border-productivity rounded-md',
          selected: 'bg-productivity text-white rounded-md',
          chevron: `${defaultClassNames.chevron} fill-productivity`,
        }}
      />
    </div>
  );
}
