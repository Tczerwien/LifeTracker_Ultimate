import { useRef, useEffect, useCallback } from 'react';

interface JournalTextareaProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export default function JournalTextarea({
  label,
  placeholder,
  value,
  onChange,
  readOnly = false,
}: JournalTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${String(el.scrollHeight)}px`;
  }, []);

  // Adjust height when value changes externally (e.g., loading saved entry)
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div>
      <label className="mb-1 block text-body font-medium text-surface-dark">
        {label}
      </label>
      <textarea
        ref={textareaRef}
        rows={3}
        placeholder={placeholder}
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          if (!readOnly) {
            onChange(e.target.value);
            adjustHeight();
          }
        }}
        className={`w-full resize-none rounded-md border-gray-300 text-body focus:border-productivity focus:ring-productivity${
          readOnly ? ' bg-gray-50 cursor-not-allowed opacity-75' : ''
        }`}
      />
    </div>
  );
}
