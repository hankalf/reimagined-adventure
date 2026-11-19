"use client";

import { useActionState } from "react";
import { saveSettingsAction, sendTestEmailAction, type SettingsState } from "./actions";

export function SettingsForms({ isAdmin, defaultHrEmails, companyName, adminEmail }: { isAdmin: boolean; defaultHrEmails: string; companyName: string; adminEmail: string }) {
  const [saveState, saveAction, saving] = useActionState<SettingsState, FormData>(saveSettingsAction, null);
  const [testState, testAction, testing] = useActionState<SettingsState, FormData>(sendTestEmailAction, null);
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold">Defaults</h2>
        <form action={saveAction} className="mt-3 space-y-3">
          <div>
            <label htmlFor="defaultHrEmails" className="label">
              Default HR recipients for new campaigns
            </label>
            <input id="defaultHrEmails" name="defaultHrEmails" defaultValue={defaultHrEmails} className="input" placeholder="hr@company.com, purchasing@company.com" disabled={!isAdmin} />
          </div>
          <div>
            <label htmlFor="companyName" className="label">
              Company name
            </label>
            <input id="companyName" name="companyName" defaultValue={companyName} className="input" disabled={!isAdmin} />
          </div>
          {isAdmin && (
            <button disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
          )}
          {saveState?.error && <p className="text-sm text-red-700">{saveState.error}</p>}
          {saveState?.success && <p className="text-sm text-emerald-700">{saveState.success}</p>}
        </form>
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Test email delivery</h2>
        <form action={testAction} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label htmlFor="to" className="label">
              Send a test to
            </label>
            <input id="to" name="to" defaultValue={adminEmail} className="input" />
          </div>
          <button disabled={testing} className="btn-secondary">
            {testing ? "Sending…" : "Send test"}
          </button>
          {testState?.error && <p className="w-full text-sm text-red-700">{testState.error}</p>}
          {testState?.success && <p className="w-full text-sm text-emerald-700">{testState.success}</p>}
        </form>
      </section>
    </div>
  );
}
