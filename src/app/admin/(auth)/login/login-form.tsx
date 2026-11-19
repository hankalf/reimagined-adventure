"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" required autoFocus />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/forgot-password" className="text-blue-700 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
