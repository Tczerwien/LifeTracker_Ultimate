import { useState, useCallback } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type { AppConfig } from '../../types/models';
import type { DbStats } from '../../types/commands';
import { useSaveConfig } from '../../hooks/use-config';
import { useToast } from '../shared/Toast';

interface GeneralTabProps {
  config: AppConfig;
  dbStats: DbStats | undefined;
  dbPath: string | undefined;
}

export default function GeneralTab({ config, dbStats, dbPath }: GeneralTabProps) {
  const dailyLogCount = dbStats?.table_counts.find(
    (t) => t.table_name === 'daily_log',
  )?.count ?? 0;
  const startDateLocked = dailyLogCount > 0;

  const [startDate, setStartDate] = useState(config.start_date);
  const [startDateError, setStartDateError] = useState<string | null>(null);

  const saveConfigMutation = useSaveConfig();
  const { show } = useToast();

  const handleStartDateChange = useCallback(
    (value: string) => {
      setStartDate(value);
      setStartDateError(null);

      // Validate
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) {
        setStartDateError('Must be a valid date in YYYY-MM-DD format');
        return;
      }
      const parts = value.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
        setStartDateError('Must be a valid calendar date');
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() > today.getTime()) {
        setStartDateError('Cannot be a future date');
        return;
      }
    },
    [],
  );

  const handleSaveStartDate = useCallback(() => {
    if (startDateError !== null || startDate === config.start_date) return;

    const parsed = JSON.parse(config.dropdown_options) as unknown;
    saveConfigMutation.mutate(
      {
        start_date: startDate,
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
        dropdown_options: JSON.stringify(parsed),
      },
      {
        onSuccess: () => show('Start date updated', 'success'),
        onError: () => show('Failed to save start date', 'error'),
      },
    );
  }, [startDate, startDateError, config, saveConfigMutation, show]);

  const handleOpenFolder = useCallback(() => {
    if (dbPath) {
      void revealItemInDir(dbPath);
    }
  }, [dbPath]);

  return (
    <div className="space-y-6">
      {/* App Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700">App Name</label>
        <p className="mt-1 text-sm text-surface-dark">Life Tracker Ultimate</p>
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Start Date
        </label>
        {startDateLocked ? (
          <div className="mt-1">
            <p className="text-sm text-surface-dark">{config.start_date}</p>
            <p className="mt-1 text-xs text-gray-400">
              Locked — daily log entries exist. Cannot be changed.
            </p>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-surface-dark focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
            />
            <button
              type="button"
              onClick={handleSaveStartDate}
              disabled={
                startDateError !== null ||
                startDate === config.start_date ||
                saveConfigMutation.isPending
              }
              className="rounded-md bg-productivity px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        )}
        {startDateError !== null && (
          <p className="mt-1 text-xs text-red-600">{startDateError}</p>
        )}
      </div>

      {/* Database Path */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Database File
        </label>
        <div className="mt-1 flex items-center gap-3">
          <code className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 break-all">
            {dbPath ?? 'Loading...'}
          </code>
          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!dbPath}
            className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Open Folder
          </button>
        </div>
      </div>
    </div>
  );
}
