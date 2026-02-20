import { useState, useCallback, useMemo } from 'react';
import type { AppConfig } from '../../types/models';
import type { AppConfigInput } from '../../types/commands';
import type { CorrelationWindow } from '../../types/enums';
import { VALID_CORRELATION_WINDOWS } from '../../types/enums';
import { validateConfig } from '../../engine/config-validator';
import type { ValidationError, ValidationWarning } from '../../types/engine';
import { useSaveConfig } from '../../hooks/use-config';
import { useToast } from '../shared/Toast';

interface ScoringTabProps {
  config: AppConfig;
}

type ScoringFormState = Omit<AppConfigInput, 'dropdown_options' | 'start_date'>;

const CORRELATION_LABELS: Record<CorrelationWindow, string> = {
  0: 'All Time',
  30: '30 Days',
  60: '60 Days',
  90: '90 Days',
  180: '180 Days',
  365: '365 Days',
};

interface FieldConfig {
  key: keyof ScoringFormState;
  label: string;
  step: number;
  isInteger?: boolean;
}

const MULTIPLIER_FIELDS: FieldConfig[] = [
  { key: 'multiplier_productivity', label: 'Productivity', step: 0.1 },
  { key: 'multiplier_health', label: 'Health', step: 0.1 },
  { key: 'multiplier_growth', label: 'Growth', step: 0.1 },
];

const THRESHOLD_FIELDS: FieldConfig[] = [
  { key: 'target_fraction', label: 'Target Fraction', step: 0.01 },
  { key: 'vice_cap', label: 'Vice Cap', step: 0.01 },
  { key: 'streak_threshold', label: 'Streak Threshold', step: 0.01 },
  { key: 'streak_bonus_per_day', label: 'Streak Bonus / Day', step: 0.001 },
  { key: 'max_streak_bonus', label: 'Max Streak Bonus', step: 0.01 },
];

const PHONE_THRESHOLD_FIELDS: FieldConfig[] = [
  { key: 'phone_t1_min', label: 'Tier 1 (min)', step: 1, isInteger: true },
  { key: 'phone_t2_min', label: 'Tier 2 (min)', step: 1, isInteger: true },
  { key: 'phone_t3_min', label: 'Tier 3 (min)', step: 1, isInteger: true },
];

const PHONE_PENALTY_FIELDS: FieldConfig[] = [
  { key: 'phone_t1_penalty', label: 'Tier 1 Penalty', step: 0.01 },
  { key: 'phone_t2_penalty', label: 'Tier 2 Penalty', step: 0.01 },
  { key: 'phone_t3_penalty', label: 'Tier 3 Penalty', step: 0.01 },
];

function initFormState(config: AppConfig): ScoringFormState {
  return {
    multiplier_productivity: config.multiplier_productivity,
    multiplier_health: config.multiplier_health,
    multiplier_growth: config.multiplier_growth,
    target_fraction: config.target_fraction,
    vice_cap: config.vice_cap,
    streak_threshold: config.streak_threshold,
    streak_bonus_per_day: config.streak_bonus_per_day,
    max_streak_bonus: config.max_streak_bonus,
    phone_t1_min: config.phone_t1_min,
    phone_t2_min: config.phone_t2_min,
    phone_t3_min: config.phone_t3_min,
    phone_t1_penalty: config.phone_t1_penalty,
    phone_t2_penalty: config.phone_t2_penalty,
    phone_t3_penalty: config.phone_t3_penalty,
    correlation_window_days: config.correlation_window_days,
  };
}

