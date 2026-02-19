import type { StatusChange } from '../../types/models';
import StatusBadge from '../shared/StatusBadge';

interface StatusTimelineProps {
  history: StatusChange[];
}

const timelineDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatTimelineDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return timelineDateFormatter.format(d);
}

export default function StatusTimeline({ history }: StatusTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400">No status history yet.</p>
    );
  }

  // Display chronologically: oldest first
  const sorted = [...history].sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
    if (a.created_at > b.created_at) return 1;
    return a.id - b.id;
  });

  return (
    <div className="space-y-0">
      {sorted.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3">
          {/* Timeline line + dot */}
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-gray-400 mt-1.5" />
            {idx < sorted.length - 1 && (
              <div className="w-px flex-1 bg-gray-200" />
            )}
          </div>

          {/* Content */}
          <div className="pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {formatTimelineDate(entry.date)}
              </span>
              <StatusBadge status={entry.status} />
            </div>
            {entry.notes.length > 0 && (
              <p className="mt-0.5 text-xs text-gray-600">{entry.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
