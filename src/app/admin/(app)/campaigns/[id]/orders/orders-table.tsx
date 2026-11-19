"use client";

import { useRef, useState } from "react";
import { StatusBadge } from "@/components/ui";
import { fmtDate, money } from "@/lib/utils";
import { ordersAction } from "../../actions";

export type OrderRow = {
  id: string;
  employeeNumber: string;
  name: string;
  department: string | null;
  itemName: string;
  itemType: "PRODUCT" | "CUSTOM";
  optionText: string;
  cost: number | null;
  status: string;
  code: string;
  selectedAt: string;
  productUrl: string | null;
  overBudget: boolean;
};

const NEXT: Record<string, { status: string; label: string } | undefined> = {
  SELECTED: { status: "ORDERED", label: "Mark ordered" },
  ORDERED: { status: "RECEIVED", label: "Mark received" },
  RECEIVED: { status: "COLLECTED", label: "Mark collected" },
};

export function OrdersTable({ campaignId, rows, currency, returnTo }: { campaignId: string; rows: OrderRow[]; currency: string; returnTo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <form ref={formRef} action={ordersAction}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm">
        <span className="text-slate-600">{selected.size} selected</span>
        <span className="text-slate-300">|</span>
        <span className="text-slate-500">Set status:</span>
        {["ORDERED", "RECEIVED", "COLLECTED", "SELECTED"].map((s) => (
          <button key={s} name="bulk" value={s} disabled={selected.size === 0} className="btn-secondary btn-sm">
            {s === "SELECTED" ? "Back to “to order”" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4" />
              </th>
              <th>Employee</th>
              <th>Gift</th>
              <th className="text-right">Cost</th>
              <th>Status</th>
              <th>Code</th>
              <th>Picked</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No selections match.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const next = NEXT[r.status];
              return (
                <tr key={r.id} className={r.status === "NEEDS_REPICK" ? "bg-amber-50/50" : ""}>
                  <td>
                    <input type="checkbox" name="ids" value={r.id} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4" aria-label={`Select ${r.name}`} />
                  </td>
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono">{r.employeeNumber}</span>
                      {r.department && ` · ${r.department}`}
                    </div>
                  </td>
                  <td>
                    <div>
                      {r.itemName}
                      {r.optionText && <span className="text-slate-500"> · {r.optionText}</span>}
                    </div>
                    <div className="text-xs">
                      {r.itemType === "CUSTOM" && <span className="text-emerald-800">Custom · </span>}
                      {r.productUrl && (
                        <a href={r.productUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                          Product link ↗
                        </a>
                      )}
                      {r.overBudget && <span className="ml-1 text-red-700">Over budget</span>}
                    </div>
                  </td>
                  <td className="text-right">{money(r.cost, currency)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="font-mono text-xs">{r.code}</td>
                  <td className="text-xs text-slate-600">{fmtDate(r.selectedAt, true)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {next && (
                        <button name="single" value={`${r.id}:${next.status}`} className={`btn-sm ${r.status === "RECEIVED" ? "btn-primary" : "btn-secondary"}`}>
                          {next.label}
                        </button>
                      )}
                      <button
                        name="single"
                        value={`${r.id}:RESET`}
                        className="btn-ghost btn-sm text-red-700"
                        onClick={(e) => {
                          if (!window.confirm(`Reset ${r.name}'s selection? They will be able to pick again.`)) e.preventDefault();
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
