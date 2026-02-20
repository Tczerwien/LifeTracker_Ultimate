import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useDateChange } from '../use-date-change';
import { useUIStore } from '../../stores/ui-store';
import * as dateUtils from '../../lib/date-utils';

const todayMock = vi.spyOn(dateUtils, 'todayYMD');

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDateChange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    todayMock.mockReturnValue('2026-02-18');
    useUIStore.setState({ selectedDate: '2026-02-18' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates selectedDate when midnight crosses and user was on today', () => {
    renderHook(() => useDateChange(), { wrapper: createWrapper() });

    // Simulate midnight crossing
    todayMock.mockReturnValue('2026-02-19');
    vi.advanceTimersByTime(60_000);

    expect(useUIStore.getState().selectedDate).toBe('2026-02-19');
  });

  it('does not update selectedDate if user was viewing a past date', () => {
    useUIStore.setState({ selectedDate: '2026-02-15' });
    renderHook(() => useDateChange(), { wrapper: createWrapper() });

    todayMock.mockReturnValue('2026-02-19');
    vi.advanceTimersByTime(60_000);

    // Should stay on the date the user was viewing
    expect(useUIStore.getState().selectedDate).toBe('2026-02-15');
  });
});
