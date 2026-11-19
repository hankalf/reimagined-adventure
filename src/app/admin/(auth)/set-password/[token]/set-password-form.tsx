"use client";

import { useActionState } from "react";
import { setPasswordAction, type AuthState } from "../../actions";

export function SetPasswordForm({ token, name, email, firstTime }: { token: string; name: string; email: string; firstTime: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(setPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <h2 className="text-lg font-semibold">{firstTime ? `Welcome, ${name}` : "Choose a new password"}</h2>
      <p className="text-sm text-slate-600">
        {firstTime ? "Choose a password to finish setting up your account for " : "Setting a new password for "}
        <strong>{email}</strong>. At least 10 characters with a letter and a number.
      </p>
      <div>
        <label htmlFor="password" className="label">
          New password
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required autoFocus />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirm password
        </label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
      </div>
      {state?.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Save password and sign in"}
      </button>
    </form>
  );
}
