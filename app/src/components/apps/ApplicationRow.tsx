import { useState, useCallback } from 'react';
import type { Application } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useStatusHistory } from '../../hooks/use-applications';
import { useArchiveApplication } from '../../hooks/use-applications';
import { useToast } from '../shared/Toast';
import StatusBadge from '../shared/StatusBadge';
import ConfirmDialog from '../shared/ConfirmDialog';
import StatusTimeline from './StatusTimeline';
import StatusUpdateForm from './StatusUpdateForm';
import ApplicationForm from './ApplicationForm';

interface ApplicationRowProps {
  application: Application;
  expanded: boolean;
  onToggle: () => void;
  dropdownOptions: DropdownOptions;
}

const rowDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatRowDate(dateStr: string): string {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return rowDateFormatter.format(d);
}

export default function ApplicationRow({
  application,
  expanded,
  onToggle,
  dropdownOptions,
}: ApplicationRowProps) {
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const historyQuery = useStatusHistory(expanded ? application.id : 0);
  const archiveMutation = useArchiveApplication();
  const { show } = useToast();

  const handleArchive = useCallback(() => {
    archiveMutation.mutate(application.id, {
      onSuccess: () => {
        show('Application archived', 'success');
        setShowArchiveConfirm(false);
      },
      onError: () => {
        show('Failed to archive application', 'error');
        setShowArchiveConfirm(false);
      },
    });
  }, [application.id, archiveMutation, show]);

  return (
    <div className="border-b border-gray-100">
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex flex-1 items-center gap-4">
          <div className="min-w-[160px]">
            <span className="text-sm font-medium text-surface-dark">
              {application.company}
            </span>
          </div>
          <div className="min-w-[160px]">
            <span className="text-sm text-gray-600">{application.role}</span>
          </div>
          <StatusBadge status={application.current_status} />
          <span className="text-xs text-gray-500">
            {formatRowDate(application.date_applied)}
          </span>
        </div>
        <span
          className={`ml-2 text-gray-400 transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          &#9656;
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4">
          {showEditForm ? (
            <ApplicationForm
              dropdownOptions={dropdownOptions}
              existingApp={application}
              onClose={() => setShowEditForm(false)}
            />
          ) : (
            <>
              {/* Detail grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 rounded-lg bg-surface-kpi p-3 text-sm">
                {application.source.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Source</span>
                    <p className="text-gray-700">{application.source}</p>
                  </div>
                )}
                {application.url.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">URL</span>
                    <p>
                      <a
                        href={application.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-productivity hover:underline"
                      >
                        {application.url}
                      </a>
                    </p>
                  </div>
                )}
                {application.salary.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Salary</span>
                    <p className="text-gray-700">{application.salary}</p>
                  </div>
                )}
                {application.contact_name.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Contact</span>
                    <p className="text-gray-700">
                      {application.contact_name}
                      {application.contact_email.length > 0 && (
                        <span className="text-gray-500">
                          {' '}
                          ({application.contact_email})
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {application.follow_up_date !== null && (
                  <div>
                    <span className="text-xs text-gray-500">Follow-up</span>
                    <p className="text-gray-700">
                      {formatRowDate(application.follow_up_date)}
                    </p>
                  </div>
                )}
                {application.notes.length > 0 && (
                  <div className="col-span-3">
                    <span className="text-xs text-gray-500">Notes</span>
                    <p className="text-gray-700">{application.notes}</p>
                  </div>
                )}
                {application.login_username.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Portal Login</span>
                    <p className="text-gray-700">{application.login_username}</p>
                  </div>
                )}
              </div>

              {/* Status History */}
              <div className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status History
                </h4>
                {historyQuery.isLoading ? (
                  <div className="h-16 animate-pulse rounded bg-gray-100" />
                ) : (
                  <StatusTimeline history={historyQuery.data ?? []} />
                )}
              </div>

              {/* Status Update Form */}
              {showStatusForm ? (
                <div className="mt-3">
                  <StatusUpdateForm
                    appId={application.id}
                    onClose={() => setShowStatusForm(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStatusForm(true)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-productivity hover:underline"
                >
                  + Add Status Update
                </button>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditForm(true)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50"
                >
                  Archive
                </button>
              </div>
            </>
          )}

          <ConfirmDialog
            open={showArchiveConfirm}
            title="Archive Application"
            message={`Archive the application for ${application.role} at ${application.company}? It will be hidden from the default view.`}
            confirmLabel="Archive"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={handleArchive}
            onCancel={() => setShowArchiveConfirm(false)}
          />
        </div>
      )}
    </div>
  );
}
