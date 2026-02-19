import { QueryClientProvider } from '@tanstack/react-query';
import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom';
import { queryClient } from './lib/query-client';
import { ToastProvider } from './components/shared/Toast';
import Sidebar from './components/shared/Sidebar';
import DailyLogPage from './pages/DailyLogPage';
import JournalPage from './pages/JournalPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StudyLogPage from './pages/StudyLogPage';
import AppLogPage from './pages/AppLogPage';
import WeeklyReviewPage from './pages/WeeklyReviewPage';
import SettingsPage from './pages/SettingsPage';
import UrgeLogPage from './pages/UrgeLogPage';
import RelapseLogPage from './pages/RelapseLogPage';

function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white">
        <Outlet />
      </main>
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
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
