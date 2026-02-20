import type { Milestone } from '../../types/models';
import type { MilestoneCategory } from '../../types/models';
import MilestoneCard from './MilestoneCard';

interface MilestoneShellProps {
  readonly milestones: Milestone[];
}

const CATEGORY_ORDER: readonly { key: MilestoneCategory; label: string }[] = [
  { key: 'tracking', label: 'Tracking' },
  { key: 'score', label: 'Score' },
  { key: 'clean', label: 'Clean Streak' },
  { key: 'study', label: 'Study' },
];

export default function MilestoneShell({ milestones }: MilestoneShellProps) {
  const achievedCount = milestones.filter((m) => m.achieved).length;
  const total = milestones.length;
  const pct = total > 0 ? (achievedCount / total) * 100 : 0;

  const grouped = new Map<MilestoneCategory, Milestone[]>();
  for (const m of milestones) {
    const list = grouped.get(m.category);
    if (list) {
      list.push(m);
    } else {
      grouped.set(m.category, [m]);
    }
  }

  return (
    <div className="p-section">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-surface-dark">Milestones</h1>
        <span className="text-sm text-gray-500">
          {achievedCount} / {total} achieved
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Category sections */}
      <div className="mt-6 space-y-6">
        {CATEGORY_ORDER.map(({ key, label }) => {
          const categoryMilestones = grouped.get(key);
          if (!categoryMilestones || categoryMilestones.length === 0) return null;
          return (
            <section key={key}>
              <h2 className="text-section-header font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-card sm:grid-cols-3 lg:grid-cols-4">
                {categoryMilestones.map((m) => (
                  <MilestoneCard key={m.id} milestone={m} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
