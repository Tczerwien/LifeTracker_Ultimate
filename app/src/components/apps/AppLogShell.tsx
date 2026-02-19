import { useState, useMemo, useCallback } from 'react';
import type { Application } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { ApplicationStatus } from '../../types/enums';
import InlineForm from '../shared/InlineForm';
import FilterBar from './FilterBar';
import ApplicationList from './ApplicationList';
import ApplicationForm from './ApplicationForm';

type SortKey = 'date_applied' | 'company' | 'current_status';
type SortDir = 'asc' | 'desc';

interface AppLogShellProps {
  applications: Application[];
  dropdownOptions: DropdownOptions;
  statusFilter: ApplicationStatus[];
  onStatusFilterChange: (statuses: ApplicationStatus[]) => void;
  search: string;
  onSearchChange: (val: string) => void;
}

export default function AppLogShell({
  applications,
  dropdownOptions,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
}: AppLogShellProps) {
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date_applied');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSortChange = useCallback((key: SortKey, dir: SortDir) => {
    setSortKey(key);
    setSortDir(dir);
  }, []);

  const handleToggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // Client-side sorting (server already filtered by status/search)
  const sorted = useMemo(() => {
    const copy = [...applications];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [applications, sortKey, sortDir]);

  return (
    <div className="p-section">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-surface-dark">App Log</h1>
      </div>

      <FilterBar
        statusFilter={statusFilter}
        onStatusChange={onStatusFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSortChange}
      />

      <ApplicationList
        applications={sorted}
        expandedId={expandedId}
        onToggleExpand={handleToggleExpand}
        dropdownOptions={dropdownOptions}
      />

      {/* Add Application form */}
      <div className="mt-card">
        <InlineForm
          open={addFormOpen}
          onToggle={() => setAddFormOpen((prev) => !prev)}
          trigger={
            <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-productivity hover:text-productivity">
              + Add Application
            </span>
          }
        >
          <ApplicationForm
            dropdownOptions={dropdownOptions}
            onClose={() => setAddFormOpen(false)}
          />
        </InlineForm>
      </div>
    </div>
  );
}
