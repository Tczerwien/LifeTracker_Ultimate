import { InputType } from '../../types/enums';
import type { HabitConfig, AppConfig } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import { VICE_COLOR } from '../../lib/constants';
import StepperInput from '../shared/StepperInput';
import PhoneInput from './PhoneInput';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;

interface ViceGridProps {
  habits: HabitConfig[];
  formState: Omit<DailyLogInput, 'date'>;
  config: AppConfig;
  onFieldChange: (field: HabitColumnName, value: number | string) => void;
  onPornChange: (value: number) => void;
  onPhoneBlur: (minutes: number) => void;
}

export default function ViceGrid({
  habits,
  formState,
  config,
  onFieldChange,
  onPornChange,
  onPhoneBlur,
}: ViceGridProps) {
  return (
    <div className="grid grid-cols-2 gap-card">
      {habits.map((habit) => {
        const field = habit.column_name as HabitColumnName;

        // Porn: stepper input (per_instance, number)
        if (habit.column_name === 'porn' && habit.input_type === InputType.Number) {
          const count = formState.porn;
          const total = count * habit.penalty;
          return (
            <div key={habit.id} className="flex items-center gap-2 rounded-md p-2">
              <span className="text-body text-surface-dark">{habit.display_name}:</span>
              <StepperInput
                value={count}
                onChange={onPornChange}
                min={0}
                max={10}
              />
              {count > 0 && (
                <span className="text-subdued text-gray-400">
                  {count} &times; {habit.penalty.toFixed(2)} = {total.toFixed(2)}
                </span>
              )}
            </div>
          );
        }

        // Phone use: blur-save number input (tiered)
        if (habit.column_name === 'phone_use' && habit.input_type === InputType.Number) {
          return (
            <div key={habit.id} className="col-span-2 flex items-center gap-2 rounded-md p-2">
              <span className="text-body text-surface-dark">{habit.display_name}:</span>
              <PhoneInput
                value={formState.phone_use}
                onBlur={onPhoneBlur}
                phoneTiers={{
                  t1Min: config.phone_t1_min,
                  t2Min: config.phone_t2_min,
                  t3Min: config.phone_t3_min,
                  t1Penalty: config.phone_t1_penalty,
                  t2Penalty: config.phone_t2_penalty,
                  t3Penalty: config.phone_t3_penalty,
                }}
              />
            </div>
          );
        }

        // Default: checkbox vice
        const checked = formState[field] === 1;
        return (
          <label
            key={habit.id}
            className={`flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors ${
              checked ? 'bg-surface-vice' : 'hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              style={{ accentColor: VICE_COLOR }}
              checked={checked}
              onChange={(e) => onFieldChange(field, e.target.checked ? 1 : 0)}
            />
            <span className="text-body text-surface-dark">{habit.display_name}</span>
            <span className="ml-auto text-subdued text-gray-400">(-{habit.penalty.toFixed(2)})</span>
          </label>
        );
      })}
    </div>
  );
}
