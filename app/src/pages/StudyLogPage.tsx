import { useState, useCallback } from 'react';
import { useStudySessionsRange } from '../hooks/use-study';
import { useConfig } from '../hooks/use-config';
import { todayYMD, getWeekStart, getWeekEnd } from '../lib/date-utils';
import { isValidDropdownOptions, SEED_DROPDOWN_OPTIONS } from '../types/options';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import StudyLogShell from '../components/study/StudyLogShell';

function StudyLogPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayYMD()));
  const weekEnd = getWeekEnd(weekStart);

  const sessionsQuery = useStudySessionsRange(weekStart, weekEnd);
  const configQuery = useConfig();

  // All hooks must be called before any early returns (React rules of hooks)
  const handleWeekChange = useCallback((start: string) => {
    setWeekStart(start);
  }, []);

  const isLoading = sessionsQuery.isLoading || configQuery.isLoading;
  const isError = sessionsQuery.isError || configQuery.isError;

  const handleRetry = () => {
    void sessionsQuery.refetch();
    void configQuery.refetch();
  };

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
          icon="⚠️"
          title="Could not load Study Log"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </div>
    );
  }

  const sessions = sessionsQuery.data ?? [];
  const rawOptions = configQuery.data
    ? (JSON.parse(configQuery.data.dropdown_options) as unknown)
    : null;
  const dropdownOptions = isValidDropdownOptions(rawOptions)
    ? rawOptions
    : SEED_DROPDOWN_OPTIONS;

  return (
    <StudyLogShell
      sessions={sessions}
      weekStart={weekStart}
      weekEnd={weekEnd}
      onWeekChange={handleWeekChange}
      dropdownOptions={dropdownOptions}
    />
  );
}

export default StudyLogPage;
