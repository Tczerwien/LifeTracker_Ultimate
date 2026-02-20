import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyStateCard from '../EmptyStateCard';

describe('EmptyStateCard', () => {
  it('renders icon, title, and message', () => {
    render(
      <EmptyStateCard
        icon="📊"
        title="Not enough data"
        message="Need 7 more days of data to show this chart."
      />,
    );
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(
      screen.getByText('Need 7 more days of data to show this chart.'),
    ).toBeInTheDocument();
  });

  it('does not render action button when onAction is omitted', () => {
    render(
      <EmptyStateCard icon="📊" title="Title" message="Message" />,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders action button when onAction is provided', () => {
    const handler = vi.fn();
    render(
      <EmptyStateCard
        icon="⚠️"
        title="Error"
        message="Something failed"
        actionLabel="Retry"
        onAction={handler}
      />,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('calls onAction when button is clicked', () => {
    const handler = vi.fn();
    render(
      <EmptyStateCard
        icon="⚠️"
        title="Error"
        message="Something failed"
        onAction={handler}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(handler).toHaveBeenCalledOnce();
  });
});
