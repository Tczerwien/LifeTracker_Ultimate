import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useScoreTrend,
  useHabitCompletionRates,
  useViceFrequency,
  useDayOfWeekAverages,
  useCorrelationData,
  useStudySummary,
  useApplicationPipeline,
  useRecoveryFrequency,
} from '../use-analytics';
import { createWrapper } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useScoreTrend', () => {
  it('calls invoke with start and end', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useScoreTrend('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_score_trend', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('does not fetch with empty range', () => {
    const { result } = renderHook(
      () => useScoreTrend('', ''),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useHabitCompletionRates', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useHabitCompletionRates('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_habit_completion_rates', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useViceFrequency', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useViceFrequency('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_vice_frequency', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useDayOfWeekAverages', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useDayOfWeekAverages('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_day_of_week_averages', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useCorrelationData', () => {
  it('returns raw DailyLog rows for TS correlation engine', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useCorrelationData('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_correlation_data', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useStudySummary', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce({
      total_hours: 0,
      session_count: 0,
      avg_focus: 0,
      hours_by_subject: [],
    });
    const { result } = renderHook(
      () => useStudySummary('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_study_summary', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useApplicationPipeline', () => {
  it('calls invoke with no parameters', async () => {
    mockInvoke.mockResolvedValueOnce({ stages: [] });
    const { result } = renderHook(() => useApplicationPipeline(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_application_pipeline');
  });
});

describe('useRecoveryFrequency', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce({
      relapse_count: 0,
      urge_count: 0,
      urges_resisted: 0,
      weekly_data: [],
    });
    const { result } = renderHook(
      () => useRecoveryFrequency('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_recovery_frequency', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});
