import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';
import { ApplicationStatus } from '../../../types/enums';

describe('StatusBadge', () => {
  it('renders the correct label for Applied', () => {
    render(<StatusBadge status={ApplicationStatus.Applied} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('renders the correct label for Rejected', () => {
    render(<StatusBadge status={ApplicationStatus.Rejected} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders all 8 status values without error', () => {
    const statuses = Object.values(ApplicationStatus);
    for (const status of statuses) {
      const { unmount } = render(<StatusBadge status={status} />);
      // Just verify it renders — no error thrown
      expect(screen.getByText(/.+/)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies the correct color style', () => {
    render(<StatusBadge status={ApplicationStatus.Applied} />);
    const badge = screen.getByText('Applied').closest('span');
    expect(badge?.style.color).toBe('rgb(61, 133, 198)'); // #3D85C6
  });
});
