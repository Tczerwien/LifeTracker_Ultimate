import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhoneInput from '../PhoneInput';

const defaultTiers = {
  t1Min: 61, t2Min: 181, t3Min: 301,
  t1Penalty: 0.03, t2Penalty: 0.07, t3Penalty: 0.12,
};

describe('PhoneInput', () => {
  it('renders with initial value', () => {
    render(<PhoneInput value={120} onBlur={vi.fn()} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes') as HTMLInputElement;
    expect(input.value).toBe('120');
  });

  it('calls onBlur with parsed int on valid blur', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={0} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes');
    fireEvent.change(input, { target: { value: '90' } });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith(90);
  });

  it('does not call onBlur when value is unchanged', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={120} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes');
    // Blur without changing — value stays '120'
    fireEvent.blur(input);
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('snaps back to last valid value on out-of-range blur (>1440)', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={60} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    fireEvent.blur(input);
    expect(onBlur).not.toHaveBeenCalled();
    expect(input.value).toBe('60');
  });

  it('snaps back to last valid value on negative blur', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={60} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(onBlur).not.toHaveBeenCalled();
    expect(input.value).toBe('60');
  });

  it('snaps back to last valid value on NaN blur', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={30} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onBlur).not.toHaveBeenCalled();
    expect(input.value).toBe('30');
  });

  it('accepts boundary value 0', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={60} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes');
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith(0);
  });

  it('accepts boundary value 1440', () => {
    const onBlur = vi.fn();
    render(<PhoneInput value={60} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes');
    fireEvent.change(input, { target: { value: '1440' } });
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledWith(1440);
  });

  it('syncs when parent value prop changes', () => {
    const onBlur = vi.fn();
    const { rerender } = render(<PhoneInput value={60} onBlur={onBlur} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes') as HTMLInputElement;
    expect(input.value).toBe('60');

    rerender(<PhoneInput value={120} onBlur={onBlur} phoneTiers={defaultTiers} />);
    expect(input.value).toBe('120');
  });

  // Tier indicator tests
  it('shows "No penalty" when below tier 1', () => {
    render(<PhoneInput value={30} onBlur={vi.fn()} phoneTiers={defaultTiers} />);
    expect(screen.getByText('No penalty')).toBeInTheDocument();
  });

  it('shows Tier 1 indicator for values >= t1Min', () => {
    render(<PhoneInput value={0} onBlur={vi.fn()} phoneTiers={defaultTiers} />);
    const input = screen.getByLabelText('Phone use in minutes');
    fireEvent.change(input, { target: { value: '90' } });
    expect(screen.getByText('Tier 1: 0.03 penalty')).toBeInTheDocument();
  });

  it('shows Tier 2 indicator for values >= t2Min', () => {
    render(<PhoneInput value={200} onBlur={vi.fn()} phoneTiers={defaultTiers} />);
    expect(screen.getByText('Tier 2: 0.07 penalty')).toBeInTheDocument();
  });

  it('shows Tier 3 indicator for values >= t3Min', () => {
    render(<PhoneInput value={350} onBlur={vi.fn()} phoneTiers={defaultTiers} />);
    expect(screen.getByText('Tier 3: 0.12 penalty')).toBeInTheDocument();
  });
});
