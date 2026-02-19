import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InlineForm from '../InlineForm';

describe('InlineForm', () => {
  it('shows trigger when closed', () => {
    render(
      <InlineForm open={false} onToggle={vi.fn()} trigger={<span>Add</span>}>
        <span>Form content</span>
      </InlineForm>,
    );
    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.queryByText('Form content')).toBeNull();
  });

  it('shows children when open', () => {
    render(
      <InlineForm open onToggle={vi.fn()} trigger={<span>Add</span>}>
        <span>Form content</span>
      </InlineForm>,
    );
    expect(screen.getByText('Form content')).toBeInTheDocument();
    expect(screen.queryByText('Add')).toBeNull();
  });

  it('calls onToggle when trigger is clicked', () => {
    const onToggle = vi.fn();
    render(
      <InlineForm open={false} onToggle={onToggle} trigger={<span>Add</span>}>
        <span>Form content</span>
      </InlineForm>,
    );
    screen.getByText('Add').click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
