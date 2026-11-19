"use client";

import { useActionState, useState } from "react";
import { slugify } from "@/lib/utils";
import { createCampaignAction, type FormState } from "../actions";

export function NewCampaignForm({ existing }: { existing: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createCampaignAction, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-5">
      <div>
        <label htmlFor="name" className="label">
          Campaign name *
        </label>
        <input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Holiday Gifts 2026" required autoFocus />
      </div>
      <div>
        <label htmlFor="slug" className="label">
          Link (used in the QR code)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">/g/</span>
          <input id="slug" name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="input" placeholder={slugify(name || "holiday-2026")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="closesAt" className="label">
            Selections close
          </label>
          <input id="closesAt" name="closesAt" type="date" className="input" />
        </div>
        <div>
          <label htmlFor="defaultEmployeeBudget" className="label">
            Budget per employee
          </label>
          <input id="defaultEmployeeBudget" name="defaultEmployeeBudget" inputMode="decimal" className="input" placeholder="75" />
        </div>
        <div>
          <label htmlFor="totalBudget" className="label">
            Total budget
          </label>
          <input id="totalBudget" name="totalBudget" inputMode="decimal" className="input" placeholder="5000" />
        </div>
      </div>
      {existing.length > 0 && (
        <div>
          <label htmlFor="copyFrom" className="label">
            Copy gifts and branding from
          </label>
          <select id="copyFrom" name="copyFrom" className="input" defaultValue="">
            <option value="">Start empty</option>
            {existing.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
