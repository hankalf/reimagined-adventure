"use client";

import { useActionState, useEffect, useRef } from "react";
import { identifyAction, type IdentifyState } from "./actions";
import type { Dictionary } from "@/i18n/en";

export function IdentifyForm({ slug, t, requireLastName }: { slug: string; t: Dictionary; requireLastName: boolean }) {
  const [state, action, pending] = useActionState<IdentifyState, FormData>(identifyAction, null);
  const numberRef = useRef<HTMLInputElement>(null);

  // Jump straight into the first field on computers. Not on phones: the keyboard would pop up over the welcome
  // message as soon as the page opens.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px) and (hover: hover)").matches) numberRef.current?.focus();
  }, []);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor="employeeNumber" className="label">
          {t.landing.employeeNumber}
        </label>
        <input
          ref={numberRef}
          id="employeeNumber"
          name="employeeNumber"
          className="input min-h-12 text-base"
          placeholder={t.landing.employeeNumberPlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint={requireLastName ? "next" : "go"}
          required
        />
      </div>
      {requireLastName && (
        <div>
          <label htmlFor="lastName" className="label">
            {t.landing.lastName}
          </label>
          <input
            id="lastName"
            name="lastName"
            className="input min-h-12 text-base"
            placeholder={t.landing.lastNamePlaceholder}
            autoComplete="family-name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            required
          />
        </div>
      )}
      {state?.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </div>
      )}
      <button type="submit" disabled={pending} className="btn min-h-12 w-full bg-brand py-3 text-base text-white hover:opacity-90 focus:ring-blue-300">
        {pending ? "…" : t.landing.continue}
      </button>
    </form>
  );
}
