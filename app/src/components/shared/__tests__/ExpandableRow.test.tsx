import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExpandableRow from '../ExpandableRow';

describe('ExpandableRow', () => {
  it('renders summary always', () => {
    render(
      <ExpandableRow summary={<span>Summary text</span>}>
        <span>Details</span>
      </ExpandableRow>,
    );
    expect(screen.getByText('Summary text')).toBeInTheDocument();
  });

  it('hides children by default', () => {
    render(
      <ExpandableRow summary={<span>Summary</span>}>
        <span>Details</span>
      </ExpandableRow>,
    );
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('shows children when clicked', () => {
    render(
      <ExpandableRow summary={<span>Summary</span>}>
        <span>Details</span>
      </ExpandableRow>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Details')).toBeInTheDocument();
  });

  it('collapses on second click', () => {
    render(
      <ExpandableRow summary={<span>Summary</span>}>
        <span>Details</span>
      </ExpandableRow>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Details')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('starts expanded when defaultExpanded is true', () => {
    render(
      <ExpandableRow summary={<span>Summary</span>} defaultExpanded>
        <span>Details</span>
      </ExpandableRow>,
    );
    expect(screen.getByText('Details')).toBeInTheDocument();
  });
});
