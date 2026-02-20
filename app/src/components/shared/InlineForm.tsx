import { useEffect, useRef, type ReactNode } from 'react';

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
  const formRef = useRef<HTMLDivElement>(null);

  // Auto-focus first focusable element when form opens
  useEffect(() => {
    if (open && formRef.current) {
      const firstInput = formRef.current.querySelector<HTMLElement>(
        'input, select, textarea',
      );
      firstInput?.focus();
    }
  }, [open]);

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
    <div
      ref={formRef}
      className="mt-card rounded-lg border border-gray-200 bg-surface-kpi p-component"
    >
      {children}
    </div>
  );
}
