import type { Application } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import EmptyStateCard from '../shared/EmptyStateCard';
import ApplicationRow from './ApplicationRow';

interface ApplicationListProps {
  applications: Application[];
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  dropdownOptions: DropdownOptions;
}

export default function ApplicationList({
  applications,
  expandedId,
  onToggleExpand,
  dropdownOptions,
}: ApplicationListProps) {
  if (applications.length === 0) {
    return (
      <div className="mt-4">
        <EmptyStateCard
          icon="📋"
          title="No applications"
          message="Click '+ Add Application' to start tracking your job applications."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      {applications.map((app) => (
        <ApplicationRow
          key={app.id}
          application={app}
          expanded={expandedId === app.id}
          onToggle={() => onToggleExpand(app.id)}
          dropdownOptions={dropdownOptions}
        />
      ))}
    </div>
  );
}
