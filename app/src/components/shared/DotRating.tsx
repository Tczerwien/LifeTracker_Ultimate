import { useCallback } from 'react';

interface DotRatingProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label?: string;
  color?: string;
}

const DEFAULT_COLOR = '#3D85C6';

export default function DotRating({
  value,
  onChange,
  max,
  label,
  color = DEFAULT_COLOR,
}: DotRatingProps) {
  const dotSize = max <= 5 ? 'w-4 h-4' : 'w-3 h-3';

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight' && value < max) {
        e.preventDefault();
        onChange(value + 1);
      } else if (e.key === 'ArrowLeft' && value > 1) {
        e.preventDefault();
        onChange(value - 1);
      }
    },
    [value, max, onChange],
  );

  return (
    <div className="flex items-center gap-2">
      {label != null && (
        <span className="text-body font-medium text-surface-dark">{label}</span>
      )}
      <div
        role="group"
        aria-label={label ?? 'Rating'}
        className="flex items-center gap-1"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {Array.from({ length: max }, (_, i) => {
          const dotValue = i + 1;
          const isFilled = dotValue <= value;
          return (
            <button
              key={dotValue}
              type="button"
              aria-label={`${dotValue} of ${max}`}
              tabIndex={-1}
              onClick={() => onChange(dotValue)}
              className={`${dotSize} rounded-full transition-colors`}
              style={
                isFilled
                  ? { backgroundColor: color }
                  : { border: '2px solid', borderColor: color }
              }
            />
          );
        })}
      </div>
      <span className="text-kpi-label text-gray-500">
        {value}/{max}
      </span>
    </div>
  );
}
