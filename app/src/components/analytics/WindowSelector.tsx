import { useUIStore, type AnalyticsWindow } from '../../stores/ui-store';

const WINDOWS: readonly { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All time' },
];

export default function WindowSelector() {
  const activeWindow = useUIStore((s) => s.analyticsWindow);
  const setWindow = useUIStore((s) => s.setAnalyticsWindow);

  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-1">
      {WINDOWS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setWindow(value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeWindow === value
              ? 'bg-white text-surface-dark shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
