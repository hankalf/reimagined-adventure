"use client";

import { useActionState } from "react";
import { importItemsAction, type ImportItemsState } from "./actions";

export function ImportItemsForm() {
  const [state, action, pending] = useActionState<ImportItemsState, FormData>(importItemsAction, null);
  return (
    <form action={action} className="space-y-3" encType="multipart/form-data">
      <div>
        <label htmlFor="items-file" className="label">
          Spreadsheet (.xlsx or .csv)
        </label>
        <input id="items-file" name="file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="input" required />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="downloadImages" defaultChecked className="h-4 w-4" />
        Download photos from the <code>image_url</code> column and store them in the portal (recommended; slower for big files)
      </label>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Importing…" : "Import gifts"}
      </button>
      {state?.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</div>}
      {state?.summary && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Imported: {state.summary.created} new, {state.summary.updated} updated, {state.summary.skipped} skipped.
          {state.summary.imagesStored > 0 && ` ${state.summary.imagesStored} photo(s) downloaded.`}
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
