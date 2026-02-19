import type { HabitCategory } from '../../types/enums';
import type { HabitConfig, AppConfig } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import { CATEGORY_COLORS, CATEGORY_MULTIPLIER_KEYS } from '../../lib/constants';
import ExpandableRow from '../shared/ExpandableRow';
import HabitGrid from './HabitGrid';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;

const CATEGORY_LABELS: Record<HabitCategory, string> = {
  productivity: 'Productivity',
  health: 'Health',
  growth: 'Growth',
};

interface HabitSectionProps {
  category: HabitCategory;
  habits: HabitConfig[];
  config: AppConfig;
  formState: Omit<DailyLogInput, 'date'>;
  onFieldChange: (field: HabitColumnName, value: number | string) => void;
}

export default function HabitSection({
  category,
  habits,
  config,
  formState,
  onFieldChange,
}: HabitSectionProps) {
  if (habits.length === 0) return null;

  const multiplierKey = CATEGORY_MULTIPLIER_KEYS[category];
  const multiplierValue = config[multiplierKey] as number;
  const color = CATEGORY_COLORS[category];

  const summary = (
    <div className="flex w-full items-center justify-between">
      <span
        className="text-section-header font-semibold uppercase tracking-wide"
        style={{ color }}
      >
        {CATEGORY_LABELS[category]}
      </span>
      <span className="text-subdued text-gray-400">
        &times;{multiplierValue.toFixed(1)}
      </span>
    </div>
  );

  return (
    <div className="rounded-lg border-l-4" style={{ borderColor: color }}>
      <ExpandableRow summary={summary} defaultExpanded>
        <HabitGrid
          habits={habits}
          category={category}
          formState={formState}
          onFieldChange={onFieldChange}
        />
      </ExpandableRow>
    </div>
  );
}
