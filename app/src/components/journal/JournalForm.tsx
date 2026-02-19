import { useState, useEffect, useRef, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';
import type { Journal } from '../../types/models';
import { useSaveJournal } from '../../hooks/use-journal';
import { useUIStore } from '../../stores/ui-store';
import { useToast } from '../shared/Toast';
import DotRating from '../shared/DotRating';
import ConfirmDialog from '../shared/ConfirmDialog';
import JournalTextarea from './JournalTextarea';

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

interface JournalFormState {
  mood: number;
  energy: number;
  highlight: string;
  gratitude: string;
  reflection: string;
  tomorrow_goal: string;
}

const DEFAULT_FORM: JournalFormState = {
  mood: 3,
  energy: 3,
  highlight: '',
  gratitude: '',
  reflection: '',
  tomorrow_goal: '',
};

function extractFormState(journal: Journal): JournalFormState {
  return {
    mood: journal.mood,
    energy: journal.energy,
    highlight: journal.highlight,
    gratitude: journal.gratitude,
    reflection: journal.reflection,
    tomorrow_goal: journal.tomorrow_goal,
  };
}

function formsDiffer(a: JournalFormState, b: JournalFormState): boolean {
  return (
    a.mood !== b.mood ||
    a.energy !== b.energy ||
    a.highlight !== b.highlight ||
    a.gratitude !== b.gratitude ||
    a.reflection !== b.reflection ||
    a.tomorrow_goal !== b.tomorrow_goal
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface JournalFormProps {
  date: string;
  journal: Journal | null;
}

export default function JournalForm({ date, journal }: JournalFormProps) {
  const initialState = journal !== null ? extractFormState(journal) : DEFAULT_FORM;

  const [formState, setFormState] = useState<JournalFormState>(initialState);
  const savedStateRef = useRef<JournalFormState>(initialState);
  const previousDateRef = useRef(date);
  const [pendingDateReset, setPendingDateReset] = useState(false);

  const saveMutation = useSaveJournal();
  const { show } = useToast();

  const isDirty = formsDiffer(formState, savedStateRef.current);

  // -----------------------------------------------------------------------
  // Reset form when date or loaded journal changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (date !== previousDateRef.current) {
      // Date changed — check if we need to guard unsaved changes
      if (formsDiffer(formState, savedStateRef.current)) {
        setPendingDateReset(true);
        return; // Don't reset yet — wait for user confirmation
      }
    }

    const next = journal !== null ? extractFormState(journal) : DEFAULT_FORM;
    setFormState(next);
    savedStateRef.current = next;
    previousDateRef.current = date;
  }, [date, journal]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Date change confirmation handlers
  // -----------------------------------------------------------------------
  const confirmDateChange = useCallback(() => {
    const next = journal !== null ? extractFormState(journal) : DEFAULT_FORM;
    setFormState(next);
    savedStateRef.current = next;
    previousDateRef.current = date;
    setPendingDateReset(false);
  }, [date, journal]);

  const cancelDateChange = useCallback(() => {
    useUIStore.getState().setSelectedDate(previousDateRef.current);
    setPendingDateReset(false);
  }, []);

  // -----------------------------------------------------------------------
  // Field updater
  // -----------------------------------------------------------------------
  const setField = useCallback(
    <K extends keyof JournalFormState>(key: K, value: JournalFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------
  const handleSave = useCallback(() => {
    saveMutation.mutate(
      { date, ...formState },
      {
        onSuccess: () => {
          savedStateRef.current = { ...formState };
          show('Journal saved', 'success');
        },
        onError: () => {
          show('Failed to save — please try again', 'error');
        },
      },
    );
  }, [date, formState, saveMutation, show]);

  // -----------------------------------------------------------------------
  // Route navigation blocker
  // -----------------------------------------------------------------------
  const blocker = useBlocker(isDirty);

  return (
    <div className="mt-4 space-y-6">
      {/* Mood & Energy */}
      <div className="space-y-3">
        <DotRating
          value={formState.mood}
          onChange={(v) => setField('mood', v)}
          max={5}
          label="Mood"
        />
        <DotRating
          value={formState.energy}
          onChange={(v) => setField('energy', v)}
          max={5}
          label="Energy"
          color="#6AA84F"
        />
      </div>

      {/* Text fields */}
      <JournalTextarea
        label="Highlight"
        placeholder="What went well today?"
        value={formState.highlight}
        onChange={(v) => setField('highlight', v)}
      />
      <JournalTextarea
        label="Gratitude"
        placeholder="What are you grateful for?"
        value={formState.gratitude}
        onChange={(v) => setField('gratitude', v)}
      />
      <JournalTextarea
        label="Reflection"
        value={formState.reflection}
        onChange={(v) => setField('reflection', v)}
      />
      <JournalTextarea
        label="Tomorrow's Goal"
        value={formState.tomorrow_goal}
        onChange={(v) => setField('tomorrow_goal', v)}
      />

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!isDirty || saveMutation.isPending}
          onClick={handleSave}
          className="rounded-md bg-productivity px-6 py-2 text-body font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Entry'}
        </button>
      </div>

      {/* Route navigation blocker dialog */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        message="You have unsaved journal changes. Leave anyway?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />

      {/* Date change dialog */}
      <ConfirmDialog
        open={pendingDateReset}
        title="Unsaved Changes"
        message="You have unsaved journal changes. Discard and switch dates?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="danger"
        onConfirm={confirmDateChange}
        onCancel={cancelDateChange}
      />
    </div>
  );
}
