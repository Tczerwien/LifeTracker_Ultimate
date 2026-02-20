import { useState, useCallback } from 'react';
import type { UrgeEntry } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useSaveUrgeEntry, useUpdateUrgeEntry } from '../../hooks/use-recovery';
import { todayYMD } from '../../lib/date-utils';
import { nowHHMM } from '../../lib/time-utils';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';

interface UrgeFormProps {
  dropdownOptions: DropdownOptions;
  existingEntry?: UrgeEntry;
  onClose?: () => void;
}

interface UrgeFormState {
  date: string;
  time: string;
  intensity: number;
  trigger: string;
  duration: string;
  technique: string;
  effectiveness: number;
  did_pass: string;
  notes: string;
}

function buildInitial(entry?: UrgeEntry): UrgeFormState {
  if (entry) {
    return {
      date: entry.date,
      time: entry.time,
      intensity: entry.intensity,
      trigger: entry.trigger,
      duration: entry.duration,
      technique: entry.technique,
      effectiveness: entry.effectiveness,
      did_pass: entry.did_pass,
      notes: entry.notes,
    };
  }
  return {
    date: todayYMD(),
    time: nowHHMM(),
    intensity: 5,
    trigger: '',
    duration: '',
    technique: '',
    effectiveness: 3,
    did_pass: '',
    notes: '',
  };
}

export default function UrgeForm({
  dropdownOptions,
  existingEntry,
  onClose,
}: UrgeFormProps) {
  const [form, setForm] = useState<UrgeFormState>(() => buildInitial(existingEntry));

  const saveMutation = useSaveUrgeEntry();
  const updateMutation = useUpdateUrgeEntry();
  const { show } = useToast();

  const isEditing = existingEntry !== undefined;
  const isPending = saveMutation.isPending || updateMutation.isPending;

  const setField = useCallback(
    <K extends keyof UrgeFormState>(key: K, value: UrgeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canSave =
    form.date.length > 0 &&
    form.time.length > 0 &&
    form.intensity >= 1 &&
    form.intensity <= 10 &&
    form.duration.length > 0 &&
    form.technique.length > 0 &&
    form.effectiveness >= 1 &&
    form.effectiveness <= 5 &&
    form.did_pass.length > 0;

  const handleSave = useCallback(() => {
    const input = {
      date: form.date,
      time: form.time,
      intensity: form.intensity,
      technique: form.technique,
      effectiveness: form.effectiveness,
      duration: form.duration,
      did_pass: form.did_pass,
      trigger: form.trigger,
      notes: form.notes,
    };

    const onSuccess = () => {
      if (isEditing) {
        show('Urge updated', 'success');
        onClose?.();
      } else {
        show('Urge logged', 'success');
        setForm(buildInitial());
      }
    };
    const onError = () => {
      show('Failed to save urge', 'error');
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: existingEntry.id, entry: input },
        { onSuccess, onError },
      );
    } else {
      saveMutation.mutate(input, { onSuccess, onError });
    }
  }, [form, isEditing, existingEntry, saveMutation, updateMutation, show, onClose]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-dark">
          {isEditing
            ? `Editing urge from ${existingEntry.date} at ${existingEntry.time}`
            : 'Log Urge'}
        </h3>
        {isEditing && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel edit
          </button>
        )}
      </div>

      {/* Row 1: Date, Time, Intensity */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Time</span>
          <input
            type="time"
            value={form.time}
            onChange={(e) => setField('time', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </label>

        <div className="block">
          <span className="text-xs font-medium text-gray-600">Intensity *</span>
          <div className="mt-1">
            <DotRating
              value={form.intensity}
              onChange={(v) => setField('intensity', v)}
              max={10}
              label=""
              color="#7B7B7B"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Trigger (free text), Duration, Technique */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Trigger</span>
          <input
            type="text"
            value={form.trigger}
            onChange={(e) => setField('trigger', e.target.value)}
            placeholder="What triggered the urge?"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Duration *</span>
          <select
            value={form.duration}
            onChange={(e) => setField('duration', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.urge_duration_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Technique *</span>
          <select
            value={form.technique}
            onChange={(e) => setField('technique', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.urge_technique_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3: Effectiveness, Did Pass */}
      <div className="grid grid-cols-2 gap-3">
        <div className="block">
          <span className="text-xs font-medium text-gray-600">Effectiveness *</span>
          <div className="mt-1">
            <DotRating
              value={form.effectiveness}
              onChange={(v) => setField('effectiveness', v)}
              max={5}
              label=""
              color="#7B7B7B"
            />
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Did it pass? *</span>
          <select
            value={form.did_pass}
            onChange={(e) => setField('did_pass', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.urge_pass_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 4: Notes */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          placeholder="Additional context..."
          className="mt-1 block w-full resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {isEditing && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          disabled={!canSave || isPending}
          onClick={handleSave}
          className="rounded-md bg-gray-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving...' : isEditing ? 'Update Urge' : 'Log Urge'}
        </button>
      </div>
    </div>
  );
}
