import { useState, useCallback } from 'react';
import type { UrgeEntry } from '../types/models';
import { useUrgeEntries } from '../hooks/use-recovery';
import { useConfig } from '../hooks/use-config';
import { todayYMD, addDays } from '../lib/date-utils';
import { isValidDropdownOptions, SEED_DROPDOWN_OPTIONS } from '../types/options';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import UrgeForm from '../components/recovery/UrgeForm';
import UrgeEntryList from '../components/recovery/UrgeEntryList';

type FormMode = 'create' | { edit: UrgeEntry };

function UrgeLogPage() {
  const today = todayYMD();
  const sevenDaysAgo = addDays(today, -7);

  const entriesQuery = useUrgeEntries(sevenDaysAgo, today);
  const configQuery = useConfig();

  const [formMode, setFormMode] = useState<FormMode>('create');

  const handleEdit = useCallback((entry: UrgeEntry) => {
    setFormMode({ edit: entry });
  }, []);

  const handleCloseEdit = useCallback(() => {
    setFormMode('create');
  }, []);

  const isLoading = entriesQuery.isLoading || configQuery.isLoading;
  const isError = entriesQuery.isError || configQuery.isError;

  if (isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-40 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="---"
          title="Could not load Urge Log"
          message="Check that the app data directory is accessible and try restarting."
        />
      </div>
    );
  }

  const entries = entriesQuery.data ?? [];
  const rawOptions = configQuery.data
    ? (JSON.parse(configQuery.data.dropdown_options) as unknown)
    : null;
  const dropdownOptions = isValidDropdownOptions(rawOptions)
    ? rawOptions
    : SEED_DROPDOWN_OPTIONS;

  return (
    <div className="p-section">
      <h1 className="text-xl font-semibold text-surface-dark">Urge Log</h1>

      {/* Form — always visible */}
      <div
        className={`mt-card rounded-lg border bg-surface-kpi p-component ${
          formMode !== 'create'
            ? 'border-l-4 border-l-amber-400 border-y-gray-200 border-r-gray-200'
            : 'border-gray-200'
        }`}
      >
        {formMode === 'create' ? (
          <UrgeForm key="create" dropdownOptions={dropdownOptions} />
        ) : (
          <UrgeForm
            key={formMode.edit.id}
            dropdownOptions={dropdownOptions}
            existingEntry={formMode.edit}
            onClose={handleCloseEdit}
          />
        )}
      </div>

      {/* Recent entries */}
      <UrgeEntryList
        entries={entries}
        editingId={formMode !== 'create' ? formMode.edit.id : undefined}
        onEdit={handleEdit}
      />
    </div>
  );
}

export default UrgeLogPage;
