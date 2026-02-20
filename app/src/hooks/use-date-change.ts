import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../stores/ui-store';
import { todayYMD } from '../lib/date-utils';

const CHECK_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Detects midnight crossing while the app is open.
 * If the user was viewing "today" when the date changed,
 * advances selectedDate and invalidates all queries.
 */
export function useDateChange(): void {
  const queryClient = useQueryClient();
  const lastKnownDate = useRef(todayYMD());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = todayYMD();
      if (now !== lastKnownDate.current) {
        const prevToday = lastKnownDate.current;
        lastKnownDate.current = now;

        const { selectedDate, setSelectedDate } = useUIStore.getState();
        if (selectedDate === prevToday) {
          setSelectedDate(now);
        }

        void queryClient.invalidateQueries();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [queryClient]);
}
