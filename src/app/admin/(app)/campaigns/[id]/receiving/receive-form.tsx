"use client";

import { useActionState } from "react";
import { receiveAction, type ReceiveState } from "../../actions";

export function ReceiveForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<ReceiveState, FormData>(receiveAction, null);
  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <textarea id="receive-tokens" name="tokens" rows={6} className="input font-mono text-sm" placeholder={"B0CHWRXH8B\n10004\nA7K2PQ"} autoFocus />
      <button disabled={pending} className="btn-primary">
        {pending ? "Matching…" : "Mark matching picks as received"}
      </button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state && !state.error && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm" data-receive-result>
          <p className="font-medium text-emerald-800">{state.total} pick(s) marked received.</p>
          {state.matched.length > 0 && (
            <ul className="mt-1 text-xs text-slate-700">
              {state.matched.map((m) => (
                <li key={m.label}>
                  <span className="font-mono">{m.label}</span> → {m.count} pick(s)
                </li>
              ))}
            </ul>
          )}
          {state.unmatched.length > 0 && <p className="mt-2 text-xs text-amber-800">No ordered pick matched: {state.unmatched.join(", ")}</p>}
        </div>
      )}
    </form>
  );
}
