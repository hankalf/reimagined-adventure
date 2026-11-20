"use client";

import { useActionState } from "react";
import { importEmployeesAction, type ImportState } from "./actions";

export function ImportForm({ campaignId, campaignAllEligible }: { campaignId?: string; campaignAllEligible?: boolean }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importEmployeesAction, null);
  return (
    <form action={action} className="space-y-3" encType="multipart/form-data">
      {campaignId && <input type="hidden" name="campaignId" value={campaignId} />}
      <div>
        <label htmlFor="file" className="label">
          CSV or Excel file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="input"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Minimum: an <strong>Employee #</strong> column and a <strong>Name</strong> column written <em>Last, First</em> (two last names are fine: <em>García López, María</em>). Optional:{" "}
          <code>first_name, last_name, second_last_name, department, email{campaignId ? ", budget" : ""}</code>. Headers are matched loosely; a sheet with no header row (employee # in column A, name in
          column B) also works.
          {campaignId && " The optional budget column sets a per-employee gift budget for this campaign."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs" data-employee-templates>
          <a href="/api/employees/template?layout=simple" className="btn-secondary btn-sm">
            ⬇ Simple template (Employee # + Name)
          </a>
          <a href="/api/employees/template" className="btn-secondary btn-sm">
            ⬇ Full Excel template
          </a>
          <a href="/api/employees/template?format=csv" className="btn-ghost btn-sm">
            Full CSV template
          </a>
        </div>
      </div>
      {!campaignId && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="deactivateMissing" className="h-4 w-4" />
          Deactivate employees who are not in this file
        </label>
      )}
      {campaignId && campaignAllEligible && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="keepAllEligible" className="h-4 w-4" />
          Keep “all employees eligible” (only import budgets, don’t restrict to this list)
        </label>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Importing…" : "Import employees"}
      </button>
      {state?.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      {state?.summary && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Imported: {state.summary.created} new, {state.summary.updated} updated, {state.summary.skipped} skipped.
          {state.summary.eligible !== undefined && ` ${state.summary.eligible} marked eligible for this campaign.`}
          {state.summary.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-amber-900">
              {state.summary.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
