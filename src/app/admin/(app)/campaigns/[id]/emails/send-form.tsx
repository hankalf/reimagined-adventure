"use client";

import { useActionState } from "react";
import { fmtDate } from "@/lib/utils";
import { sendHrEmailAction, type FormState } from "../../actions";

export function SendEmailForm({ campaignId, defaultTo, newCount, lastSent }: { campaignId: string; defaultTo: string; newCount: number; lastSent: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendHrEmailAction, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div>
        <label htmlFor="to" className="label">
          Send to
        </label>
        <input id="to" name="to" defaultValue={defaultTo} className="input" placeholder="hr@company.com, purchasing@company.com" required />
        <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" name="saveRecipients" className="h-3.5 w-3.5" /> Save these as the campaign&apos;s HR recipients
        </label>
      </div>
      <fieldset className="space-y-1 text-sm">
        <legend className="label">What to include</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="full" defaultChecked /> Everything to date (full list)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="mode" value="new" /> Only new selections since the last email
          <span className="text-xs text-slate-500">
            ({newCount} new{lastSent ? `, last sent ${fmtDate(lastSent, true)}` : ""})
          </span>
        </label>
      </fieldset>
      <button disabled={pending} className="btn-primary">
        {pending ? "Sending…" : "Send order list now"}
      </button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
