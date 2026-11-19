"use client";

import { useActionState } from "react";
import { resendInviteAction, saveUserAction, type SettingsState } from "../actions";

function Result({ state }: { state: SettingsState }) {
  if (!state) return null;
  return (
    <div className="mt-3 space-y-2 text-sm">
      {state.error && <p className="text-red-700">{state.error}</p>}
      {state.success && <p className="text-emerald-700">{state.success}</p>}
      {state.link && <input readOnly value={state.link} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}

export function UserForm({ initial }: { initial?: { id: string; name: string; email: string; role: "ADMIN" | "HR" } }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveUserAction, null);
  return (
    <form action={action} className="mt-3 space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label htmlFor="user-name" className="label">
          Name
        </label>
        <input id="user-name" name="name" defaultValue={initial?.name} className="input" required />
      </div>
      <div>
        <label htmlFor="user-email" className="label">
          Email
        </label>
        <input id="user-email" name="email" type="email" defaultValue={initial?.email} className="input" required />
      </div>
      <div>
        <label htmlFor="user-role" className="label">
          Role
        </label>
        <select id="user-role" name="role" defaultValue={initial?.role ?? "HR"} className="input">
          <option value="HR">HR — campaigns, orders, emails</option>
          <option value="ADMIN">ADMIN — everything, including users</option>
        </select>
      </div>
      <button disabled={pending} className="btn-primary">
        {pending ? "Saving…" : initial ? "Save changes" : "Add user and send invite"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ResendInviteButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(resendInviteAction, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-ghost btn-sm">
        {pending ? "…" : label}
      </button>
      {state?.link && (
        <div className="mt-1 w-72 text-left">
          <input readOnly value={state.link} className="input font-mono text-[10px]" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
