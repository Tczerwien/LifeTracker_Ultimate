import { useMemo } from 'react';
import { useUIStore } from '../../stores/ui-store';
import { useConfig } from '../../hooks/use-config';
import { getAnalyticsDateRange } from '../../lib/analytics-utils';
import WindowSelector from './WindowSelector';
import CollapsibleSection from './CollapsibleSection';
import OverviewSection from './OverviewSection';
import TrendsSection from './TrendsSection';
import CorrelationsSection from './CorrelationsSection';
import RecordsSection from './RecordsSection';

export default function AnalyticsShell() {
  const analyticsWindow = useUIStore((s) => s.analyticsWindow);
  const configQuery = useConfig();
  const configStartDate = configQuery.data?.start_date;

  const { start, end } = useMemo(
    () => getAnalyticsDateRange(analyticsWindow, configStartDate),
    [analyticsWindow, configStartDate],
  );

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-surface-dark">Analytics</h1>
        <WindowSelector />
      </div>

      {/* Sections */}
      <CollapsibleSection id="overview" title="Overview">
        <OverviewSection start={start} end={end} window={analyticsWindow} />
      </CollapsibleSection>

      <CollapsibleSection id="trends" title="Trends">
        <TrendsSection start={start} end={end} />
      </CollapsibleSection>

      <CollapsibleSection id="correlations" title="Correlations">
        <CorrelationsSection start={start} end={end} />
      </CollapsibleSection>

      <CollapsibleSection id="records" title="Records">
        <RecordsSection start={start} end={end} />
      </CollapsibleSection>
    </div>
  );
}
