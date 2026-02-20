import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import DateNavigator from '../DateNavigator';
import { useUIStore } from '../../../stores/ui-store';
import * as dateUtils from '../../../lib/date-utils';

// Mock todayYMD so tests are deterministic
vi.spyOn(dateUtils, 'todayYMD').mockReturnValue('2026-02-18');

describe('DateNavigator', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedDate: '2026-02-17' });
  });

  it('renders the formatted selected date', () => {
    render(<DateNavigator />);
    expect(screen.getByText('Tuesday, February 17, 2026')).toBeInTheDocument();
  });

  it('navigates to previous day on left arrow click', () => {
    render(<DateNavigator />);
    act(() => {
      screen.getByLabelText('Previous day').click();
    });
    expect(useUIStore.getState().selectedDate).toBe('2026-02-16');
  });

  it('navigates to next day on right arrow click', () => {
    render(<DateNavigator />);
    act(() => {
      screen.getByLabelText('Next day').click();
    });
    expect(useUIStore.getState().selectedDate).toBe('2026-02-18');
  });

  it('disables right arrow when selectedDate is today', () => {
    useUIStore.setState({ selectedDate: '2026-02-18' });
    render(<DateNavigator />);
    expect(screen.getByLabelText('Next day')).toBeDisabled();
  });

  it('disables left arrow when selectedDate is minDate', () => {
    useUIStore.setState({ selectedDate: '2026-01-20' });
    render(<DateNavigator minDate="2026-01-20" />);
    expect(screen.getByLabelText('Previous day')).toBeDisabled();
  });

  it('in readOnly mode, shows only date text with no arrows', () => {
    render(<DateNavigator readOnly />);
    expect(screen.getByText('Tuesday, February 17, 2026')).toBeInTheDocument();
    expect(screen.queryByLabelText('Previous day')).toBeNull();
    expect(screen.queryByLabelText('Next day')).toBeNull();
  });

  it('opens date picker when date text is clicked', () => {
    render(<DateNavigator />);
    act(() => {
      screen.getByText('Tuesday, February 17, 2026').click();
    });
    // DatePicker renders day grid cells for the calendar
    expect(screen.getByRole('gridcell', { name: '17' })).toBeInTheDocument();
  });

  it('shows "(no entry)" when hasLogEntry is false and date is in the past', () => {
    useUIStore.setState({ selectedDate: '2026-02-16' });
    render(<DateNavigator hasLogEntry={false} />);
    expect(screen.getByText('(no entry)')).toBeInTheDocument();
  });

  it('does not show "(no entry)" when hasLogEntry is true', () => {
    useUIStore.setState({ selectedDate: '2026-02-16' });
    render(<DateNavigator hasLogEntry />);
    expect(screen.queryByText('(no entry)')).toBeNull();
  });

  it('does not show "(no entry)" for today even when hasLogEntry is false', () => {
    useUIStore.setState({ selectedDate: '2026-02-18' });
    render(<DateNavigator hasLogEntry={false} />);
    expect(screen.queryByText('(no entry)')).toBeNull();
  });
});
