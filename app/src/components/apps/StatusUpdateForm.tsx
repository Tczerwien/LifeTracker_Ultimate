import { useState, useCallback } from 'react';
import { ApplicationStatus } from '../../types/enums';
import { APPLICATION_STATUS_DISPLAY } from '../../lib/constants';
import { useAddStatusChange } from '../../hooks/use-applications';
import { todayYMD } from '../../lib/date-utils';
import { useToast } from '../shared/Toast';

interface StatusUpdateFormProps {
  appId: number;
  onClose: () => void;
}

const STATUS_OPTIONS = Object.values(ApplicationStatus);

export default function StatusUpdateForm({ appId, onClose }: StatusUpdateFormProps) {
  const [status, setStatus] = useState<string>('');
  const [date, setDate] = useState(todayYMD());
  const [notes, setNotes] = useState('');

  const mutation = useAddStatusChange();
  const { show } = useToast();

  const canSave = status.length > 0 && date.length > 0;

  const handleSave = useCallback(() => {
    mutation.mutate(
      {
        appId,
        change: {
          status,
          changed_date: date,
          notes: notes.length > 0 ? notes : undefined,
        },
      },
      {
        onSuccess: () => {
          show('Status updated', 'success');
          onClose();
        },
        onError: () => {
          show('Failed to update status', 'error');
        },
      },
    );
  }, [appId, status, date, notes, mutation, show, onClose]);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <h4 className="text-xs font-semibold text-gray-600">Add Status Update</h4>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Status *</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          >
            <option value="">Select...</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {APPLICATION_STATUS_DISPLAY[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date *</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Notes</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave || mutation.isPending}
          onClick={handleSave}
          className="rounded-md bg-productivity px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Update'}
        </button>
      </div>
    </div>
  );
}
