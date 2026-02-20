import { useState, useCallback } from 'react';
import type { HabitConfig } from '../../types/models';
import type { HabitConfigSaveInput } from '../../types/commands';
import type { HabitConfigInput, HabitValidationContext } from '../../types/engine';
import { HabitPool, PenaltyMode } from '../../types/enums';
import { validateHabitConfig } from '../../engine/habit-validator';
import { useSaveHabitConfig, useRetireHabit } from '../../hooks/use-config';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';

interface VicesTabProps {
  habits: HabitConfig[];
}

function buildViceValidationContext(
  habits: HabitConfig[],
  currentId: number,
): HabitValidationContext {
  const others = habits.filter((h) => h.id !== currentId);
  return {
    activeGoodHabitCount: others.filter(
      (h) => h.pool === HabitPool.Good && h.is_active,
    ).length,
    tieredViceCount: others.filter(
      (h) => h.penalty_mode === PenaltyMode.Tiered,
    ).length,
    isNew: false,
    existingDisplayNames: others.map((h) => h.display_name),
  };
}

export default function VicesTab({ habits }: VicesTabProps) {
  const activeVices = habits
    .filter((h) => h.pool === HabitPool.Vice && h.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Vice inline editing
  const [editingVice, setEditingVice] = useState<{
    id: number;
    field: 'display_name' | 'penalty';
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [retireTarget, setRetireTarget] = useState<number | null>(null);

  const saveHabitMutation = useSaveHabitConfig();
  const retireMutation = useRetireHabit();
  const { show } = useToast();

  // ── Vice inline edit ────────────────────────────────────────────────────

  const startViceEdit = useCallback(
    (vice: HabitConfig, field: 'display_name' | 'penalty') => {
      setEditingVice({ id: vice.id, field });
      setEditValue(
        field === 'display_name' ? vice.display_name : String(vice.penalty),
      );
      setEditError(null);
    },
    [],
  );

  const saveViceEdit = useCallback(() => {
    if (!editingVice) return;
    const vice = habits.find((h) => h.id === editingVice.id);
    if (!vice) return;

    let newDisplayName = vice.display_name;
    let newPenalty = vice.penalty;

    if (editingVice.field === 'display_name') {
      newDisplayName = editValue.trim();
    } else {
      newPenalty = parseFloat(editValue);
      if (!Number.isFinite(newPenalty)) {
        setEditError('Must be a valid number');
        return;
      }
    }

    const input: HabitConfigInput = {
      display_name: newDisplayName,
      pool: 'vice',
      category: null,
      input_type: vice.input_type as 'checkbox' | 'dropdown' | 'number',
      points: 0,
      penalty: newPenalty,
      penalty_mode: vice.penalty_mode as 'flat' | 'per_instance' | 'tiered',
      options_json: vice.options_json,
      sort_order: vice.sort_order,
      is_active: 1,
    };
    const ctx = buildViceValidationContext(habits, vice.id);
    const result = validateHabitConfig(input, ctx);

    if (!result.valid) {
      setEditError(result.errors[0]?.message ?? 'Validation failed');
      return;
    }

    const saveInput: HabitConfigSaveInput = {
      id: vice.id,
      name: vice.name,
      display_name: newDisplayName,
      pool: vice.pool,
      category: vice.category,
      input_type: vice.input_type,
      points: 0,
      penalty: newPenalty,
      penalty_mode: vice.penalty_mode,
      options_json: vice.options_json,
      sort_order: vice.sort_order,
      is_active: vice.is_active,
      column_name: vice.column_name,
    };

    saveHabitMutation.mutate(saveInput, {
      onSuccess: () => {
        show('Vice updated', 'success');
        setEditingVice(null);
      },
      onError: () => show('Failed to update vice', 'error'),
    });
  }, [editingVice, editValue, habits, saveHabitMutation, show]);

  const cancelViceEdit = useCallback(() => {
    setEditingVice(null);
    setEditError(null);
  }, []);

  // ── Vice retire ─────────────────────────────────────────────────────────

  const handleConfirmRetire = useCallback(() => {
    if (retireTarget === null) return;
    retireMutation.mutate(retireTarget, {
      onSuccess: () => {
        show('Vice retired', 'success');
        setRetireTarget(null);
      },
      onError: () => {
        show('Failed to retire vice', 'error');
        setRetireTarget(null);
      },
    });
  }, [retireTarget, retireMutation, show]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Active vices table */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark mb-3">Active Vices</h3>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-body">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Penalty Mode
                </th>
                <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-gray-500">
                  Penalty
                </th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {activeVices.map((vice) => {
                const isTiered = vice.penalty_mode === PenaltyMode.Tiered;
                const isEditingName =
                  editingVice?.id === vice.id && editingVice.field === 'display_name';
                const isEditingPenalty =
                  editingVice?.id === vice.id && editingVice.field === 'penalty';

                return (
                  <tr key={vice.id} className="group border-b border-gray-100 hover:bg-gray-50">
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
                            onBlur={saveViceEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveViceEdit();
                              if (e.key === 'Escape') cancelViceEdit();
                            }}
                            className="w-full rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-productivity focus:outline-none"
                          />
                          {editError && (
                            <p className="mt-0.5 text-xs text-red-600">{editError}</p>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => startViceEdit(vice, 'display_name')}
                          className="cursor-pointer text-sm font-medium text-surface-dark hover:underline"
                        >
                          {vice.display_name}
                        </span>
                      )}
                    </td>

                    {/* Penalty Mode */}
                    <td className="px-4 py-2.5 text-sm text-gray-600">
                      {vice.penalty_mode}
                    </td>

                    {/* Penalty */}
                    <td className="px-4 py-2.5">
                      {isTiered ? (
                        <span className="text-sm text-gray-400" title="Managed in Scoring tab">
                          tiered
                        </span>
                      ) : isEditingPenalty ? (
                        <div>
                          <input
                            autoFocus
                            type="number"
                            step={0.01}
                            min={0}
                            max={1}
                            value={editValue}
                            onChange={(e) => {
                              setEditValue(e.target.value);
                              setEditError(null);
                            }}
                            onBlur={saveViceEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveViceEdit();
                              if (e.key === 'Escape') cancelViceEdit();
                            }}
                            className="w-24 rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-productivity focus:outline-none"
                          />
                          {editError && (
                            <p className="mt-0.5 text-xs text-red-600">{editError}</p>
                          )}
                        </div>
                      ) : (
                        <span
                          onClick={() => startViceEdit(vice, 'penalty')}
                          className="cursor-pointer text-sm text-gray-700 hover:underline"
                        >
                          {vice.penalty.toFixed(2)}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => setRetireTarget(vice.id)}
                        className="rounded px-2 py-0.5 text-xs text-gray-400 hover:text-red-500"
                      >
                        Retire
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Retire confirm dialog */}
      <ConfirmDialog
        open={retireTarget !== null}
        title="Retire Vice"
        message="This will deactivate the vice. Past data is preserved."
        confirmLabel="Retire"
        variant="danger"
        onConfirm={handleConfirmRetire}
        onCancel={() => setRetireTarget(null)}
      />
    </div>
  );
}
