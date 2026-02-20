import { useState, useCallback } from 'react';
import type { DropdownOptions } from '../../types/options';

interface DropdownListEditorProps {
  listKey: keyof DropdownOptions;
  items: string[];
  readOnly: boolean;
  requiredItems?: string[];
  onChange: (newItems: string[]) => void;
}

/** Human-friendly labels for each dropdown key. */
const KEY_LABELS: Record<keyof DropdownOptions, string> = {
  study_subjects: 'Study Subjects',
  study_types: 'Study Types',
  study_locations: 'Study Locations',
  app_sources: 'Application Sources',
  relapse_time_options: 'Relapse Time Buckets',
  relapse_duration_options: 'Relapse Duration',
  relapse_trigger_options: 'Relapse Triggers',
  relapse_location_options: 'Relapse Locations',
  relapse_device_options: 'Relapse Devices',
  relapse_activity_before_options: 'Activity Before Relapse',
  relapse_emotional_state_options: 'Emotional States',
  relapse_resistance_technique_options: 'Resistance Techniques',
  urge_technique_options: 'Urge Techniques',
  urge_duration_options: 'Urge Duration',
  urge_pass_options: 'Urge Pass Options',
};

export { KEY_LABELS as DROPDOWN_KEY_LABELS };

export default function DropdownListEditor({
  listKey,
  items,
  readOnly,
  requiredItems = [],
  onChange,
}: DropdownListEditorProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleItemChange = useCallback(
    (index: number, value: string) => {
      const updated = [...items];
      updated[index] = value;
      setLocalError(null);

      // Quick inline validation
      if (value.length > 100) {
        setLocalError(`Item ${index + 1} exceeds 100 characters`);
      }
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        const dupeIdx = updated.findIndex(
          (item, i) => i !== index && item.trim() === trimmed,
        );
        if (dupeIdx !== -1) {
          setLocalError(`Duplicate: "${trimmed}" already exists`);
        }
      }

      onChange(updated);
    },
    [items, onChange],
  );

  const handleAdd = useCallback(() => {
    if (items.length >= 50) return;
    onChange([...items, '']);
  }, [items, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      if (items.length <= 2) return;
      const target = items[index];
      if (target !== undefined && requiredItems.includes(target)) return;
      onChange(items.filter((_, i) => i !== index));
      setLocalError(null);
    },
    [items, requiredItems, onChange],
  );

  const label = KEY_LABELS[listKey];

  if (readOnly) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <span className="text-xs text-gray-400">(read-only)</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span
              key={i}
              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <div className="mt-1 space-y-1">
        {items.map((item, i) => {
          const isRequired = requiredItems.includes(item);
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(i, e.target.value)}
                maxLength={100}
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-productivity focus:outline-none"
              />
              {items.length > 2 && !isRequired ? (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  className="text-xs text-gray-400 hover:text-red-500"
                  title="Remove"
                >
                  &#10005;
                </button>
              ) : isRequired ? (
                <span className="text-xs text-gray-300" title="Required — cannot remove">
                  &#128274;
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {items.length < 50 && (
        <button
          type="button"
          onClick={handleAdd}
          className="mt-1 text-xs text-productivity hover:underline"
        >
          + Add item
        </button>
      )}
      {localError !== null && (
        <p className="mt-1 text-xs text-red-600">{localError}</p>
      )}
    </div>
  );
}
