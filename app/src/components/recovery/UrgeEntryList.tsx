import { useMemo } from 'react';
import type { UrgeEntry } from '../../types/models';
import { isWithin24Hours } from '../../lib/time-utils';
import DotRating from '../shared/DotRating';
import ExpandableRow from '../shared/ExpandableRow';
import EmptyStateCard from '../shared/EmptyStateCard';

interface UrgeEntryListProps {
  entries: UrgeEntry[];
  editingId?: number;
  onEdit: (entry: UrgeEntry) => void;
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

export default function UrgeEntryList({ entries, editingId, onEdit }: UrgeEntryListProps) {
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
          title="No urge entries"
          message="Entries from the last 7 days will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5">
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500">
          Recent Urges (last 7 days)
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
                <span className="w-10 shrink-0 font-medium text-gray-700">
                  {entry.intensity}/10
                </span>
                <span className="w-32 shrink-0 truncate text-gray-600">
                  {entry.technique}
                </span>
                <span className="flex-1 truncate text-gray-500">
                  {entry.did_pass}
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
              {entry.trigger.length > 0 && (
                <div>
                  <span className="font-medium text-gray-500">Trigger:</span>{' '}
                  <span className="text-gray-700">{entry.trigger}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-500">Duration:</span>{' '}
                <span className="text-gray-700">{entry.duration}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-500">Effectiveness:</span>
                <DotRating
                  value={entry.effectiveness}
                  onChange={() => {}}
                  max={5}
                  color="#7B7B7B"
                />
              </div>
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
