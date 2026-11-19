"use client";

import { useState } from "react";

/** Toolbar above the catalog table: select all + bulk actions. Lives inside the table's form. */
export function BulkBar({ campaigns, categories }: { campaigns: Array<{ id: string; name: string; status: string }>; categories: string[] }) {
  const [count, setCount] = useState(0);
  function boxes(form: HTMLFormElement | null): HTMLInputElement[] {
    return form ? Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ids"]')) : [];
  }
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm"
      onChange={(e) => setCount(boxes((e.currentTarget as HTMLElement).closest("form")).filter((b) => b.checked).length)}
    >
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label="Select all"
          className="h-4 w-4"
          onChange={(e) => {
            const all = boxes(e.currentTarget.closest("form"));
            all.forEach((b) => (b.checked = e.currentTarget.checked));
            setCount(e.currentTarget.checked ? all.length : 0);
          }}
        />
        <span className="text-slate-600">{count} selected</span>
      </label>
      <span className="text-slate-300">|</span>
      <button name="intent" value="activate" className="btn-secondary btn-sm" disabled={count === 0}>
        Activate
      </button>
      <button name="intent" value="deactivate" className="btn-secondary btn-sm" disabled={count === 0}>
        Deactivate
      </button>
      <span className="flex items-center gap-1">
        <input name="bulkCategory" list="bulk-categories" placeholder="Category" className="input w-36 py-1 text-xs" />
        <datalist id="bulk-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button name="intent" value="category" className="btn-secondary btn-sm" disabled={count === 0}>
          Set category
        </button>
      </span>
      <span className="flex items-center gap-1">
        <select name="bulkCampaignId" className="input w-48 py-1 text-xs" defaultValue="">
          <option value="">Campaign…</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.status.toLowerCase()})
            </option>
          ))}
        </select>
        <button name="intent" value="addToCampaign" className="btn-primary btn-sm" disabled={count === 0}>
          Add to campaign
        </button>
      </span>
    </div>
  );
}
