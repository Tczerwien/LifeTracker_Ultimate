import { useMilestones } from '../hooks/use-milestones';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import MilestoneShell from '../components/milestones/MilestoneShell';

function MilestonePage() {
  const milestonesQuery = useMilestones();

  if (milestonesQuery.isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-section">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-4 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (milestonesQuery.isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load milestones"
          message="Check that the app data directory is accessible and try restarting."
        />
      </div>
    );
  }

  return <MilestoneShell milestones={milestonesQuery.data ?? []} />;
}

export default MilestonePage;
