import { useState, type ReactNode } from 'react';

interface ExpandableRowProps {
  summary: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export default function ExpandableRow({
  summary,
  children,
  defaultExpanded = false,
}: ExpandableRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between px-component py-3 text-left hover:bg-gray-50"
      >
        <div className="flex-1">{summary}</div>
        <span
          className={`ml-2 text-gray-400 transition-transform duration-200 ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          &#9656;
        </span>
      </button>
      {expanded && <div className="px-component pb-component">{children}</div>}
    </div>
  );
}
