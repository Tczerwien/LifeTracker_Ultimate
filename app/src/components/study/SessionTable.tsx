import { useState, useMemo, useCallback, Fragment } from 'react';
import type { StudySession } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useDeleteStudySession } from '../../hooks/use-study';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';
import ConfirmDialog from '../shared/ConfirmDialog';
import EmptyStateCard from '../shared/EmptyStateCard';
import SessionForm from './SessionForm';

type SortKey = 'date' | 'subject' | 'study_type' | 'duration_minutes' | 'focus_score';
type SortDir = 'asc' | 'desc';

interface SessionTableProps {
  sessions: StudySession[];
  dropdownOptions: DropdownOptions;
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

export default function SessionTable({ sessions, dropdownOptions }: SessionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const handleRowClick = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingId(null);
  }, []);

  const handleEditClick = useCallback((session: StudySession) => {
    setExpandedId(session.id);
    setEditingId(session.id);
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget === null) return;
    deleteMutation.mutate(deleteTarget, {
      onSuccess: () => {
        show('Session deleted', 'success');
        setDeleteTarget(null);
        setExpandedId(null);
        setEditingId(null);
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
          icon="---"
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
                      {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
              <th className="w-16 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((session) => {
              const isExpanded = expandedId === session.id;
              const isEditing = editingId === session.id;

              return (
                <Fragment key={session.id}>
                  <tr
                    onClick={() => handleRowClick(session.id)}
                    className={`group cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                      isExpanded ? 'bg-gray-50/50' : ''
                    }`}
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
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(session);
                          }}
                          className="rounded px-2 py-0.5 text-xs text-gray-500 opacity-0 hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100"
                        >
                          Edit
                        </button>
                        <span
                          className={`text-gray-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                        >
                          &#9656;
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={6} className="bg-white px-6 py-4">
                        {isEditing ? (
                          <SessionForm
                            key={session.id}
                            dropdownOptions={dropdownOptions}
                            existingSession={session}
                            onClose={handleCloseEdit}
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-500">Start Time:</span>{' '}
                                <span className="text-gray-700">{session.start_time}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">End Time:</span>{' '}
                                <span className="text-gray-700">{session.end_time}</span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-500">Location:</span>{' '}
                                <span className="text-gray-700">{session.location}</span>
                              </div>
                              {session.topic.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-500">Topic:</span>{' '}
                                  <span className="text-gray-700">{session.topic}</span>
                                </div>
                              )}
                              {session.resources.length > 0 && (
                                <div>
                                  <span className="font-medium text-gray-500">Resources:</span>{' '}
                                  <span className="text-gray-700">{session.resources}</span>
                                </div>
                              )}
                              {session.notes.length > 0 && (
                                <div className="col-span-2">
                                  <span className="font-medium text-gray-500">Notes:</span>{' '}
                                  <span className="text-gray-700">{session.notes}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(session.id)}
                                className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-red-500"
                              >
                                Delete session
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
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
