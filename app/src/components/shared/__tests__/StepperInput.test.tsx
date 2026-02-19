import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StepperInput from '../StepperInput';

describe('StepperInput', () => {
  it('renders the current value', () => {
    render(<StepperInput value={3} onChange={vi.fn()} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('increments value on plus click', () => {
    const onChange = vi.fn();
    render(<StepperInput value={3} onChange={onChange} />);
    screen.getByLabelText('Increase').click();
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('decrements value on minus click', () => {
    const onChange = vi.fn();
    render(<StepperInput value={3} onChange={onChange} />);
    screen.getByLabelText('Decrease').click();
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables minus button at min', () => {
    render(<StepperInput value={0} onChange={vi.fn()} min={0} />);
    expect(screen.getByLabelText('Decrease')).toBeDisabled();
  });

  it('disables plus button at max', () => {
    render(<StepperInput value={10} onChange={vi.fn()} max={10} />);
    expect(screen.getByLabelText('Increase')).toBeDisabled();
  });

  it('uses custom step size', () => {
    const onChange = vi.fn();
    render(<StepperInput value={5} onChange={onChange} step={5} />);
    screen.getByLabelText('Increase').click();
    expect(onChange).toHaveBeenCalledWith(10);
  });

  it('clamps to min on decrement', () => {
    const onChange = vi.fn();
    render(<StepperInput value={2} onChange={onChange} min={0} step={5} />);
    screen.getByLabelText('Decrease').click();
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('clamps to max on increment', () => {
    const onChange = vi.fn();
    render(<StepperInput value={8} onChange={onChange} max={10} step={5} />);
    screen.getByLabelText('Increase').click();
    expect(onChange).toHaveBeenCalledWith(10);
  });
});
