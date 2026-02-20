import { useState, useCallback, useMemo } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { AppConfig } from '../../types/models';
import type { DbStats } from '../../types/commands';
import {
  DROPDOWN_OPTION_KEYS,
  READ_ONLY_DROPDOWN_KEYS,
  isValidDropdownOptions,
  SEED_DROPDOWN_OPTIONS,
} from '../../types/options';
import type { DropdownOptions } from '../../types/options';
import {
  useExportData,
  useImportData,
  useBackupNow,
  useGenerateTestData,
  readTextFile,
  writeTextFile,
} from '../../hooks/use-data';
import { useSaveConfig } from '../../hooks/use-config';
import { useToast } from '../shared/Toast';
import ConfirmDialog from '../shared/ConfirmDialog';
import DropdownListEditor, { DROPDOWN_KEY_LABELS } from './DropdownListEditor';

interface DataTabProps {
  dbStats: DbStats | undefined;
  dbPath: string | undefined;
  config: AppConfig;
}

/** Required items per dropdown key (items that cannot be removed). */
const REQUIRED_ITEMS: Partial<Record<keyof DropdownOptions, string[]>> = {
  study_locations: ['Other'],
  app_sources: ['Other'],
  relapse_location_options: ['Other'],
  relapse_activity_before_options: ['Other'],
  relapse_resistance_technique_options: ['None'],
  urge_technique_options: ['Other'],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface ImportPreview {
  json: string;
  meta: Record<string, unknown> | null;
  tables: { name: string; importCount: number; currentCount: number }[];
}

export default function DataTab({ dbStats, dbPath, config }: DataTabProps) {
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Parse dropdown options from config
  const parsedOptions = useMemo((): DropdownOptions => {
    try {
      const raw = JSON.parse(config.dropdown_options) as unknown;
      return isValidDropdownOptions(raw) ? raw : { ...SEED_DROPDOWN_OPTIONS };
    } catch {
      return { ...SEED_DROPDOWN_OPTIONS };
    }
  }, [config.dropdown_options]);

  // Local copy of dropdown options for editing
  const [localOptions, setLocalOptions] = useState<DropdownOptions>(parsedOptions);
  const [optionsDirty, setOptionsDirty] = useState(false);
  const [expandedKey, setExpandedKey] = useState<keyof DropdownOptions | null>(null);

  const exportMutation = useExportData();
  const importMutation = useImportData();
  const backupMutation = useBackupNow();
  const generateMutation = useGenerateTestData();
  const saveConfigMutation = useSaveConfig();
  const { show } = useToast();

  // ── Export ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      setBusy(true);
      const savePath = await save({
        title: 'Export Data',
        defaultPath: `ltu_export_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (!savePath) {
        setBusy(false);
        return;
      }

      const jsonData = await exportMutation.mutateAsync();
      await writeTextFile(savePath, jsonData);
      show(`Exported to ${savePath}`, 'success');
    } catch (err) {
      show(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [exportMutation, show]);

  // ── Import ──────────────────────────────────────────────────────────────

  const handleImportPick = useCallback(async () => {
    try {
      setBusy(true);
      const filePath = await open({
        title: 'Import Data',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
        directory: false,
      });

      if (!filePath) {
        setBusy(false);
        return;
      }

      const content = await readTextFile(filePath);
      const parsed = JSON.parse(content) as Record<string, unknown>;

      // Build preview
      const meta =
        typeof parsed['_meta'] === 'object' && parsed['_meta'] !== null
          ? (parsed['_meta'] as Record<string, unknown>)
          : null;

      const tables: { name: string; importCount: number; currentCount: number }[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        if (key === '_meta') continue;
        const importCount = Array.isArray(value)
          ? value.length
          : typeof value === 'object' && value !== null
            ? 1
            : 0;
        if (importCount === 0) continue;
        const currentCount =
          dbStats?.table_counts.find((t) => t.table_name === key)?.count ?? 0;
        tables.push({ name: key, importCount, currentCount });
      }

      setImportPreview({ json: content, meta, tables });
      setImportConfirmOpen(true);
    } catch (err) {
      show(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [show, dbStats]);

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview) return;
    try {
      setBusy(true);
      await importMutation.mutateAsync(importPreview.json);
      show('Data imported successfully — reloading...', 'success');
      setImportPreview(null);
      setImportConfirmOpen(false);
      // Reload to ensure all components re-mount with fresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      show(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [importPreview, importMutation, show]);

  // ── Backup ──────────────────────────────────────────────────────────────

  const handleBackup = useCallback(async () => {
    try {
      setBusy(true);
      const savePath = await save({
        title: 'Backup Database',
        defaultPath: `ltu_backup_${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });

      if (!savePath) {
        setBusy(false);
        return;
      }

      const dest = await backupMutation.mutateAsync(savePath);
      const sizeStr = dbStats ? formatBytes(dbStats.file_size_bytes) : '';
      show(`Backup saved to ${dest}${sizeStr ? ` (${sizeStr})` : ''}`, 'success');
    } catch (err) {
      show(
        `Backup failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [backupMutation, dbStats, show]);

  // ── Generate Test Data ────────────────────────────────────────────────

  const handleGenerateTestData = useCallback(async () => {
    try {
      setBusy(true);
      const summary = await generateMutation.mutateAsync();
      show(
        `Generated ${summary.daily_logs} daily logs, ${summary.journals} journals, ` +
        `${summary.study_sessions} study sessions, ${summary.applications} applications, ` +
        `${summary.relapse_entries} relapses, ${summary.urge_entries} urges, ` +
        `${summary.weekly_reviews} weekly reviews`,
        'success',
      );
    } catch (err) {
      show(
        `Generation failed: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [generateMutation, show]);

  // ── Dropdown list management ──────────────────────────────────────────

  const handleListChange = useCallback(
    (key: keyof DropdownOptions, newItems: string[]) => {
      setLocalOptions((prev) => ({ ...prev, [key]: newItems }));
      setOptionsDirty(true);
    },
    [],
  );

  const handleSaveDropdowns = useCallback(() => {
    const input = {
      start_date: config.start_date,
      multiplier_productivity: config.multiplier_productivity,
      multiplier_health: config.multiplier_health,
      multiplier_growth: config.multiplier_growth,
      target_fraction: config.target_fraction,
      vice_cap: config.vice_cap,
      streak_threshold: config.streak_threshold,
      streak_bonus_per_day: config.streak_bonus_per_day,
      max_streak_bonus: config.max_streak_bonus,
      phone_t1_min: config.phone_t1_min,
      phone_t2_min: config.phone_t2_min,
      phone_t3_min: config.phone_t3_min,
      phone_t1_penalty: config.phone_t1_penalty,
      phone_t2_penalty: config.phone_t2_penalty,
      phone_t3_penalty: config.phone_t3_penalty,
      correlation_window_days: config.correlation_window_days,
      dropdown_options: JSON.stringify(localOptions),
    };

    saveConfigMutation.mutate(input, {
      onSuccess: () => {
        show('Dropdown lists saved', 'success');
        setOptionsDirty(false);
      },
      onError: () => show('Failed to save dropdown lists', 'error'),
    });
  }, [config, localOptions, saveConfigMutation, show]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Database Stats */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark mb-3">
          Database Statistics
        </h3>
        {dbStats ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">File Size:</span>
              <span className="text-sm font-medium text-surface-dark">
                {formatBytes(dbStats.file_size_bytes)}
              </span>
            </div>
            {dbPath && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Location:</span>
                <code className="text-xs text-gray-500 break-all">{dbPath}</code>
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-body">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                      Table
                    </th>
                    <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 text-right">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dbStats.table_counts.map((tc) => (
                    <tr
                      key={tc.table_name}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <td className="px-4 py-1.5 text-sm text-gray-700">
                        {tc.table_name}
                      </td>
                      <td className="px-4 py-1.5 text-sm text-gray-700 text-right font-mono">
                        {tc.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Loading statistics...</p>
        )}
      </section>

      {/* Dropdown Options Management */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark mb-3">
          Dropdown Lists
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          These lists populate dropdown selectors across the app (study sessions, applications, recovery entries).
        </p>

        <div className="space-y-2">
          {DROPDOWN_OPTION_KEYS.map((key) => {
            const isReadOnly = (READ_ONLY_DROPDOWN_KEYS as readonly string[]).includes(key);
            const isExpanded = expandedKey === key;

            return (
              <div
                key={key}
                className="rounded-lg border border-gray-200"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedKey(isExpanded ? null : key)
                  }
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-700">
                    {DROPDOWN_KEY_LABELS[key]}
                    {isReadOnly && (
                      <span className="ml-2 text-xs text-gray-400">(read-only)</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    {localOptions[key].length} items
                    <span
                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    >
                      &#9656;
                    </span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <DropdownListEditor
                      listKey={key}
                      items={localOptions[key]}
                      readOnly={isReadOnly}
                      requiredItems={REQUIRED_ITEMS[key]}
                      onChange={(newItems) => handleListChange(key, newItems)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {optionsDirty && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveDropdowns}
              disabled={saveConfigMutation.isPending}
              className="rounded-md bg-productivity px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {saveConfigMutation.isPending ? 'Saving...' : 'Save Dropdown Lists'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLocalOptions(parsedOptions);
                setOptionsDirty(false);
              }}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        )}
      </section>

      {/* Data Operations */}
      <section>
        <h3 className="text-sm font-semibold text-surface-dark mb-3">
          Data Operations
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={busy}
            className="rounded-md bg-productivity px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => void handleImportPick()}
            disabled={busy}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import JSON
          </button>
          <button
            type="button"
            onClick={() => void handleBackup()}
            disabled={busy}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Backup Database
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateTestData()}
            disabled={busy}
            className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Test Data'}
          </button>
        </div>
      </section>

      {/* Import Confirmation Dialog */}
      {importPreview && (
        <ConfirmDialog
          open={importConfirmOpen}
          title="Confirm Import"
          message={`This will overwrite ALL current data. This cannot be undone.\n\n${importPreview.tables.map((t) => `${t.name}: ${t.currentCount} → ${t.importCount}`).join('\n')}`}
          confirmLabel="Import"
          variant="danger"
          onConfirm={() => void handleConfirmImport()}
          onCancel={() => {
            setImportConfirmOpen(false);
            setImportPreview(null);
          }}
        />
      )}
    </div>
  );
}
