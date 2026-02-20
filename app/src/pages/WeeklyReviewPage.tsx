import { useState } from 'react';
import { useWeeklyReview, useWeeklyStats } from '../hooks/use-review';
import { getWeekStart, todayYMD } from '../lib/date-utils';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import WeeklyReviewShell from '../components/review/WeeklyReviewShell';

function WeeklyReviewPage() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayYMD()));

  const reviewQuery = useWeeklyReview(weekStart);
  const statsQuery = useWeeklyStats(weekStart);

  const isLoading = reviewQuery.isLoading || statsQuery.isLoading;
  const isError = reviewQuery.isError || statsQuery.isError;

  const handleRetry = () => {
    void reviewQuery.refetch();
    void statsQuery.refetch();
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
          title="Could not load Weekly Review"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </div>
    );
  }

  return (
    <WeeklyReviewShell
      weekStart={weekStart}
      onWeekChange={setWeekStart}
      review={reviewQuery.data ?? null}
      liveStats={statsQuery.data!}
    />
  );
}

export default WeeklyReviewPage;
