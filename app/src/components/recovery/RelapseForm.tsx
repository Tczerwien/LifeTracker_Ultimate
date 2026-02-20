import { useState, useCallback } from 'react';
import type { RelapseEntry, UrgeEntry } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useSaveRelapseEntry, useUpdateRelapseEntry } from '../../hooks/use-recovery';
import { todayYMD } from '../../lib/date-utils';
import { nowHHMM } from '../../lib/time-utils';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';

interface RelapseFormProps {
  dropdownOptions: DropdownOptions;
  todayUrges: UrgeEntry[];
  existingEntry?: RelapseEntry;
  onClose?: () => void;
}

interface RelapseFormState {
  date: string;
  time: string;
  duration: string;
  trigger: string;
  location: string;
  device: string;
  activity_before: string;
  emotional_state: string;
  resistance_technique: string;
  urge_intensity: number;
  urge_entry_id: number | null;
  notes: string;
}

function buildInitial(entry?: RelapseEntry): RelapseFormState {
  if (entry) {
    return {
      date: entry.date,
      time: entry.time,
      duration: entry.duration,
      trigger: entry.trigger,
      location: entry.location,
      device: entry.device,
      activity_before: entry.activity_before,
      emotional_state: entry.emotional_state,
      resistance_technique: entry.resistance_technique,
      urge_intensity: entry.urge_intensity,
      urge_entry_id: entry.urge_entry_id,
      notes: entry.notes,
    };
  }
  return {
    date: todayYMD(),
    time: nowHHMM(),
    duration: '',
    trigger: '',
    location: '',
    device: '',
    activity_before: '',
    emotional_state: '',
    resistance_technique: '',
    urge_intensity: 5,
    urge_entry_id: null,
    notes: '',
  };
}

export default function RelapseForm({
  dropdownOptions,
  todayUrges,
  existingEntry,
  onClose,
}: RelapseFormProps) {
  const [form, setForm] = useState<RelapseFormState>(() => buildInitial(existingEntry));

  const saveMutation = useSaveRelapseEntry();
  const updateMutation = useUpdateRelapseEntry();
  const { show } = useToast();

  const isEditing = existingEntry !== undefined;
  const isPending = saveMutation.isPending || updateMutation.isPending;

  const setField = useCallback(
    <K extends keyof RelapseFormState>(key: K, value: RelapseFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canSave =
    form.date.length > 0 &&
    form.time.length > 0 &&
    form.duration.length > 0 &&
    form.trigger.length > 0 &&
    form.location.length > 0 &&
    form.device.length > 0 &&
    form.activity_before.length > 0 &&
    form.emotional_state.length > 0 &&
    form.resistance_technique.length > 0 &&
    form.urge_intensity >= 1 &&
    form.urge_intensity <= 10;

  const handleSave = useCallback(() => {
    const input = {
      date: form.date,
      time: form.time,
      duration: form.duration,
      trigger: form.trigger,
      location: form.location,
      device: form.device,
      activity_before: form.activity_before,
      emotional_state: form.emotional_state,
      resistance_technique: form.resistance_technique,
      urge_intensity: form.urge_intensity,
      urge_entry_id: form.urge_entry_id,
      notes: form.notes,
    };

    const onSuccess = () => {
      if (isEditing) {
        show('Relapse updated', 'success');
        onClose?.();
      } else {
        show('Relapse logged', 'success');
        setForm(buildInitial());
      }
    };
    const onError = () => {
      show('Failed to save relapse', 'error');
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
            ? `Editing relapse from ${existingEntry.date} at ${existingEntry.time}`
            : 'Log Relapse'}
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

      {/* Row 1: Date, Time, Urge Intensity */}
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
          <span className="text-xs font-medium text-gray-600">Urge Intensity *</span>
          <div className="mt-1">
            <DotRating
              value={form.urge_intensity}
              onChange={(v) => setField('urge_intensity', v)}
              max={10}
              label=""
              color="#7B7B7B"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Trigger, Emotional State, Duration */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Trigger *</span>
          <select
            value={form.trigger}
            onChange={(e) => setField('trigger', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_trigger_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Emotional State *</span>
          <select
            value={form.emotional_state}
            onChange={(e) => setField('emotional_state', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_emotional_state_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Duration *</span>
          <select
            value={form.duration}
            onChange={(e) => setField('duration', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_duration_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3: Location, Device, Activity Before */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Location *</span>
          <select
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_location_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Device *</span>
          <select
            value={form.device}
            onChange={(e) => setField('device', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_device_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Activity Before *</span>
          <select
            value={form.activity_before}
            onChange={(e) => setField('activity_before', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_activity_before_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 4: Resistance Technique, Linked Urge */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Resistance Technique *</span>
          <select
            value={form.resistance_technique}
            onChange={(e) => setField('resistance_technique', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Select...</option>
            {dropdownOptions.relapse_resistance_technique_options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Link to Urge</span>
          <select
            value={form.urge_entry_id === null ? '' : String(form.urge_entry_id)}
            onChange={(e) =>
              setField(
                'urge_entry_id',
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">None</option>
            {todayUrges.map((urge) => (
              <option key={urge.id} value={String(urge.id)}>
                {urge.time} — intensity {urge.intensity}/10
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 5: Notes */}
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
          {isPending ? 'Saving...' : isEditing ? 'Update Relapse' : 'Log Relapse'}
        </button>
      </div>
    </div>
  );
}
