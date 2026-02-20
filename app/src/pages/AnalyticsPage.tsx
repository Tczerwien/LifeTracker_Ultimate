import { useConfig } from '../hooks/use-config';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import AnalyticsShell from '../components/analytics/AnalyticsShell';

function AnalyticsPage() {
  const configQuery = useConfig();

  if (configQuery.isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-section">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (configQuery.isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load Analytics"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={() => void configQuery.refetch()}
        />
      </div>
    );
  }

  return <AnalyticsShell />;
}

export default AnalyticsPage;
