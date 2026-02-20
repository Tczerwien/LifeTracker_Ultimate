import { useUIStore } from '../stores/ui-store';
import { useJournal } from '../hooks/use-journal';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import JournalShell from '../components/journal/JournalShell';

function JournalPage() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const journalQuery = useJournal(selectedDate);

  if (journalQuery.isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (journalQuery.isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load Journal"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={() => void journalQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <JournalShell
      date={selectedDate}
      journal={journalQuery.data ?? null}
    />
  );
}

export default JournalPage;
