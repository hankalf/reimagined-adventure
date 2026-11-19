"use client";

import { useActionState } from "react";
import { saveOrdersWebhookAction, saveSettingsAction, testOrdersWebhookAction, type SettingsState } from "./actions";

export function DefaultsForm({ isAdmin, companyName }: { isAdmin: boolean; companyName: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, null);
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Defaults</h2>
      <form action={action} className="mt-3 space-y-3">
        <div>
          <label htmlFor="companyName" className="label">
            Company name
          </label>
          <input id="companyName" name="companyName" defaultValue={companyName} className="input" disabled={!isAdmin} />
        </div>
        {isAdmin && (
          <button disabled={pending} className="btn-primary">
            {pending ? "Saving…" : "Save"}
          </button>
        )}
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      </form>
    </section>
  );
}

export function WebhookForm({ isAdmin, url, secret, lastStatus, lastAt, lastError }: { isAdmin: boolean; url: string; secret: string; lastStatus: string | null; lastAt: string | null; lastError: string | null }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveOrdersWebhookAction, null);
  const [testState, testAction, testing] = useActionState<SettingsState, FormData>(testOrdersWebhookAction, null);
  return (
    <div>
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="webhook-url" className="label">
            Webhook URL (from Power Automate, Zapier, Make or your own endpoint)
          </label>
          <input id="webhook-url" name="url" defaultValue={url} className="input font-mono text-xs" placeholder="https://prod-00.westus.logic.azure.com:443/workflows/…" disabled={!isAdmin} />
        </div>
        <div>
          <label htmlFor="webhook-secret" className="label">
            Signing secret (optional)
          </label>
          <input id="webhook-secret" name="secret" defaultValue={secret} className="input font-mono text-xs" placeholder="Any random string; we send an HMAC-SHA256 signature header so your flow can verify it" disabled={!isAdmin} />
        </div>
        {isAdmin && (
          <button disabled={pending} className="btn-primary btn-sm">
            {pending ? "Saving…" : "Save webhook"}
          </button>
        )}
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
      </form>
      <form action={testAction} className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={testing || !url} className="btn-secondary btn-sm">
          {testing ? "Sending…" : "Send a test event"}
        </button>
        <span className="text-xs text-slate-500">
          Last delivery: {lastStatus ? `${lastStatus}${lastAt ? ` at ${new Date(lastAt).toLocaleString()}` : ""}` : "never"}
          {lastError ? ` — ${lastError}` : ""}
        </span>
        {testState?.error && <p className="w-full text-sm text-red-700">{testState.error}</p>}
        {testState?.success && <p className="w-full text-sm text-emerald-700">{testState.success}</p>}
      </form>
    </div>
  );
}