export default function ScoringTab({ config }: ScoringTabProps) {
  const [form, setForm] = useState<ScoringFormState>(() => initFormState(config));
  const saveConfigMutation = useSaveConfig();
  const { show } = useToast();

  // Build a full AppConfig for validation
  const fullConfig = useMemo(
    (): AppConfig => ({
      ...config,
      ...form,
    }),
    [config, form],
  );

  const validation = useMemo(() => validateConfig(fullConfig), [fullConfig]);

  const errorsByField = useMemo(() => {
    const map = new Map<string, ValidationError>();
    for (const err of validation.errors) {
      // Only show config field errors (not dropdown_options errors)
      if (!err.field.startsWith('dropdown_options')) {
        map.set(err.field, err);
      }
    }
    return map;
  }, [validation.errors]);

  const warningsByField = useMemo(() => {
    const map = new Map<string, ValidationWarning>();
    for (const warn of validation.warnings) {
      map.set(warn.field, warn);
    }
    return map;
  }, [validation.warnings]);

  const hasErrors = errorsByField.size > 0;

  const isDirty = useMemo(() => {
    const keys = Object.keys(form) as (keyof ScoringFormState)[];
    return keys.some((k) => form[k] !== config[k]);
  }, [form, config]);

  const handleFieldChange = useCallback(
    (key: keyof ScoringFormState, rawValue: string) => {
      const field = MULTIPLIER_FIELDS.find((f) => f.key === key)
        ?? THRESHOLD_FIELDS.find((f) => f.key === key)
        ?? PHONE_THRESHOLD_FIELDS.find((f) => f.key === key)
        ?? PHONE_PENALTY_FIELDS.find((f) => f.key === key);

      const isInteger = field?.isInteger === true;
      const parsed = isInteger ? parseInt(rawValue, 10) : parseFloat(rawValue);

      if (!Number.isFinite(parsed)) return;

      setForm((prev) => ({ ...prev, [key]: parsed }));
    },
    [],
  );

  const handleCorrelationChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10) as CorrelationWindow;
    setForm((prev) => ({ ...prev, correlation_window_days: parsed }));
  }, []);

  const handleSave = useCallback(() => {
    if (hasErrors) return;

    const input: AppConfigInput = {
      start_date: config.start_date,
      ...form,
      dropdown_options: config.dropdown_options,
    };

    saveConfigMutation.mutate(input, {
      onSuccess: () => {
        show('Scoring settings saved', 'success');
      },
      onError: () => {
        show('Failed to save scoring settings', 'error');
      },
    });
  }, [hasErrors, config, form, saveConfigMutation, show]);

  const handleReset = useCallback(() => {
    setForm(initFormState(config));
  }, [config]);

  function renderField(field: FieldConfig) {
    const value = form[field.key];
    const error = errorsByField.get(field.key);
    const warning = warningsByField.get(field.key);

    return (
      <div key={field.key}>
        <label className="block text-xs font-medium text-gray-600">
          {field.label}
        </label>
        <input
          type="number"
          step={field.step}
          value={value}
          onChange={(e) => handleFieldChange(field.key, e.target.value)}
          className={`mt-1 w-full rounded-md border px-3 py-1.5 text-sm text-surface-dark focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-400 focus:border-red-400 focus:ring-red-400'
              : 'border-gray-300 focus:border-productivity focus:ring-productivity'
          }`}
        />
        {error && (
          <p className="mt-0.5 text-xs text-red-600">{error.message}</p>
        )}
        {warning && !error && (
          <p className="mt-0.5 text-xs text-amber-600">{warning.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ADR-002 SD1 notice */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm text-amber-800">
          Changes apply to future scores only. Past entries retain their original scores.
        </p>
      </div>

      {/* Category Multipliers */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark">
          Category Multipliers
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-4">
          {MULTIPLIER_FIELDS.map(renderField)}
        </div>
      </section>

      {/* Score Thresholds */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark">
          Score Thresholds
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {THRESHOLD_FIELDS.map(renderField)}
        </div>
      </section>

      {/* Phone Tiers */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark">
          Phone Use Tiers
        </h3>
        <div className="mt-3 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Thresholds (minutes)
            </p>
            <div className="grid grid-cols-3 gap-4">
              {PHONE_THRESHOLD_FIELDS.map(renderField)}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Penalties
            </p>
            <div className="grid grid-cols-3 gap-4">
              {PHONE_PENALTY_FIELDS.map(renderField)}
            </div>
          </div>
        </div>
      </section>

      {/* Correlation Window */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark">
          Correlation Window
        </h3>
        <select
          value={form.correlation_window_days}
          onChange={(e) => handleCorrelationChange(e.target.value)}
          className="mt-2 w-48 rounded-md border border-gray-300 px-3 py-2 text-sm text-surface-dark focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
        >
          {VALID_CORRELATION_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {CORRELATION_LABELS[w]}
            </option>
          ))}
        </select>
      </section>

      {/* Save / Reset */}
      <div className="flex items-center gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={hasErrors || !isDirty || saveConfigMutation.isPending}
          className="rounded-md bg-productivity px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveConfigMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
        )}
        {hasErrors && (
          <p className="text-xs text-red-600">
            Fix {errorsByField.size} error{errorsByField.size > 1 ? 's' : ''} before saving
          </p>
        )}
      </div>
    </div>
  );
}
