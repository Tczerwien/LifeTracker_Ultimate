import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
