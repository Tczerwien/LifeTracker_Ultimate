import { create } from 'zustand';

/** Analytics time window options */
export type AnalyticsWindow = '7d' | '30d' | '90d' | 'all';

interface UIState {
  selectedDate: string;
  sidebarOpen: boolean;
  activeAnalyticsSection: string | null;
  analyticsWindow: AnalyticsWindow;
  recoveryExpanded: boolean;

  setSelectedDate: (date: string) => void;
  toggleSidebar: () => void;
  setActiveAnalyticsSection: (section: string | null) => void;
  setAnalyticsWindow: (window: AnalyticsWindow) => void;
  toggleRecoveryExpanded: () => void;
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedDate: getTodayString(),
  sidebarOpen: true,
  activeAnalyticsSection: null,
  analyticsWindow: '30d',
  recoveryExpanded: false,

  setSelectedDate: (date) => set({ selectedDate: date }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveAnalyticsSection: (section) => set({ activeAnalyticsSection: section }),
  setAnalyticsWindow: (window) => set({ analyticsWindow: window }),
  toggleRecoveryExpanded: () => set((state) => ({ recoveryExpanded: !state.recoveryExpanded })),
}));
