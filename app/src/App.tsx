import { QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
      <HashRouter>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-white">
            <Routes>
              <Route path="/" element={<DailyLogPage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/study" element={<StudyLogPage />} />
              <Route path="/apps" element={<AppLogPage />} />
              <Route path="/review" element={<WeeklyReviewPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/recovery/urge" element={<UrgeLogPage />} />
              <Route path="/recovery/relapse" element={<RelapseLogPage />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
