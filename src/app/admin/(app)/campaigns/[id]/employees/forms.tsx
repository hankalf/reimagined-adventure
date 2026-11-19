"use client";

import { useActionState, useState } from "react";
import { addEligibleEmployeeAction, pickOnBehalfAction, type FormState } from "../../actions";

export function AddEligibleForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addEligibleEmployeeAction, null);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div>
        <label className="label" htmlFor="eligible-number">
          Employee #
        </label>
        <input id="eligible-number" name="employeeNumber" className="input w-32" required />
      </div>
      <div>
        <label className="label" htmlFor="eligible-budget">
          Budget (optional)
        </label>
        <input id="eligible-budget" name="budget" className="input w-28" inputMode="decimal" />
      </div>
      <button disabled={pending} className="btn-secondary">
        {pending ? "Adding…" : "Add"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}

type PickItem = { id: string; name: string; optionLabel: string | null; optionValues: string[]; outOfStock: boolean };

export function PickOnBehalfForm({ campaignId, employees, items }: { campaignId: string; employees: { id: string; label: string }[]; items: PickItem[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(pickOnBehalfAction, null);
  const [itemId, setItemId] = useState("");
  const item = items.find((i) => i.id === itemId);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div>
        <label className="label" htmlFor="obo-employee">
          Employee
        </label>
        <input id="obo-employee" name="employeeLabel" list="obo-employees" className="input" placeholder="Type a number or name" onChange={(e) => {
          const match = employees.find((emp) => emp.label === e.target.value);
          const hidden = e.currentTarget.form?.elements.namedItem("employeeId") as HTMLInputElement | null;
          if (hidden) hidden.value = match?.id ?? "";
        }} />
        <input type="hidden" name="employeeId" />
        <datalist id="obo-employees">
          {employees.map((e) => (
            <option key={e.id} value={e.label} />
          ))}
        </datalist>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="obo-item">
            Gift
          </label>
          <select id="obo-item" name="itemId" value={itemId} onChange={(e) => setItemId(e.target.value)} className="input" required>
            <option value="">Choose…</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.outOfStock}>
                {i.name}
                {i.outOfStock ? " (out of stock)" : ""}
              </option>
            ))}
          </select>
        </div>
        {item && item.optionValues.length > 0 && (
          <div>
            <label className="label" htmlFor="obo-option">
              {item.optionLabel}
            </label>
            <select id="obo-option" name="optionValue" className="input" required defaultValue="">
              <option value="">Choose…</option>
              {item.optionValues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button disabled={pending} className="btn-primary btn-sm">
        {pending ? "Saving…" : "Record pick"}
      </button>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700">{state.success}</p>}
    </form>
  );
}
