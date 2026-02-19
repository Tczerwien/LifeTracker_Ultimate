import { InputType, type HabitCategory } from '../../types/enums';
import type { HabitConfig } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import { CATEGORY_COLORS } from '../../lib/constants';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;

interface HabitGridProps {
  habits: HabitConfig[];
  category: HabitCategory;
  formState: Omit<DailyLogInput, 'date'>;
  onFieldChange: (field: HabitColumnName, value: number | string) => void;
}

/**
 * Parse `options_json` into a sorted array of label strings.
 * Entries are sorted by their numeric value (ascending).
 * Prepends 'None' if not already present to match the DB default.
 */
function parseHabitOptions(optionsJson: string): string[] {
  const parsed = JSON.parse(optionsJson) as Record<string, number>;
  const sorted = Object.entries(parsed)
    .sort(([, a], [, b]) => a - b)
    .map(([label]) => label);
  return sorted.includes('None') ? sorted : ['None', ...sorted];
}

export default function HabitGrid({
  habits,
  category,
  formState,
  onFieldChange,
}: HabitGridProps) {
  const accentColor = CATEGORY_COLORS[category];

  return (
    <div className="grid grid-cols-2 gap-card">
      {habits.map((habit) => {
        const field = habit.column_name as HabitColumnName;

        if (habit.input_type === InputType.Dropdown) {
          const options = parseHabitOptions(habit.options_json!);
          return (
            <div key={habit.id} className="flex items-center gap-2 rounded-md p-2">
              <span className="text-body text-surface-dark">{habit.display_name}:</span>
              <select
                className="text-body rounded border border-gray-300 bg-white py-1 pl-2 pr-8"
                value={formState[field] as string}
                onChange={(e) => onFieldChange(field, e.target.value)}
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        // Default: checkbox
        const checked = formState[field] === 1;
        return (
          <label
            key={habit.id}
            className={`flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors ${
              checked ? 'bg-surface-good' : 'hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              style={{ accentColor }}
              checked={checked}
              onChange={(e) => onFieldChange(field, e.target.checked ? 1 : 0)}
            />
            <span className="text-body text-surface-dark">{habit.display_name}</span>
            <span className="ml-auto text-subdued text-gray-400">({habit.points})</span>
          </label>
        );
      })}
    </div>
  );
}
