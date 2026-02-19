import { useState, useCallback } from 'react';
import type { StudySession } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { todayYMD, getWeekStart, addDays, compareDates } from '../../lib/date-utils';
import InlineForm from '../shared/InlineForm';
import WeekNavigator from './WeekNavigator';
import WeekStats from './WeekStats';
import SessionTable from './SessionTable';
import SessionForm from './SessionForm';

type FormMode = 'closed' | 'add' | { edit: StudySession };

interface StudyLogShellProps {
  sessions: StudySession[];
  weekStart: string;
  weekEnd: string;
  onWeekChange: (start: string) => void;
  dropdownOptions: DropdownOptions;
}

export default function StudyLogShell({
  sessions,
  weekStart,
  weekEnd,
  onWeekChange,
  dropdownOptions,
}: StudyLogShellProps) {
  const [formMode, setFormMode] = useState<FormMode>('closed');

  const today = todayYMD();
  const currentWeekStart = getWeekStart(today);
  const canGoNext = compareDates(weekStart, currentWeekStart) < 0;

  const handlePrev = useCallback(() => {
    onWeekChange(addDays(weekStart, -7));
  }, [weekStart, onWeekChange]);

  const handleNext = useCallback(() => {
    onWeekChange(addDays(weekStart, 7));
  }, [weekStart, onWeekChange]);

  const handleToday = useCallback(() => {
    onWeekChange(currentWeekStart);
  }, [currentWeekStart, onWeekChange]);

  const handleEdit = useCallback((session: StudySession) => {
    setFormMode({ edit: session });
  }, []);

  const handleCloseForm = useCallback(() => {
    setFormMode('closed');
  }, []);

  return (
    <div className="p-section">
      <h1 className="text-xl font-semibold text-surface-dark">Study Log</h1>

      <WeekNavigator
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        canGoNext={canGoNext}
      />

      <WeekStats sessions={sessions} />

      <SessionTable sessions={sessions} onEdit={handleEdit} />

      {/* Edit form (shown when a row is clicked) */}
      {typeof formMode === 'object' && (
        <div className="mt-card rounded-lg border border-gray-200 bg-surface-kpi p-component">
          <SessionForm
            dropdownOptions={dropdownOptions}
            existingSession={formMode.edit}
            onClose={handleCloseForm}
          />
        </div>
      )}

      {/* Add form */}
      <div className="mt-card">
        <InlineForm
          open={formMode === 'add'}
          onToggle={() =>
            setFormMode((prev) => (prev === 'add' ? 'closed' : 'add'))
          }
          trigger={
            <span className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-productivity hover:text-productivity">
              + Add Session
            </span>
          }
        >
          <SessionForm
            dropdownOptions={dropdownOptions}
            onClose={handleCloseForm}
          />
        </InlineForm>
      </div>
    </div>
  );
}
