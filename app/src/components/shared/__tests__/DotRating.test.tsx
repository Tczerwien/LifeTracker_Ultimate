import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DotRating from '../DotRating';

const defaultProps = {
  value: 3,
  onChange: vi.fn(),
  max: 5,
};

describe('DotRating', () => {
  it('renders the correct number of dots', () => {
    render(<DotRating {...defaultProps} />);
    const dots = screen.getAllByRole('button');
    expect(dots).toHaveLength(5);
  });

  it('displays filled dots up to value', () => {
    render(<DotRating {...defaultProps} value={3} max={5} />);
    const dots = screen.getAllByRole('button');
    // First 3 should be filled (have backgroundColor), last 2 should be outline (have borderColor)
    for (let i = 0; i < 3; i++) {
      expect(dots[i]!.style.backgroundColor).toBeTruthy();
    }
    for (let i = 3; i < 5; i++) {
      expect(dots[i]!.style.borderColor).toBeTruthy();
    }
  });

  it('calls onChange with the clicked dot value', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} onChange={onChange} />);
    screen.getByLabelText('3 of 5').click();
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with dot 1 when first dot clicked', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} onChange={onChange} />);
    screen.getByLabelText('1 of 5').click();
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('increments value on ArrowRight', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} value={3} onChange={onChange} />);
    const group = screen.getByRole('group');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('decrements value on ArrowLeft', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} value={3} onChange={onChange} />);
    const group = screen.getByRole('group');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('does not decrement below 1', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} value={1} onChange={onChange} />);
    const group = screen.getByRole('group');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not increment above max', () => {
    const onChange = vi.fn();
    render(<DotRating {...defaultProps} value={5} max={5} onChange={onChange} />);
    const group = screen.getByRole('group');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the numeric label', () => {
    render(<DotRating {...defaultProps} value={3} max={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
  });

  it('renders a text label when provided', () => {
    render(<DotRating {...defaultProps} label="Mood" />);
    expect(screen.getByText('Mood')).toBeInTheDocument();
  });

  it('uses smaller dots for max > 5', () => {
    render(<DotRating {...defaultProps} value={5} max={10} />);
    const dots = screen.getAllByRole('button');
    expect(dots[0]!.className).toContain('w-3');
  });

  it('uses larger dots for max <= 5', () => {
    render(<DotRating {...defaultProps} value={3} max={5} />);
    const dots = screen.getAllByRole('button');
    expect(dots[0]!.className).toContain('w-4');
  });
});
