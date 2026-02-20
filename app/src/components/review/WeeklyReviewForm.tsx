import { useState, useEffect, useRef, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';
import type { WeeklyReview } from '../../types/models';
import type { WeeklyReviewInput, WeeklyStats } from '../../types/commands';
import { useSaveWeeklyReview } from '../../hooks/use-review';
import { getISOWeekNumber, formatSnapshotTimestamp } from '../../lib/date-utils';
import { scoreColor } from '../../lib/score-utils';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import JournalTextarea from '../journal/JournalTextarea';

// ---------------------------------------------------------------------------
// Form state types
// ---------------------------------------------------------------------------

interface ReviewFormState {
  biggest_win: string;
  biggest_challenge: string;
  next_week_goal: string;
  reflection: string;
}

const DEFAULT_FORM: ReviewFormState = {
  biggest_win: '',
  biggest_challenge: '',
  next_week_goal: '',
  reflection: '',
};

function extractFormState(review: WeeklyReview): ReviewFormState {
  return {
    biggest_win: review.biggest_win,
    biggest_challenge: review.biggest_challenge,
    next_week_goal: review.next_week_goal,
    reflection: review.reflection,
  };
}

function formsDiffer(a: ReviewFormState, b: ReviewFormState): boolean {
  return (
    a.biggest_win !== b.biggest_win ||
    a.biggest_challenge !== b.biggest_challenge ||
    a.next_week_goal !== b.next_week_goal ||
    a.reflection !== b.reflection
  );
}

// ---------------------------------------------------------------------------
// Divergence detection
// ---------------------------------------------------------------------------

function statsHaveDiverged(live: WeeklyStats, saved: WeeklyReview): boolean {
  if (saved.snapshot_date === null) return false;

  const tolerance = 0.001;

  const scoresDiffer = (a: number | null, b: number | null): boolean => {
    if (a === null && b === null) return false;
    if (a === null || b === null) return true;
    return Math.abs(a - b) > tolerance;
  };

  return (
    scoresDiffer(live.avg_score, saved.avg_score) ||
    live.days_tracked !== (saved.days_tracked ?? 0) ||
    scoresDiffer(live.best_day_score, saved.best_day_score) ||
    scoresDiffer(live.worst_day_score, saved.worst_day_score) ||
    Math.abs(live.total_study_hours - (saved.study_hours ?? 0)) > tolerance ||
    live.applications_sent !== (saved.applications_sent ?? 0) ||
    live.relapses !== (saved.relapses ?? 0) ||
    live.urges_resisted !== (saved.urges_resisted ?? 0) ||
    scoresDiffer(live.current_streak, saved.streak_at_end)
  );
}

// ---------------------------------------------------------------------------
// Score snapshot parsing & sparkline
// ---------------------------------------------------------------------------

type ScoreSnapshotData = ReadonlyArray<number | null>;

function parseScoreSnapshot(json: string | null): ScoreSnapshotData | null {
  if (json === null) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length !== 7) return null;
    return parsed as ScoreSnapshotData;
  } catch {
    return null;
  }
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function ScoreSparkline({ data }: { data: ScoreSnapshotData }) {
  const maxScore = Math.max(
    ...data.filter((v): v is number => v !== null),
    0.01,
  );

  return (
    <div className="flex items-end gap-1">
      {data.map((score, i) => {
        const label = DAY_LABELS[i] ?? '';
        if (score === null) {
          return (
            <div key={label} className="flex flex-1 flex-col items-center">
              <div className="h-12 w-full rounded bg-gray-100" />
              <span className="mt-1 text-xs text-gray-400">{label}</span>
            </div>
          );
        }
        const height = Math.max((score / maxScore) * 48, 4);
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div
              className="w-full rounded"
              style={{
                height: `${String(height)}px`,
                backgroundColor: scoreColor(Math.min(score, 1)),
              }}
              title={`${label}: ${score.toFixed(2)}`}
            />
            <span className="mt-1 text-xs text-gray-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats panel
// ---------------------------------------------------------------------------

interface StatItem {
  label: string;
  value: string;
}

function formatScore(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(2);
}

function formatHours(v: number): string {
  if (v === 0) return '0h';
  return `${v.toFixed(1)}h`;
}

function formatStreak(v: number | null): string {
  if (v === null) return '—';
  return `${String(v)}d`;
}

function StatCell({ label, value }: StatItem) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold text-surface-dark">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

interface StatsPanelProps {
  liveStats: WeeklyStats;
  review: WeeklyReview | null;
  sparklineData: ScoreSnapshotData | null;
}

function StatsPanel({ liveStats, review, sparklineData }: StatsPanelProps) {
  const isSaved =
    review?.snapshot_date !== null && review?.snapshot_date !== undefined;

  const stats: StatItem[] = [
    {
      label: 'Average Score',
      value: formatScore(isSaved ? (review?.avg_score ?? null) : liveStats.avg_score),
    },
    {
      label: 'Days Tracked',
      value: String(isSaved ? (review?.days_tracked ?? 0) : liveStats.days_tracked),
    },
    {
      label: 'Best Day',
      value: formatScore(
        isSaved ? (review?.best_day_score ?? null) : liveStats.best_day_score,
      ),
    },
    {
      label: 'Worst Day',
      value: formatScore(
        isSaved ? (review?.worst_day_score ?? null) : liveStats.worst_day_score,
      ),
    },
    {
      label: 'Study Hours',
      value: formatHours(
        isSaved ? (review?.study_hours ?? 0) : liveStats.total_study_hours,
      ),
    },
    {
      label: 'Applications',
      value: String(
        isSaved ? (review?.applications_sent ?? 0) : liveStats.applications_sent,
      ),
    },
    {
      label: 'Relapses',
      value: String(isSaved ? (review?.relapses ?? 0) : liveStats.relapses),
    },
    {
      label: 'Urges Resisted',
      value: String(
        isSaved ? (review?.urges_resisted ?? 0) : liveStats.urges_resisted,
      ),
    },
    {
      label: 'Streak',
      value: formatStreak(
        isSaved ? (review?.streak_at_end ?? null) : liveStats.current_streak,
      ),
    },
  ];

  // habits_completed is only available after save (not in WeeklyStats)
  if (isSaved && review?.habits_completed != null) {
    stats.splice(4, 0, {
      label: 'Habits Completed',
      value: String(review.habits_completed),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Week at a Glance {isSaved ? '(Snapshot)' : '(Live)'}
      </h2>
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-gray-50 p-4">
        {stats.map((item) => (
          <StatCell key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      {sparklineData !== null ? (
        <ScoreSparkline data={sparklineData} />
      ) : (
        <p className="text-sm italic text-gray-400">
          Score sparkline available after saving snapshot
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

interface WeeklyReviewFormProps {
  weekStart: string;
  weekEnd: string;
  review: WeeklyReview | null;
  liveStats: WeeklyStats;
  onWeekRevert: () => void;
}

export default function WeeklyReviewForm({
  weekStart,
  weekEnd,
  review,
  liveStats,
  onWeekRevert,
}: WeeklyReviewFormProps) {
  const initialState =
    review !== null ? extractFormState(review) : DEFAULT_FORM;

  const [formState, setFormState] = useState<ReviewFormState>(initialState);
  const savedStateRef = useRef<ReviewFormState>(initialState);
  const previousWeekRef = useRef(weekStart);
  const [pendingWeekReset, setPendingWeekReset] = useState(false);

  const saveMutation = useSaveWeeklyReview();
  const { show } = useToast();

  const isDirty = formsDiffer(formState, savedStateRef.current);
  const isSaved =
    review?.snapshot_date !== null && review?.snapshot_date !== undefined;
  const hasDiverged =
    review !== null && statsHaveDiverged(liveStats, review);
  const sparklineData =
    review !== null ? parseScoreSnapshot(review.score_snapshot) : null;

  // -----------------------------------------------------------------------
  // Reset form when week or loaded review changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (weekStart !== previousWeekRef.current) {
      if (formsDiffer(formState, savedStateRef.current)) {
        setPendingWeekReset(true);
        return;
      }
    }

    const next = review !== null ? extractFormState(review) : DEFAULT_FORM;
    setFormState(next);
    savedStateRef.current = next;
    previousWeekRef.current = weekStart;
  }, [weekStart, review]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Week change confirmation handlers
  // -----------------------------------------------------------------------
  const confirmWeekChange = useCallback(() => {
    const next = review !== null ? extractFormState(review) : DEFAULT_FORM;
    setFormState(next);
    savedStateRef.current = next;
    previousWeekRef.current = weekStart;
    setPendingWeekReset(false);
  }, [weekStart, review]);

  const cancelWeekChange = useCallback(() => {
    onWeekRevert();
    setPendingWeekReset(false);
  }, [onWeekRevert]);

  // -----------------------------------------------------------------------
  // Field updater
  // -----------------------------------------------------------------------
  const setField = useCallback(
    <K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------
  const handleSave = useCallback(() => {
    const input: WeeklyReviewInput = {
      week_start: weekStart,
      week_end: weekEnd,
      week_number: getISOWeekNumber(weekStart),
      biggest_win: formState.biggest_win,
      biggest_challenge: formState.biggest_challenge,
      next_week_goal: formState.next_week_goal,
      reflection: formState.reflection,
    };
    saveMutation.mutate(input, {
      onSuccess: () => {
        savedStateRef.current = { ...formState };
        show('Weekly review saved', 'success');
      },
      onError: () => {
        show('Failed to save — please try again', 'error');
      },
    });
  }, [weekStart, weekEnd, formState, saveMutation, show]);

  // -----------------------------------------------------------------------
  // Route navigation blocker
  // -----------------------------------------------------------------------
  const blocker = useBlocker(isDirty);

  return (
    <div className="mt-4 space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Stats */}
        <StatsPanel
          liveStats={liveStats}
          review={review}
          sparklineData={sparklineData}
        />

        {/* Right: Reflection fields */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Reflections
          </h2>
          <JournalTextarea
            label="Biggest Win"
            value={formState.biggest_win}
            onChange={(v) => setField('biggest_win', v)}
            placeholder="What went best this week?"
            readOnly={isSaved}
          />
          <JournalTextarea
            label="Biggest Challenge"
            value={formState.biggest_challenge}
            onChange={(v) => setField('biggest_challenge', v)}
            placeholder="What was hardest?"
            readOnly={isSaved}
          />
          <JournalTextarea
            label="Next Week Goal"
            value={formState.next_week_goal}
            onChange={(v) => setField('next_week_goal', v)}
            placeholder="One concrete goal for next week"
            readOnly={isSaved}
          />
          <JournalTextarea
            label="Reflection"
            value={formState.reflection}
            onChange={(v) => setField('reflection', v)}
            placeholder="Free-form thoughts on the week"
            readOnly={isSaved}
          />
        </div>
      </div>

      {/* Save / Status row */}
      <div className="flex items-center justify-between">
        <div>
          {isSaved && review?.snapshot_date != null && (
            <p className="text-sm text-gray-500">
              Snapshot saved {formatSnapshotTimestamp(review.snapshot_date)}
            </p>
          )}
          {hasDiverged && (
            <p className="mt-1 text-sm text-amber-600">
              Stats have changed since snapshot was saved
            </p>
          )}
        </div>
        {!isSaved && (
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleSave}
            className="rounded-md bg-productivity px-6 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Snapshot'}
          </button>
        )}
      </div>

      {/* Route navigation blocker dialog */}
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Unsaved Changes"
        message="You have unsaved review changes. Leave anyway?"
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />

      {/* Week change dialog */}
      <ConfirmDialog
        open={pendingWeekReset}
        title="Unsaved Changes"
        message="You have unsaved review changes. Discard and switch weeks?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="danger"
        onConfirm={confirmWeekChange}
        onCancel={cancelWeekChange}
      />
    </div>
  );
}
