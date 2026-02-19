import { useState, useCallback, useMemo } from 'react';
import type { StudySession } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useSaveStudySession, useUpdateStudySession } from '../../hooks/use-study';
import { todayYMD, computeDurationMinutes } from '../../lib/date-utils';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';

interface SessionFormProps {
  dropdownOptions: DropdownOptions;
  existingSession?: StudySession;
  onClose: () => void;
}

interface FormState {
  date: string;
  subject: string;
  study_type: string;
  start_time: string;
  end_time: string;
  focus_score: number;
  location: string;
  topic: string;
  resources: string;
  notes: string;
}

function buildInitial(session?: StudySession): FormState {
  if (session) {
    return {
      date: session.date,
      subject: session.subject,
      study_type: session.study_type,
      start_time: session.start_time,
      end_time: session.end_time,
      focus_score: session.focus_score,
      location: session.location,
      topic: session.topic,
      resources: session.resources,
      notes: session.notes,
    };
  }
  return {
    date: todayYMD(),
    subject: '',
    study_type: '',
    start_time: '',
    end_time: '',
    focus_score: 3,
    location: '',
    topic: '',
    resources: '',
    notes: '',
  };
}

export default function SessionForm({
  dropdownOptions,
  existingSession,
  onClose,
}: SessionFormProps) {
  const [form, setForm] = useState<FormState>(() => buildInitial(existingSession));

  const saveMutation = useSaveStudySession();
  const updateMutation = useUpdateStudySession();
  const { show } = useToast();

  const isEditing = existingSession !== undefined;
  const isPending = saveMutation.isPending || updateMutation.isPending;

  const duration = useMemo(() => {
    if (form.start_time && form.end_time && form.start_time !== form.end_time) {
      return computeDurationMinutes(form.start_time, form.end_time);
    }
    return null;
  }, [form.start_time, form.end_time]);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canSave =
    form.date.length > 0 &&
    form.subject.length > 0 &&
    form.study_type.length > 0 &&
    form.start_time.length > 0 &&
    form.end_time.length > 0 &&
    form.start_time !== form.end_time &&
    form.location.length > 0 &&
    form.focus_score >= 1 &&
    form.focus_score <= 5;

  const handleSave = useCallback(() => {
    if (duration === null) return;

    const input = {
      date: form.date,
      subject: form.subject,
      study_type: form.study_type,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_minutes: duration,
      focus_score: form.focus_score,
      location: form.location,
      topic: form.topic,
      resources: form.resources,
      notes: form.notes,
    };

    const onSuccess = () => {
      show(isEditing ? 'Session updated' : 'Session saved', 'success');
      onClose();
    };
    const onError = () => {
      show('Failed to save session', 'error');
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: existingSession.id, session: input },
        { onSuccess, onError },
      );
    } else {
      saveMutation.mutate(input, { onSuccess, onError });
    }
  }, [form, duration, isEditing, existingSession, saveMutation, updateMutation, show, onClose]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-dark">
        {isEditing ? 'Edit Session' : 'New Study Session'}
      </h3>

      {/* Row 1: Date, Subject, Type */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Subject *</span>
          <select
            value={form.subject}
            onChange={(e) => setField('subject', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          >
            <option value="">Select...</option>
            {dropdownOptions.study_subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Type *</span>
          <select
            value={form.study_type}
            onChange={(e) => setField('study_type', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          >
            <option value="">Select...</option>
            {dropdownOptions.study_types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 2: Start Time, End Time, Duration, Location */}
      <div className="grid grid-cols-4 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Start *</span>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => setField('start_time', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">End *</span>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => setField('end_time', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <div className="block">
          <span className="text-xs font-medium text-gray-600">Duration</span>
          <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600">
            {duration !== null ? `${Math.floor(duration / 60)}h ${duration % 60}m` : '—'}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Location *</span>
          <select
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          >
            <option value="">Select...</option>
            {dropdownOptions.study_locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 3: Focus */}
      <div>
        <DotRating
          value={form.focus_score}
          onChange={(v) => setField('focus_score', v)}
          max={5}
          label="Focus"
          color="#3D85C6"
        />
      </div>

      {/* Row 4: Topic, Resources */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Topic</span>
          <input
            type="text"
            value={form.topic}
            onChange={(e) => setField('topic', e.target.value)}
            placeholder="Specific topic studied"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Resources</span>
          <input
            type="text"
            value={form.resources}
            onChange={(e) => setField('resources', e.target.value)}
            placeholder="Materials used"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>
      </div>

      {/* Row 5: Notes */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          placeholder="Session notes..."
          className="mt-1 block w-full resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
        />
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave || isPending}
          onClick={handleSave}
          className="rounded-md bg-productivity px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Saving...' : isEditing ? 'Update Session' : 'Save Session'}
        </button>
      </div>
    </div>
  );
}
