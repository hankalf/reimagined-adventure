"use client";

import { useActionState } from "react";
import { resetUserPasswordAction, saveUserAction, type SettingsState } from "../actions";

function Result({ state }: { state: SettingsState }) {
  if (!state) return null;
  return (
    <div className="mt-3 space-y-2 text-sm">
      {state.error && <p className="text-red-700">{state.error}</p>}
      {state.success && <p className="text-emerald-700">{state.success}</p>}
      {state.tempPassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3" data-temp-password>
          <div className="text-xs text-amber-900">Username</div>
          <div className="font-mono text-base font-semibold">{state.username}</div>
          <div className="mt-1 text-xs text-amber-900">Temporary password</div>
          <div className="font-mono text-lg font-bold tracking-wide" data-temp-password-value>
            {state.tempPassword}
          </div>
        </div>
      )}
    </div>
  );
}

export function UserForm({ initial }: { initial?: { id: string; name: string; username: string; email: string; role: "ADMIN" | "HR" } }) {
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
        <label htmlFor="user-username" className="label">
          Username
        </label>
        <input id="user-username" name="username" defaultValue={initial?.username} className="input" required autoComplete="off" placeholder="e.g. jsmith" />
      </div>
      <div>
        <label htmlFor="user-role" className="label">
          Role
        </label>
        <select id="user-role" name="role" defaultValue={initial?.role ?? "HR"} className="input">
          <option value="HR">HR — campaigns, orders, exports</option>
          <option value="ADMIN">ADMIN — everything, including users</option>
        </select>
      </div>
      <div>
        <label htmlFor="user-email" className="label">
          Email (optional, for password-reset links)
        </label>
        <input id="user-email" name="email" type="email" defaultValue={initial?.email} className="input" />
      </div>
      <button disabled={pending} className="btn-primary">
        {pending ? "Saving…" : initial ? "Save changes" : "Add user and generate temporary password"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function ResetPasswordButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(resetUserPasswordAction, null);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-ghost btn-sm">
        {pending ? "…" : "Reset password"}
      </button>
      {state?.tempPassword && (
        <div className="mt-1 w-64 rounded border border-amber-300 bg-amber-50 p-2 text-left text-xs" data-temp-password>
          Temporary password (shown once): <span className="font-mono font-bold" data-temp-password-value>{state.tempPassword}</span>
        </div>
      )}
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
