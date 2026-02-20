import { useState, useCallback, useRef, Fragment } from 'react';
import type { AppConfig, HabitConfig } from '../../types/models';
import type { HabitConfigSaveInput } from '../../types/commands';
import type { HabitConfigInput, HabitValidationContext } from '../../types/engine';
import { HabitPool, HabitCategory, InputType, PenaltyMode } from '../../types/enums';
import { CATEGORY_COLORS } from '../../lib/constants';
import { validateHabitConfig } from '../../engine/habit-validator';
import {
  useSaveHabitConfig,
  useRetireHabit,
  useReorderHabits,
} from '../../hooks/use-config';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import InlineForm from '../shared/InlineForm';

interface HabitsTabProps {
  habits: HabitConfig[];
  config: AppConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildValidationContext(
  habits: HabitConfig[],
  currentId: number | null,
): HabitValidationContext {
  const otherHabits = habits.filter((h) => h.id !== currentId);
  return {
    activeGoodHabitCount: otherHabits.filter(
      (h) => h.pool === HabitPool.Good && h.is_active,
    ).length,
    tieredViceCount: otherHabits.filter(
      (h) => h.penalty_mode === PenaltyMode.Tiered,
    ).length,
    isNew: currentId === null,
    existingDisplayNames: otherHabits.map((h) => h.display_name),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HabitsTab({ habits }: HabitsTabProps) {
  const activeGoodHabits = habits
    .filter((h) => h.pool === HabitPool.Good && h.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const retiredGoodHabits = habits.filter(
    (h) => h.pool === HabitPool.Good && !h.is_active,
  );

  const [editingCell, setEditingCell] = useState<{
    id: number;
    field: 'display_name' | 'points';
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [retireTarget, setRetireTarget] = useState<number | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Add habit form state
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<HabitCategory>(HabitCategory.Productivity);
  const [addInputType, setAddInputType] = useState<InputType>(InputType.Checkbox);
  const [addPoints, setAddPoints] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);

  // Dropdown options edit state (for expanded dropdown habits)
  const [optionsState, setOptionsState] = useState<
    { label: string; value: number }[] | null
  >(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const saveMutation = useSaveHabitConfig();
  const retireMutation = useRetireHabit();
  const reorderMutation = useReorderHabits();
  const { show } = useToast();

  // ── Inline edit ─────────────────────────────────────────────────────────

  const startEdit = useCallback(
    (habit: HabitConfig, field: 'display_name' | 'points') => {
      setEditingCell({ id: habit.id, field });
      setEditValue(
        field === 'display_name' ? habit.display_name : String(habit.points),
      );
      setEditError(null);
    },
    [],
  );

  const saveInlineEdit = useCallback(() => {
    if (!editingCell) return;
    const habit = habits.find((h) => h.id === editingCell.id);
    if (!habit) return;

    const { field } = editingCell;
    let newDisplayName = habit.display_name;
    let newPoints = habit.points;

    if (field === 'display_name') {
      newDisplayName = editValue.trim();
    } else {
      newPoints = parseInt(editValue, 10);
      if (!Number.isFinite(newPoints) || newPoints < 1) {
        setEditError('Points must be at least 1');
        return;
      }
    }

    // Validate
    const input: HabitConfigInput = {
      display_name: newDisplayName,
      pool: habit.pool as 'good' | 'vice',
      category: habit.category as 'productivity' | 'health' | 'growth' | null,
      input_type: habit.input_type as 'checkbox' | 'dropdown' | 'number',
      points: newPoints,
      penalty: habit.penalty,
      penalty_mode: habit.penalty_mode as 'flat' | 'per_instance' | 'tiered',
      options_json: habit.options_json,
      sort_order: habit.sort_order,
      is_active: 1,
    };
    const ctx = buildValidationContext(habits, habit.id);
    const result = validateHabitConfig(input, ctx);

    if (!result.valid) {
      setEditError(result.errors[0]?.message ?? 'Validation failed');
      return;
    }

    const saveInput: HabitConfigSaveInput = {
      id: habit.id,
      name: habit.name,
      display_name: newDisplayName,
      pool: habit.pool,
      category: habit.category,
      input_type: habit.input_type,
      points: newPoints,
      penalty: habit.penalty,
      penalty_mode: habit.penalty_mode,
      options_json: habit.options_json,
      sort_order: habit.sort_order,
      is_active: habit.is_active,
      column_name: habit.column_name,
    };

    saveMutation.mutate(saveInput, {
      onSuccess: () => {
        show('Habit updated', 'success');
        setEditingCell(null);
      },
      onError: () => show('Failed to update habit', 'error'),
    });
  }, [editingCell, editValue, habits, saveMutation, show]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditError(null);
  }, []);

  // ── Dropdown options editing ────────────────────────────────────────────

  const startOptionsEdit = useCallback((habit: HabitConfig) => {
    if (habit.options_json === null) return;
    try {
      const parsed = JSON.parse(habit.options_json) as Record<string, number>;
      const entries = Object.entries(parsed).map(([label, value]) => ({
        label,
        value: value as number,
      }));
      setOptionsState(entries);
      setOptionsError(null);
    } catch {
      setOptionsState([]);
    }
  }, []);

  const handleToggleExpand = useCallback(
    (habit: HabitConfig) => {
      if (expandedId === habit.id) {
        setExpandedId(null);
        setOptionsState(null);
      } else {
        setExpandedId(habit.id);
        if (habit.input_type === InputType.Dropdown) {
          startOptionsEdit(habit);
        }
      }
    },
    [expandedId, startOptionsEdit],
  );

  const saveOptions = useCallback(
    (habit: HabitConfig) => {
      if (!optionsState) return;

      const optionsObj: Record<string, number> = {};
      for (const opt of optionsState) {
        optionsObj[opt.label] = opt.value;
      }
      const optionsJson = JSON.stringify(optionsObj);
      const maxValue = Math.max(...optionsState.map((o) => o.value), 0);
      const newPoints = Math.max(habit.points, maxValue);

      const input: HabitConfigInput = {
        display_name: habit.display_name,
        pool: 'good',
        category: habit.category as 'productivity' | 'health' | 'growth' | null,
        input_type: 'dropdown',
        points: newPoints,
        penalty: 0,
        penalty_mode: 'flat',
        options_json: optionsJson,
        sort_order: habit.sort_order,
        is_active: 1,
      };
      const ctx = buildValidationContext(habits, habit.id);
      const result = validateHabitConfig(input, ctx);

      if (!result.valid) {
        setOptionsError(result.errors[0]?.message ?? 'Validation failed');
        return;
      }

      const saveInput: HabitConfigSaveInput = {
        id: habit.id,
        name: habit.name,
        display_name: habit.display_name,
        pool: habit.pool,
        category: habit.category,
        input_type: habit.input_type,
        points: newPoints,
        penalty: habit.penalty,
        penalty_mode: habit.penalty_mode,
        options_json: optionsJson,
        sort_order: habit.sort_order,
        is_active: habit.is_active,
        column_name: habit.column_name,
      };

      saveMutation.mutate(saveInput, {
        onSuccess: () => {
          show(
            newPoints > habit.points
              ? `Options saved. Points auto-updated to ${newPoints}`
              : 'Options saved',
            'success',
          );
          setOptionsError(null);
        },
        onError: () => show('Failed to save options', 'error'),
      });
    },
    [optionsState, habits, saveMutation, show],
  );

  // ── Retire ──────────────────────────────────────────────────────────────

  const handleConfirmRetire = useCallback(() => {
    if (retireTarget === null) return;

    const activeCount = habits.filter(
      (h) => h.pool === HabitPool.Good && h.is_active && h.id !== retireTarget,
    ).length;

    if (activeCount < 1) {
      show('Cannot retire the last active good habit', 'error');
      setRetireTarget(null);
      return;
    }

    retireMutation.mutate(retireTarget, {
      onSuccess: () => {
        show('Habit retired', 'success');
        setRetireTarget(null);
      },
      onError: () => {
        show('Failed to retire habit', 'error');
        setRetireTarget(null);
      },
    });
  }, [retireTarget, habits, retireMutation, show]);

  // ── Drag reorder ────────────────────────────────────────────────────────

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      dragOverItem.current = index;
    },
    [],
  );

  const handleDrop = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const reordered = [...activeGoodHabits];
    const [removed] = reordered.splice(dragItem.current, 1);
    if (removed) {
      reordered.splice(dragOverItem.current, 0, removed);
    }

    const ids = reordered.map((h) => h.id);
    reorderMutation.mutate(ids, {
      onSuccess: () => show('Order updated', 'success'),
      onError: () => show('Failed to reorder', 'error'),
    });

    dragItem.current = null;
    dragOverItem.current = null;
  }, [activeGoodHabits, reorderMutation, show]);

