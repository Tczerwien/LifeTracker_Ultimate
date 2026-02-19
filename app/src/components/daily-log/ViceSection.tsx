import type { HabitConfig, AppConfig } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import { VICE_COLOR } from '../../lib/constants';
import ExpandableRow from '../shared/ExpandableRow';
import ViceGrid from './ViceGrid';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;

interface ViceSectionProps {
  habits: HabitConfig[];
  formState: Omit<DailyLogInput, 'date'>;
  config: AppConfig;
  onFieldChange: (field: HabitColumnName, value: number | string) => void;
  onPornChange: (value: number) => void;
  onPhoneBlur: (minutes: number) => void;
}

export default function ViceSection({
  habits,
  formState,
  config,
  onFieldChange,
  onPornChange,
  onPhoneBlur,
}: ViceSectionProps) {
  if (habits.length === 0) return null;

  const summary = (
    <span
      className="text-section-header font-semibold uppercase tracking-wide"
      style={{ color: VICE_COLOR }}
    >
      Vices
    </span>
  );

  return (
    <div className="rounded-lg border-l-4" style={{ borderColor: VICE_COLOR }}>
      <ExpandableRow summary={summary} defaultExpanded>
        <ViceGrid
          habits={habits}
          formState={formState}
          config={config}
          onFieldChange={onFieldChange}
          onPornChange={onPornChange}
          onPhoneBlur={onPhoneBlur}
        />
      </ExpandableRow>
    </div>
  );
}
