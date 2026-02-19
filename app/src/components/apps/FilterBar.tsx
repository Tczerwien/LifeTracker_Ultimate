import { useState, useEffect, useCallback } from 'react';
import { ApplicationStatus } from '../../types/enums';
import { APPLICATION_STATUS_DISPLAY } from '../../lib/constants';

type SortKey = 'date_applied' | 'company' | 'current_status';
type SortDir = 'asc' | 'desc';

interface FilterBarProps {
  statusFilter: ApplicationStatus[];
  onStatusChange: (statuses: ApplicationStatus[]) => void;
  search: string;
  onSearchChange: (val: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey, dir: SortDir) => void;
}

const ALL_STATUSES = Object.values(ApplicationStatus);

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date_applied', label: 'Date Applied' },
  { key: 'company', label: 'Company' },
  { key: 'current_status', label: 'Status' },
];

export default function FilterBar({
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  sortKey,
  sortDir,
  onSortChange,
}: FilterBarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  const toggleStatus = useCallback(
    (status: ApplicationStatus) => {
      if (statusFilter.includes(status)) {
        onStatusChange(statusFilter.filter((s) => s !== status));
      } else {
        onStatusChange([...statusFilter, status]);
      }
    },
    [statusFilter, onStatusChange],
  );

  return (
    <div className="mt-4 space-y-3">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((status) => {
          const display = APPLICATION_STATUS_DISPLAY[status];
          const active = statusFilter.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                borderColor: active ? display.color : '#d1d5db',
                backgroundColor: active ? `${display.color}15` : 'transparent',
                color: active ? display.color : '#6b7280',
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: active ? display.color : '#d1d5db',
                }}
              />
              {display.label}
            </button>
          );
        })}
      </div>

      {/* Search + Sort row */}
      <div className="flex gap-3">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search company or role..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
        />

        <select
          value={sortKey}
          onChange={(e) => onSortChange(e.target.value as SortKey, sortDir)}
          className="min-w-[140px] rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onSortChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          aria-label="Toggle sort direction"
        >
          {sortDir === 'asc' ? '▲' : '▼'}
        </button>
      </div>
    </div>
  );
}
