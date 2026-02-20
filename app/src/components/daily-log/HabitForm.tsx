import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { HabitPool, HabitCategory } from '../../types/enums';
import type { HabitConfig, AppConfig, DailyLog } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import { useSaveDailyLog } from '../../hooks/use-daily-log';
import { useToast } from '../shared/Toast';
import HabitSection from './HabitSection';
import ViceSection from './ViceSection';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;
type HabitFormValues = Omit<DailyLogInput, 'date'>;

const DEFAULT_FORM_VALUES: HabitFormValues = {
  schoolwork: 0,
  personal_project: 0,
  classes: 0,
  job_search: 0,
  gym: 0,
  sleep_7_9h: 0,
  wake_8am: 0,
  supplements: 0,
  meal_quality: 'None',
  stretching: 0,
  meditate: 0,
  read: 0,
  social: 'None',
  porn: 0,
  masturbate: 0,
  weed: 0,
  skip_class: 0,
  binged_content: 0,
  gaming_1h: 0,
  past_12am: 0,
  late_wake: 0,
  phone_use: 0,
};

function extractFormValues(log: DailyLog): HabitFormValues {
  return {
    schoolwork: log.schoolwork,
    personal_project: log.personal_project,
    classes: log.classes,
    job_search: log.job_search,
    gym: log.gym,
    sleep_7_9h: log.sleep_7_9h,
    wake_8am: log.wake_8am,
    supplements: log.supplements,
    meal_quality: log.meal_quality,
    stretching: log.stretching,
    meditate: log.meditate,
    read: log.read,
    social: log.social,
    porn: log.porn,
    masturbate: log.masturbate,
    weed: log.weed,
    skip_class: log.skip_class,
    binged_content: log.binged_content,
    gaming_1h: log.gaming_1h,
    past_12am: log.past_12am,
    late_wake: log.late_wake,
    phone_use: log.phone_use,
  };
}

interface HabitFormProps {
  date: string;
  dailyLog: DailyLog | null;
  habits: HabitConfig[];
  config: AppConfig;
}

export default function HabitForm({ date, dailyLog, habits, config }: HabitFormProps) {
  const [formState, setFormState] = useState<HabitFormValues>(DEFAULT_FORM_VALUES);
  const pornDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveMutation = useSaveDailyLog();
  const { show } = useToast();

  // Initialize / reset form when date or loaded log changes
  useEffect(() => {
    if (pornDebounceRef.current !== null) {
      clearTimeout(pornDebounceRef.current);
      pornDebounceRef.current = null;
    }
    setFormState(dailyLog !== null ? extractFormValues(dailyLog) : DEFAULT_FORM_VALUES);
  }, [date, dailyLog]);

  // Show error toast on save failure
  useEffect(() => {
    if (saveMutation.isError) {
      show('Failed to save — please try again', 'error');
    }
  }, [saveMutation.isError, show]);

  // Group habits by category (memoized)
  const { productivityHabits, healthHabits, growthHabits, viceHabits } = useMemo(() => {
    const good = habits.filter((h) => h.pool === HabitPool.Good);
    const vices = habits.filter((h) => h.pool === HabitPool.Vice);
    return {
      productivityHabits: good
        .filter((h) => h.category?.toLowerCase() === HabitCategory.Productivity)
        .sort((a, b) => a.sort_order - b.sort_order),
      healthHabits: good
        .filter((h) => h.category?.toLowerCase() === HabitCategory.Health)
        .sort((a, b) => a.sort_order - b.sort_order),
      growthHabits: good
        .filter((h) => h.category?.toLowerCase() === HabitCategory.Growth)
        .sort((a, b) => a.sort_order - b.sort_order),
      viceHabits: vices.sort((a, b) => a.sort_order - b.sort_order),
    };
  }, [habits]);

  // Immediate save: checkboxes + dropdowns
  const handleFieldChange = useCallback(
    (field: HabitColumnName, value: number | string) => {
      setFormState((prev) => {
        const next = { ...prev, [field]: value };
        saveMutation.mutate({ date, ...next });
        return next;
      });
    },
    [date, saveMutation],
  );

  // Debounced save: porn stepper (300ms)
  const handlePornChange = useCallback(
    (value: number) => {
      setFormState((prev) => {
        const next = { ...prev, porn: value };
        if (pornDebounceRef.current !== null) {
          clearTimeout(pornDebounceRef.current);
        }
        pornDebounceRef.current = setTimeout(() => {
          saveMutation.mutate({ date, ...next });
        }, 300);
        return next;
      });
    },
    [date, saveMutation],
  );

  // On-blur save: phone minutes
  const handlePhoneBlur = useCallback(
    (minutes: number) => {
      setFormState((prev) => {
        const next = { ...prev, phone_use: minutes };
        saveMutation.mutate({ date, ...next });
        return next;
      });
    },
    [date, saveMutation],
  );

  return (
    <div className="mt-4 space-y-1">
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={config}
        formState={formState}
        onFieldChange={handleFieldChange}
      />
      <HabitSection
        category={HabitCategory.Health}
        habits={healthHabits}
        config={config}
        formState={formState}
        onFieldChange={handleFieldChange}
      />
      <HabitSection
        category={HabitCategory.Growth}
        habits={growthHabits}
        config={config}
        formState={formState}
        onFieldChange={handleFieldChange}
      />
      <ViceSection
        habits={viceHabits}
        formState={formState}
        config={config}
        onFieldChange={handleFieldChange}
        onPornChange={handlePornChange}
        onPhoneBlur={handlePhoneBlur}
      />
    </div>
  );
}
