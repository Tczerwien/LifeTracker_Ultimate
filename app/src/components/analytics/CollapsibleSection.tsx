import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export default function CollapsibleSection({
  id,
  title,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div id={id}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-gray-200 bg-white px-6 py-3 text-left"
      >
        <span className="text-section-header font-semibold uppercase tracking-wide text-surface-dark">
          {title}
        </span>
        <span
          className={`text-gray-400 transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          &#9656;
        </span>
      </button>
      {expanded && (
        <div className="space-y-6 px-6 py-4">{children}</div>
      )}
    </div>
  );
}
