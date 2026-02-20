import type { Milestone } from '../../types/models';
import { formatDisplayDate } from '../../lib/date-utils';

interface MilestoneCardProps {
  readonly milestone: Milestone;
}

export default function MilestoneCard({ milestone }: MilestoneCardProps) {
  const { achieved, emoji, name, threshold, achieved_date } = milestone;

  return (
    <div
      className={`rounded-lg p-component text-center transition-colors ${
        achieved
          ? 'border border-amber-200 bg-amber-50'
          : 'border border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      <div className="text-3xl">{achieved ? emoji : '\u{1F512}'}</div>
      <h3
        className={`mt-2 text-sm font-semibold ${
          achieved ? 'text-surface-dark' : 'text-gray-400'
        }`}
      >
        {name}
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        {achieved && achieved_date != null
          ? formatDisplayDate(achieved_date)
          : threshold}
      </p>
    </div>
  );
}
