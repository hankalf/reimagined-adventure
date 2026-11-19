"use client";

import { useActionState } from "react";
import { identifyAction, type IdentifyState } from "./actions";
import type { Dictionary } from "@/i18n/en";

export function IdentifyForm({ slug, t, requireLastName }: { slug: string; t: Dictionary; requireLastName: boolean }) {
  const [state, action, pending] = useActionState<IdentifyState, FormData>(identifyAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor="employeeNumber" className="label">
          {t.landing.employeeNumber}
        </label>
        <input
          id="employeeNumber"
          name="employeeNumber"
          className="input text-base"
          placeholder={t.landing.employeeNumberPlaceholder}
          autoComplete="off"
          inputMode="text"
          required
          autoFocus
        />
      </div>
      {requireLastName && (
        <div>
          <label htmlFor="lastName" className="label">
            {t.landing.lastName}
          </label>
          <input id="lastName" name="lastName" className="input text-base" placeholder={t.landing.lastNamePlaceholder} autoComplete="family-name" required />
        </div>
      )}
      {state?.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn w-full bg-brand text-white text-base py-3 hover:opacity-90 focus:ring-blue-300">
        {pending ? "…" : t.landing.continue}
      </button>
    </form>
  );
}
