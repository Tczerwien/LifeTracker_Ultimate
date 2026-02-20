import { useState, useCallback } from 'react';
import { ApplicationStatus } from '../types/enums';
import type { AppFilters } from '../types/commands';
import { useApplications } from '../hooks/use-applications';
import { useConfig } from '../hooks/use-config';
import { isValidDropdownOptions, SEED_DROPDOWN_OPTIONS } from '../types/options';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import AppLogShell from '../components/apps/AppLogShell';

function AppLogPage() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus[]>([]);
  const [search, setSearch] = useState('');

  // Build filters for the query
  const filters: AppFilters = {
    ...(statusFilter.length > 0 ? { status: statusFilter as string[] } : {}),
    ...(search.length > 0 ? { search } : {}),
  };

  const appsQuery = useApplications(
    statusFilter.length > 0 || search.length > 0 ? filters : undefined,
  );
  const configQuery = useConfig();

  const isLoading = appsQuery.isLoading || configQuery.isLoading;
  const isError = appsQuery.isError || configQuery.isError;

  const handleRetry = () => {
    void appsQuery.refetch();
    void configQuery.refetch();
  };

  const handleStatusFilterChange = useCallback((statuses: ApplicationStatus[]) => {
    setStatusFilter(statuses);
  }, []);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
  }, []);

  if (isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-12 rounded bg-gray-100" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load App Log"
          message="Check that the app data directory is accessible and try restarting."
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </div>
    );
  }

  const applications = appsQuery.data ?? [];
  const rawOptions = configQuery.data
    ? (JSON.parse(configQuery.data.dropdown_options) as unknown)
    : null;
  const dropdownOptions = isValidDropdownOptions(rawOptions)
    ? rawOptions
    : SEED_DROPDOWN_OPTIONS;

  return (
    <AppLogShell
      applications={applications}
      dropdownOptions={dropdownOptions}
      statusFilter={statusFilter}
      onStatusFilterChange={handleStatusFilterChange}
      search={search}
      onSearchChange={handleSearchChange}
    />
  );
}

export default AppLogPage;
