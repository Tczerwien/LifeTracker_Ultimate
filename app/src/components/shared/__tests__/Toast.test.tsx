import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

/** Helper component that triggers toasts via buttons */
function Trigger() {
  const { show } = useToast();
  return (
    <>
      <button onClick={() => show('Saved!')}>success</button>
      <button onClick={() => show('New milestone!', 'milestone', '🏆')}>
        milestone
      </button>
    </>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no toasts initially', () => {
    renderWithProvider();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a success toast', () => {
    renderWithProvider();
    act(() => {
      screen.getByText('success').click();
    });
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('auto-dismisses after 3 seconds', () => {
    renderWithProvider();
    act(() => {
      screen.getByText('success').click();
    });
    expect(screen.getByText('Saved!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('Saved!')).toBeNull();
  });

  it('shows milestone variant with emoji', () => {
    renderWithProvider();
    act(() => {
      screen.getByText('milestone').click();
    });
    const toast = screen.getByText('New milestone!');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('stacks multiple toasts', () => {
    renderWithProvider();
    act(() => {
      screen.getByText('success').click();
      screen.getByText('milestone').click();
    });
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });
});
