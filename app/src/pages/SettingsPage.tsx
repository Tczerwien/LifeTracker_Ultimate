import { useState } from 'react';
import { useConfig, useHabitConfigs } from '../hooks/use-config';
import { useDbStats, useDbPath } from '../hooks/use-data';
import EmptyStateCard from '../components/shared/EmptyStateCard';
import GeneralTab from '../components/settings/GeneralTab';
import ScoringTab from '../components/settings/ScoringTab';
import HabitsTab from '../components/settings/HabitsTab';
import VicesTab from '../components/settings/VicesTab';
import DataTab from '../components/settings/DataTab';

type SettingsTab = 'general' | 'scoring' | 'habits' | 'vices' | 'data';

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'habits', label: 'Habits' },
  { key: 'vices', label: 'Vices' },
  { key: 'data', label: 'Data' },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const configQuery = useConfig();
  const habitsQuery = useHabitConfigs();
  const dbStatsQuery = useDbStats();
  const dbPathQuery = useDbPath();

  const isLoading = configQuery.isLoading || habitsQuery.isLoading;
  const isError = configQuery.isError || habitsQuery.isError;

  if (isLoading) {
    return (
      <div className="p-section space-y-4 animate-pulse">
        <div className="h-10 rounded bg-gray-100" />
        <div className="h-8 rounded bg-gray-100 w-2/3" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (isError || !configQuery.data || !habitsQuery.data) {
    return (
      <div className="p-section">
        <EmptyStateCard
          icon="⚠️"
          title="Could not load Settings"
          message="Check that the app data directory is accessible and try restarting."
        />
      </div>
    );
  }

  const config = configQuery.data;
  const habits = habitsQuery.data;

  return (
    <div className="p-section">
      <h1 className="text-xl font-semibold text-surface-dark">Settings</h1>

      {/* Tab bar */}
      <div className="mt-4 flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-productivity text-productivity'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'general' && (
          <GeneralTab
            config={config}
            dbStats={dbStatsQuery.data}
            dbPath={dbPathQuery.data}
          />
        )}
        {activeTab === 'scoring' && <ScoringTab config={config} />}
        {activeTab === 'habits' && <HabitsTab habits={habits} config={config} />}
        {activeTab === 'vices' && <VicesTab habits={habits} />}
        {activeTab === 'data' && (
          <DataTab
            dbStats={dbStatsQuery.data}
            dbPath={dbPathQuery.data}
            config={config}
          />
        )}
      </div>
    </div>
  );
}

export default SettingsPage;
