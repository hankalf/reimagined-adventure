"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, type AuthState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotPasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-lg font-semibold">Reset your password</h2>
      <p className="text-sm text-slate-600">Enter your email and we will send you a link to choose a new password.</p>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" required autoFocus />
      </div>
      {state?.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      {state?.success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</div>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Send link"}
      </button>
      <p className="text-center text-sm">
        <Link href="/admin/login" className="text-blue-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
