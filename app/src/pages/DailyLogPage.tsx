import { useMemo } from 'react';
import { useUIStore } from '../stores/ui-store';
import { useDailyLog } from '../hooks/use-daily-log';
import { useHabitConfigs, useConfig } from '../hooks/use-config';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import DailyLogShell from '../components/daily-log/DailyLogShell';

function DailyLogPage() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const logQuery = useDailyLog(selectedDate);
  const habitsQuery = useHabitConfigs();
  const configQuery = useConfig();

  const isLoading = logQuery.isLoading || habitsQuery.isLoading || configQuery.isLoading;
  const isError = logQuery.isError || habitsQuery.isError || configQuery.isError;

  const activeHabits = useMemo(
    () => (habitsQuery.data ?? []).filter((h) => h.is_active),
    [habitsQuery.data],
  );

  if (isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="\u26A0\uFE0F"
          title="Could not load Daily Log"
          message="Check that the app data directory is accessible and try restarting."
        />
      </div>
    );
  }

  if (activeHabits.length === 0) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="\uD83D\uDCCB"
          title="No active habits"
          message="Add habits in Settings to begin tracking."
        />
      </div>
    );
  }

  return (
    <DailyLogShell
      date={selectedDate}
      dailyLog={logQuery.data ?? null}
      habits={activeHabits}
      config={configQuery.data!}
    />
  );
}

export default DailyLogPage;
