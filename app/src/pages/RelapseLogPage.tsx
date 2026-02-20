import { useState, useCallback } from 'react';
import type { RelapseEntry } from '../types/models';
import { useRelapseEntries, useUrgeEntries } from '../hooks/use-recovery';
import { useConfig } from '../hooks/use-config';
import { todayYMD, addDays } from '../lib/date-utils';
import { isValidDropdownOptions, SEED_DROPDOWN_OPTIONS } from '../types/options';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import RelapseForm from '../components/recovery/RelapseForm';
import RelapseEntryList from '../components/recovery/RelapseEntryList';

type FormMode = 'create' | { edit: RelapseEntry };

function RelapseLogPage() {
  const today = todayYMD();
  const sevenDaysAgo = addDays(today, -7);

  const entriesQuery = useRelapseEntries(sevenDaysAgo, today);
  const todayUrgesQuery = useUrgeEntries(today, today);
  const configQuery = useConfig();

  const [formMode, setFormMode] = useState<FormMode>('create');

  const handleEdit = useCallback((entry: RelapseEntry) => {
    setFormMode({ edit: entry });
  }, []);

  const handleCloseEdit = useCallback(() => {
    setFormMode('create');
  }, []);

  const isLoading =
    entriesQuery.isLoading || todayUrgesQuery.isLoading || configQuery.isLoading;
  const isError =
    entriesQuery.isError || todayUrgesQuery.isError || configQuery.isError;

  const handleRetry = () => {
    void entriesQuery.refetch();
    void todayUrgesQuery.refetch();
    void configQuery.refetch();
  };

  if (isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-48 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load Relapse Log"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </div>
    );
  }

  const entries = entriesQuery.data ?? [];
  const todayUrges = todayUrgesQuery.data ?? [];
  const rawOptions = configQuery.data
    ? (JSON.parse(configQuery.data.dropdown_options) as unknown)
    : null;
  const dropdownOptions = isValidDropdownOptions(rawOptions)
    ? rawOptions
    : SEED_DROPDOWN_OPTIONS;

  return (
    <div className="p-section">
      <h1 className="text-xl font-semibold text-surface-dark">Relapse Log</h1>

      {/* Form — always visible */}
      <div
        className={`mt-card rounded-lg border bg-surface-kpi p-component ${
          formMode !== 'create'
            ? 'border-l-4 border-l-amber-400 border-y-gray-200 border-r-gray-200'
            : 'border-gray-200'
        }`}
      >
        {formMode === 'create' ? (
          <RelapseForm
            key="create"
            dropdownOptions={dropdownOptions}
            todayUrges={todayUrges}
          />
        ) : (
          <RelapseForm
            key={formMode.edit.id}
            dropdownOptions={dropdownOptions}
            todayUrges={todayUrges}
            existingEntry={formMode.edit}
            onClose={handleCloseEdit}
          />
        )}
      </div>

      {/* Recent entries */}
      <RelapseEntryList
        entries={entries}
        editingId={formMode !== 'create' ? formMode.edit.id : undefined}
        onEdit={handleEdit}
      />
    </div>
  );
}

export default RelapseLogPage;
