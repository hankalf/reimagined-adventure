"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, type AuthState } from "../actions";

export function ChangePasswordForm({ name, forced }: { name: string; forced: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-semibold">{forced ? `Welcome, ${name}. Choose your own password` : "Change your password"}</h2>
      <p className="text-sm text-slate-600">{forced ? "You signed in with a temporary password. Pick a new one to continue." : "At least 10 characters with a letter and a number."}</p>
      <div>
        <label htmlFor="current" className="label">
          {forced ? "Temporary password" : "Current password"}
        </label>
        <input id="current" name="current" type="password" className="input" autoComplete="current-password" required autoFocus />
      </div>
      <div>
        <label htmlFor="password" className="label">
          New password
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={10} required />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirm new password
        </label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" minLength={10} required />
      </div>
      {state?.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Save new password"}
      </button>
      {!forced && (
        <p className="text-center text-sm">
          <Link href="/admin" className="text-blue-700 hover:underline">
            Cancel
          </Link>
        </p>
      )}
    </form>
  );
}
