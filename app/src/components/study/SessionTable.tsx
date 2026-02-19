import { useState, useMemo, useCallback } from 'react';
import type { StudySession } from '../../types/models';
import { useDeleteStudySession } from '../../hooks/use-study';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';
import ConfirmDialog from '../shared/ConfirmDialog';
import EmptyStateCard from '../shared/EmptyStateCard';

type SortKey = 'date' | 'subject' | 'study_type' | 'duration_minutes' | 'focus_score';
type SortDir = 'asc' | 'desc';

interface SessionTableProps {
  sessions: StudySession[];
  onEdit: (session: StudySession) => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'subject', label: 'Subject' },
  { key: 'study_type', label: 'Type' },
  { key: 'duration_minutes', label: 'Duration' },
  { key: 'focus_score', label: 'Focus' },
];

export default function SessionTable({ sessions, onEdit }: SessionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const deleteMutation = useDeleteStudySession();
  const { show } = useToast();

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'date' ? 'desc' : 'asc');
      }
    },
    [sortKey],
  );

  const sorted = useMemo(() => {
    const copy = [...sessions];
    copy.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [sessions, sortKey, sortDir]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget === null) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        show('Session deleted', 'success');
        setDeleteTarget(null);
      },
      onError: () => {
        show('Failed to delete session', 'error');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteMutation, show]);

  if (sessions.length === 0) {
    return (
      <div className="mt-4">
        <EmptyStateCard
          icon="📚"
          title="No sessions this week"
          message="Click '+ Add Session' to log your first study session."
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-body">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="ml-1">
                      {sortDir === 'asc' ? '▲' : '▼'}
                    </span>
                  )}
                </th>
              ))}
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((session) => (
              <tr
                key={session.id}
                onClick={() => onEdit(session)}
                className="group cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-2.5 text-sm text-gray-700">
                  {formatShortDate(session.date)}
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-surface-dark">
                  {session.subject}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-600">
                  {session.study_type}
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-700">
                  {formatDuration(session.duration_minutes)}
                </td>
                <td className="px-4 py-2.5">
                  <DotRating
                    value={session.focus_score}
                    onChange={() => {}}
                    max={5}
                    color="#3D85C6"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(session.id);
                    }}
                    className="rounded p-1 text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    aria-label="Delete session"
                  >
                    &#10005;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Session"
        message="This will permanently delete this study session. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
