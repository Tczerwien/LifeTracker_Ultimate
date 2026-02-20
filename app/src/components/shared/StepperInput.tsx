interface StepperInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function StepperInput({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
}: StepperInputProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div
      className="inline-flex items-center gap-1"
      role="spinbutton"
      tabIndex={0}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max === Infinity ? undefined : max}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' && !atMax) {
          e.preventDefault();
          onChange(Math.min(value + step, max));
        } else if (e.key === 'ArrowDown' && !atMin) {
          e.preventDefault();
          onChange(Math.max(value - step, min));
        }
      }}
    >
      <button
        type="button"
        aria-label="Decrease"
        tabIndex={-1}
        disabled={atMin}
        onClick={() => onChange(Math.max(value - step, min))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-body hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {'\u2212'}
      </button>
      <span className="w-8 text-center text-body font-medium">{value}</span>
      <button
        type="button"
        aria-label="Increase"
        tabIndex={-1}
        disabled={atMax}
        onClick={() => onChange(Math.min(value + step, max))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-body hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        +
      </button>
    </div>
  );
}