  // ── Add habit ───────────────────────────────────────────────────────────

  const handleAddHabit = useCallback(() => {
    setAddError(null);
    const trimmedName = addName.trim();
    if (trimmedName.length === 0) {
      setAddError('Name is required');
      return;
    }

    const slug = slugify(trimmedName);
    if (slug.length === 0) {
      setAddError('Name must contain at least one alphanumeric character');
      return;
    }

    const maxSort = Math.max(0, ...habits.map((h) => h.sort_order));

    const input: HabitConfigInput = {
      display_name: trimmedName,
      pool: 'good',
      category: addCategory as 'productivity' | 'health' | 'growth',
      input_type: addInputType as 'checkbox' | 'dropdown' | 'number',
      points: addPoints,
      penalty: 0,
      penalty_mode: 'flat',
      options_json:
        addInputType === InputType.Dropdown
          ? JSON.stringify({ None: 0, Done: addPoints })
          : null,
      sort_order: maxSort + 1,
      is_active: 1,
    };

    const ctx = buildValidationContext(habits, null);
    const result = validateHabitConfig(input, ctx);

    if (!result.valid) {
      setAddError(result.errors[0]?.message ?? 'Validation failed');
      return;
    }

    const saveInput: HabitConfigSaveInput = {
      id: null,
      name: slug,
      display_name: trimmedName,
      pool: HabitPool.Good,
      category: addCategory,
      input_type: addInputType,
      points: addPoints,
      penalty: 0,
      penalty_mode: PenaltyMode.Flat,
      options_json: input.options_json,
      sort_order: maxSort + 1,
      is_active: true,
      column_name: slug,
    };

    saveMutation.mutate(saveInput, {
      onSuccess: () => {
        show('Habit added', 'success');
        setAddName('');
        setAddPoints(1);
        setAddOpen(false);
        setAddError(null);
      },
      onError: () => show('Failed to add habit', 'error'),
    });
  }, [addName, addCategory, addInputType, addPoints, habits, saveMutation, show]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Active habits table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-body">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                Category
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                Input
              </th>
              <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                Points
              </th>
              <th className="w-24 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {activeGoodHabits.map((habit, index) => {
              const isExpanded = expandedId === habit.id;
              const isEditingName =
                editingCell?.id === habit.id && editingCell.field === 'display_name';
              const isEditingPoints =
                editingCell?.id === habit.id && editingCell.field === 'points';

              return (
                <Fragment key={habit.id}>
                  <tr
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    className="group border-b border-gray-100 hover:bg-gray-50"
                  >
                    {/* Drag handle */}
                    <td className="px-2 py-2.5 cursor-grab text-gray-400 text-center select-none">
                      &#8801;
                    </td>

                    {/* Name */}
                    <td className="px-4 py-2.5">
                      {isEditingName ? (
                        <div>
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setEditError(null);
                            }}
                            onBlur={saveInlineEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-productivity focus:outline-none"
                          />
                          {editError && (
                            <p className="mt-0.5 text-xs text-red-600">{editError}</p>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => startEdit(habit, 'display_name')}
                          className="cursor-pointer text-sm font-medium text-surface-dark hover:underline"
                        >
                          {habit.display_name}
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-2.5">
                      {habit.category && (
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{
                            backgroundColor:
                              CATEGORY_COLORS[habit.category] ?? '#6B7280',
                          }}
                        >
                          {habit.category}
                        </span>
                      )}
                    </td>

                    {/* Input type */}
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {habit.input_type}
                    </td>

                    {/* Points */}
                    <td className="px-4 py-2.5">
                      {isEditingPoints ? (
                        <div>
                          <input
                            autoFocus
                            type="number"
                            min={1}
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setEditError(null);
                            }}
                            onBlur={saveInlineEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-20 rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-productivity focus:outline-none"
                          />
                          {editError && (
                            <p className="mt-0.5 text-xs text-red-600">{editError}</p>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => startEdit(habit, 'points')}
                          className="cursor-pointer text-sm text-gray-700 hover:underline"
                        >
                          {habit.points}
                          {habit.input_type === InputType.Dropdown && (
                            <span className="ml-1 text-xs text-gray-400">(auto)</span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {habit.input_type === InputType.Dropdown && (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(habit)}
                            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          >
                            {isExpanded ? 'Close' : 'Options'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRetireTarget(habit.id)}
                          className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-red-500"
                        >
                          Retire
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded dropdown options editor */}
                  {isExpanded && habit.input_type === InputType.Dropdown && optionsState && (
                    <tr className="border-b border-gray-100">
                      <td colSpan={6} className="bg-gray-50/50 px-6 py-4">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Dropdown Options
                        </p>
                        <div className="space-y-2">
                          {optionsState.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => {
                                  const updated = [...optionsState];
                                  const target = updated[i];
                                  if (target) {
                                    target.label = e.target.value;
                                    setOptionsState(updated);
                                  }
                                }}
                                placeholder="Label"
                                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-productivity focus:outline-none"
                              />
                              <input
                                type="number"
                                min={0}
                                value={opt.value}
                                onChange={(e) => {
                                  const updated = [...optionsState];
                                  const target = updated[i];
                                  if (target) {
                                    target.value = parseFloat(e.target.value) || 0;
                                    setOptionsState(updated);
                                  }
                                }}
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-productivity focus:outline-none"
                              />
                              {optionsState.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOptionsState(
                                      optionsState.filter((_, j) => j !== i),
                                    );
                                  }}
                                  className="text-xs text-gray-400 hover:text-red-500"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {optionsState.length < 10 && (
                          <button
                            type="button"
                            onClick={() =>
                              setOptionsState([
                                ...optionsState,
                                { label: '', value: 0 },
                              ])
                            }
                            className="mt-2 text-xs text-productivity hover:underline"
                          >
                            + Add option
                          </button>
                        )}
                        {optionsError && (
                          <p className="mt-2 text-xs text-red-600">{optionsError}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveOptions(habit)}
                            disabled={saveMutation.isPending}
                            className="rounded-md bg-productivity px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                          >
                            Save Options
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(null);
                              setOptionsState(null);
                            }}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Habit */}
      <InlineForm
        open={addOpen}
        onToggle={() => {
          setAddOpen(!addOpen);
          setAddError(null);
        }}
        trigger={
          <span className="cursor-pointer text-sm font-medium text-productivity hover:underline">
            + Add Habit
          </span>
        }
      >
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-surface-dark">New Good Habit</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-600">Name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                maxLength={50}
                placeholder="Display name"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Category
              </label>
              <select
                value={addCategory}
                onChange={(e) => setAddCategory(e.target.value as HabitCategory)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-productivity focus:outline-none"
              >
                <option value={HabitCategory.Productivity}>Productivity</option>
                <option value={HabitCategory.Health}>Health</option>
                <option value={HabitCategory.Growth}>Growth</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Input Type
              </label>
              <select
                value={addInputType}
                onChange={(e) => setAddInputType(e.target.value as InputType)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-productivity focus:outline-none"
              >
                <option value={InputType.Checkbox}>Checkbox</option>
                <option value={InputType.Dropdown}>Dropdown</option>
                <option value={InputType.Number}>Number</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Points</label>
              <input
                type="number"
                min={1}
                value={addPoints}
                onChange={(e) => setAddPoints(parseInt(e.target.value, 10) || 1)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-productivity focus:outline-none"
              />
            </div>
          </div>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddHabit}
              disabled={saveMutation.isPending}
              className="rounded-md bg-productivity px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Add Habit
            </button>
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setAddError(null);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </InlineForm>

      {/* Retired habits */}
      {retiredGoodHabits.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRetired(!showRetired)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <span
              className={`transition-transform duration-200 ${showRetired ? 'rotate-90' : ''}`}
            >
              &#9656;
            </span>
            Retired Habits ({retiredGoodHabits.length})
          </button>
          {showRetired && (
            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/50">
              <table className="w-full text-left text-body">
                <tbody>
                  {retiredGoodHabits.map((habit) => (
                    <tr
                      key={habit.id}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-2 text-sm text-gray-400">
                        {habit.display_name}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {habit.category}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {habit.input_type}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {habit.retired_at ?? 'retired'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Retire confirm dialog */}
      <ConfirmDialog
        open={retireTarget !== null}
        title="Retire Habit"
        message="This will deactivate the habit. Past data is preserved and visible in historical entries."
        confirmLabel="Retire"
        variant="danger"
        onConfirm={handleConfirmRetire}
        onCancel={() => setRetireTarget(null)}
      />
    </div>
  );
}
