import { useState, useCallback } from 'react';
import type { Application } from '../../types/models';
import type { DropdownOptions } from '../../types/options';
import { useSaveApplication, useUpdateApplication } from '../../hooks/use-applications';
import { todayYMD } from '../../lib/date-utils';
import { useToast } from '../shared/Toast';

interface ApplicationFormProps {
  dropdownOptions: DropdownOptions;
  existingApp?: Application;
  onClose: () => void;
}

interface FormState {
  company: string;
  role: string;
  source: string;
  url: string;
  date_applied: string;
  notes: string;
  follow_up_date: string;
  salary: string;
  contact_name: string;
  contact_email: string;
  login_username: string;
  login_password: string;
}

function buildInitial(app?: Application): FormState {
  if (app) {
    return {
      company: app.company,
      role: app.role,
      source: app.source,
      url: app.url,
      date_applied: app.date_applied,
      notes: app.notes,
      follow_up_date: app.follow_up_date ?? '',
      salary: app.salary,
      contact_name: app.contact_name,
      contact_email: app.contact_email,
      login_username: app.login_username,
      login_password: app.login_password,
    };
  }
  return {
    company: '',
    role: '',
    source: '',
    url: '',
    date_applied: todayYMD(),
    notes: '',
    follow_up_date: '',
    salary: '',
    contact_name: '',
    contact_email: '',
    login_username: '',
    login_password: '',
  };
}

export default function ApplicationForm({
  dropdownOptions,
  existingApp,
  onClose,
}: ApplicationFormProps) {
  const [form, setForm] = useState<FormState>(() => buildInitial(existingApp));

  const saveMutation = useSaveApplication();
  const updateMutation = useUpdateApplication();
  const { show } = useToast();

  const isEditing = existingApp !== undefined;
  const isPending = saveMutation.isPending || updateMutation.isPending;

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const canSave = form.company.length > 0 && form.role.length > 0;

  const handleSave = useCallback(() => {
    const input = {
      company: form.company,
      role: form.role,
      source: form.source,
      url: form.url,
      date_applied: form.date_applied,
      notes: form.notes,
      follow_up_date: form.follow_up_date.length > 0 ? form.follow_up_date : null,
      salary: form.salary,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      login_username: form.login_username,
      login_password: form.login_password,
    };

    const onSuccess = () => {
      show(isEditing ? 'Application updated' : 'Application saved', 'success');
      onClose();
    };
    const onError = () => {
      show('Failed to save application', 'error');
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: existingApp.id, app: input },
        { onSuccess, onError },
      );
    } else {
      saveMutation.mutate(input, { onSuccess, onError });
    }
  }, [form, isEditing, existingApp, saveMutation, updateMutation, show, onClose]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-surface-dark">
        {isEditing ? 'Edit Application' : 'New Application'}
      </h3>

      {/* Row 1: Company, Role, Source */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Company *</span>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setField('company', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Role *</span>
          <input
            type="text"
            value={form.role}
            onChange={(e) => setField('role', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Source</span>
          <select
            value={form.source}
            onChange={(e) => setField('source', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          >
            <option value="">Select...</option>
            {dropdownOptions.app_sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 2: Date Applied, URL, Salary */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Date Applied</span>
          <input
            type="date"
            value={form.date_applied}
            onChange={(e) => setField('date_applied', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Job URL</span>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setField('url', e.target.value)}
            placeholder="https://..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Salary</span>
          <input
            type="text"
            value={form.salary}
            onChange={(e) => setField('salary', e.target.value)}
            placeholder="e.g. $120k-$150k"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>
      </div>

      {/* Row 3: Contact Name, Contact Email, Follow-up Date */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Contact Name</span>
          <input
            type="text"
            value={form.contact_name}
            onChange={(e) => setField('contact_name', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Contact Email</span>
          <input
            type="email"
            value={form.contact_email}
            onChange={(e) => setField('contact_email', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Follow-up Date</span>
          <input
            type="date"
            value={form.follow_up_date}
            onChange={(e) => setField('follow_up_date', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>
      </div>

      {/* Row 4: Login Username, Login Password */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Portal Username</span>
          <input
            type="text"
            value={form.login_username}
            onChange={(e) => setField('login_username', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Portal Password</span>
          <input
            type="password"
            value={form.login_password}
            onChange={(e) => setField('login_password', e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
          />
        </label>
      </div>

      {/* Row 5: Notes */}
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          rows={2}
          placeholder="Application notes..."
          className="mt-1 block w-full resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-productivity focus:outline-none focus:ring-1 focus:ring-productivity"
        />
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSave || isPending}
          onClick={handleSave}
          className="rounded-md bg-productivity px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? 'Saving...'
            : isEditing
              ? 'Update Application'
              : 'Save Application'}
        </button>
      </div>
    </div>
  );
}
