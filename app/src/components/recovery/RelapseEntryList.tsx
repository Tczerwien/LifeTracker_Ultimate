import { useMemo } from 'react';
import type { RelapseEntry } from '../../types/models';
import { isWithin24Hours } from '../../lib/time-utils';
import DotRating from '../shared/DotRating';
import ExpandableRow from '../shared/ExpandableRow';
import EmptyStateCard from '../shared/EmptyStateCard';

interface RelapseEntryListProps {
  entries: RelapseEntry[];
  editingId?: number;
  onEdit: (entry: RelapseEntry) => void;
}

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return shortDateFormatter.format(d);
}

export default function RelapseEntryList({ entries, editingId, onEdit }: RelapseEntryListProps) {
  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.time.localeCompare(a.time);
    });
    return copy;
  }, [entries]);

  if (sorted.length === 0) {
    return (
      <div className="mt-4">
        <EmptyStateCard
          icon="---"
          title="No relapse entries"
          message="Entries from the last 7 days will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Recent Relapses (last 7 days)
        </h3>
      </div>
      {sorted.map((entry) => {
        const editable = isWithin24Hours(entry.created_at);
        const isBeingEdited = editingId === entry.id;

        return (
          <div
            key={entry.id}
            className={
              isBeingEdited
                ? 'border-l-4 border-l-amber-400 bg-amber-50/50'
                : ''
            }
          >
          <ExpandableRow
            summary={
              <div className="flex items-center gap-4 text-sm">
                <span className="w-24 shrink-0 text-gray-600">
                  {formatShortDate(entry.date)}
                </span>
                <span className="w-14 shrink-0 text-gray-500">{entry.time}</span>
                <span className="w-28 shrink-0 truncate text-gray-600">
                  {entry.trigger}
                </span>
                <span className="w-24 shrink-0 truncate text-gray-500">
                  {entry.emotional_state}
                </span>
                <span className="flex-1 truncate text-gray-500">
                  {entry.duration}
                </span>
                {editable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(entry);
                    }}
                    className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  >
                    Edit
                  </button>
                )}
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-500">Location:</span>{' '}
                <span className="text-gray-700">{entry.location}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Device:</span>{' '}
                <span className="text-gray-700">{entry.device}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Activity Before:</span>{' '}
                <span className="text-gray-700">{entry.activity_before}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Resistance:</span>{' '}
                <span className="text-gray-700">{entry.resistance_technique}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-500">Urge Intensity:</span>
                <DotRating
                  value={entry.urge_intensity}
                  onChange={() => {}}
                  max={10}
                  color="#7B7B7B"
                />
              </div>
              {entry.urge_entry_id !== null && (
                <div>
                  <span className="font-medium text-gray-500">Linked Urge:</span>{' '}
                  <span className="text-gray-700">#{entry.urge_entry_id}</span>
                </div>
              )}
              {entry.notes.length > 0 && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-500">Notes:</span>{' '}
                  <span className="text-gray-700">{entry.notes}</span>
                </div>
              )}
            </div>
          </ExpandableRow>
          </div>
        );
      })}
    </div>
  );
}
