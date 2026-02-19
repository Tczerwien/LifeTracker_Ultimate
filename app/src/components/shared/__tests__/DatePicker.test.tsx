import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePicker from '../DatePicker';

const defaultProps = {
  selected: '2026-02-17',
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

describe('DatePicker', () => {
  it('renders a calendar', () => {
    render(<DatePicker {...defaultProps} />);
    // Should show the month name for the selected date
    expect(screen.getByText(/February/i)).toBeInTheDocument();
  });

  it('calls onSelect and onClose when a day is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <DatePicker {...defaultProps} onSelect={onSelect} onClose={onClose} />,
    );
    // Click day 10 (which should be available in February 2026)
    const day10 = screen.getByRole('gridcell', { name: '10' });
    fireEvent.click(day10.querySelector('button') ?? day10);
    expect(onSelect).toHaveBeenCalledWith('2026-02-10');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on outside click', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <DatePicker {...defaultProps} onClose={onClose} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
