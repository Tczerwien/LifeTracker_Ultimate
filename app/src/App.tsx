import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { ToastProvider } from './components/shared/Toast';
import ErrorBoundary from './components/shared/ErrorBoundary';
import Sidebar from './components/shared/Sidebar';
import { useUIStore } from './stores/ui-store';
import { useNarrowWindow } from './hooks/use-narrow-window';
import { useDateChange } from './hooks/use-date-change';
import DailyLogPage from './pages/DailyLogPage';
import JournalPage from './pages/JournalPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StudyLogPage from './pages/StudyLogPage';
import AppLogPage from './pages/AppLogPage';
import WeeklyReviewPage from './pages/WeeklyReviewPage';
import SettingsPage from './pages/SettingsPage';
import MilestonePage from './pages/MilestonePage';
import UrgeLogPage from './pages/UrgeLogPage';
import RelapseLogPage from './pages/RelapseLogPage';

function AppLayout() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isNarrow = useNarrowWindow();

  useDateChange();

  // Auto-collapse when window goes narrow
  useEffect(() => {
    if (isNarrow && sidebarOpen) {
      useUIStore.getState().setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNarrow]);

  return (
    <div className="flex h-screen">
      {sidebarOpen && <Sidebar />}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!sidebarOpen && (
          <div className="flex items-center border-b border-gray-200 bg-white px-4 py-2">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={toggleSidebar}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100"
            >
              {'\u2630'}
            </button>
            <span className="ml-3 text-sm font-semibold text-surface-dark">
              Life Tracker Ultimate
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <DailyLogPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'study', element: <StudyLogPage /> },
      { path: 'apps', element: <AppLogPage /> },
      { path: 'review', element: <WeeklyReviewPage /> },
      { path: 'milestones', element: <MilestonePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'recovery/urge', element: <UrgeLogPage /> },
      { path: 'recovery/relapse', element: <RelapseLogPage /> },
    ],
  },
]);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ErrorBoundary>
          <RouterProvider router={router} />
        </ErrorBoundary>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
