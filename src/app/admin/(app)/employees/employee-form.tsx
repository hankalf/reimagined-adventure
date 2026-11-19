"use client";

import { useActionState } from "react";
import { saveEmployeeAction, type EmployeeFormState } from "./actions";

export function EmployeeForm({ initial }: { initial?: { id: string; employeeNumber: string; firstName: string; lastName: string; department: string | null; email: string | null; active: boolean } }) {
  const [state, action, pending] = useActionState<EmployeeFormState, FormData>(saveEmployeeAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6 sm:items-end">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor={`num-${initial?.id ?? "new"}`}>
          Employee #
        </label>
        <input id={`num-${initial?.id ?? "new"}`} name="employeeNumber" defaultValue={initial?.employeeNumber} className="input" required />
      </div>
      <div>
        <label className="label">First name</label>
        <input name="firstName" defaultValue={initial?.firstName} className="input" />
      </div>
      <div>
        <label className="label">Last name</label>
        <input name="lastName" defaultValue={initial?.lastName} className="input" required />
      </div>
      <div>
        <label className="label">Department</label>
        <input name="department" defaultValue={initial?.department ?? ""} className="input" />
      </div>
      <div>
        <label className="label">Email (optional)</label>
        <input name="email" type="email" defaultValue={initial?.email ?? ""} className="input" />
      </div>
      <div className="flex items-center gap-3">
        {initial && (
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4" /> Active
          </label>
        )}
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : initial ? "Save" : "Add"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-700 sm:col-span-6">{state.error}</p>}
      {state?.success && <p className="text-sm text-emerald-700 sm:col-span-6">{state.success}</p>}
    </form>
  );
}
