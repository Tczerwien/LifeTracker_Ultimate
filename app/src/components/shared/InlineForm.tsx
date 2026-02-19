import type { ReactNode } from 'react';

interface InlineFormProps {
  open: boolean;
  onToggle: () => void;
  trigger: ReactNode;
  children: ReactNode;
}

export default function InlineForm({
  open,
  onToggle,
  trigger,
  children,
}: InlineFormProps) {
  if (!open) {
    return (
      <div onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}>
        {trigger}
      </div>
    );
  }

  return (
    <div className="mt-card rounded-lg border border-gray-200 bg-surface-kpi p-component">
      {children}
    </div>
  );
}
