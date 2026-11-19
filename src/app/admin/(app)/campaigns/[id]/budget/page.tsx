import Link from "next/link";
import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { money, SELECTION_STATUS_LABEL } from "@/lib/utils";

export default async function BudgetPage({ params }: PageProps<"/admin/campaigns/[id]/budget">) {
  const { id } = await params;
  const [campaign, data] = await Promise.all([db.campaign.findUniqueOrThrow({ where: { id } }), buildReportData(id)]);
  const cur = campaign.currency;
  const b = data.budget;
  const pct = b.totalBudget ? Math.min(100, Math.round((b.committed / b.totalBudget) * 100)) : null;
  const projected = data.counts.eligible * (data.campaign.defaultEmployeeBudget ?? 0);
  const overBudgetCount = data.employeeBudgets.filter((r) => r.overBudget).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total budget" value={b.totalBudget !== null ? money(b.totalBudget, cur) : "Not set"} hint="Set in Settings" />
        <Stat label="Committed" value={money(b.committed, cur)} hint={`${b.committedCount} selections${b.unpricedCount ? ` · ${b.unpricedCount} without a price` : ""}`} />
        <Stat label="Ordered so far" value={money(b.ordered, cur)} hint={`${b.orderedCount} selections`} />
        <Stat label="Remaining" value={b.remaining !== null ? money(b.remaining, cur) : "—"} tone={b.remaining !== null && b.remaining < 0 ? "warn" : "good"} />
      </div>
      {pct !== null && (
        <div className="card p-4">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Budget used</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
          </div>
          {data.campaign.defaultEmployeeBudget !== null && (
            <p className="mt-2 text-xs text-slate-500">
              If every eligible employee spent their full per-person budget ({money(data.campaign.defaultEmployeeBudget, cur)}), the campaign would cost about {money(projected, cur)}.
            </p>
          )}
        </div>
      )}

      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-semibold">Spend per gift</h2>
          <a href={`/api/export/${id}?type=summary`} className="btn-secondary btn-sm">
            ⬇ CSV
          </a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Gift</th>
              <th>Options</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit cost</th>
              <th className="text-right">Subtotal</th>
              <th className="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.summary.map((r) => (
              <tr key={`${r.itemId}-${r.option1Value}-${r.option2Value}`}>
                <td>{r.name}</td>
                <td>{r.optionText || "—"}</td>
                <td className="text-right">{r.quantity}</td>
                <td className="text-right">{money(r.unitCost, cur)}</td>
                <td className="text-right font-medium">{money(r.subtotal, cur)}</td>
                <td className="text-right text-slate-600">{r.subtotal !== null && b.committed > 0 ? `${Math.round((r.subtotal / b.committed) * 100)}%` : "—"}</td>
              </tr>
            ))}
            {data.summary.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No selections yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <h2 className="font-semibold">Per employee</h2>
            <p className="text-xs text-slate-500">
              Budget = this employee&apos;s override, else the campaign default.{" "}
              {overBudgetCount > 0 ? <span className="text-red-700">{overBudgetCount} over budget.</span> : "Nobody is over budget."}{" "}
              <Link href={`/admin/campaigns/${id}/employees`} className="text-blue-700 hover:underline">
                Edit budgets
              </Link>
            </p>
          </div>
          <a href={`/api/export/${id}?type=budget`} className="btn-secondary btn-sm">
            ⬇ CSV
          </a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th className="text-right">Budget</th>
              <th>Gift</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.employeeBudgets.map((r) => (
              <tr key={r.employeeNumber} className={r.overBudget ? "bg-red-50/60" : ""}>
                <td>
                  {r.firstName} {r.lastName} <span className="font-mono text-xs text-slate-500">{r.employeeNumber}</span>
                </td>
                <td className="text-slate-600">{r.department ?? "—"}</td>
                <td className="text-right">{money(r.budget, cur)}</td>
                <td>{r.itemName ?? <span className="text-slate-400">—</span>}</td>
                <td className="text-right">{money(r.cost, cur)}</td>
                <td className={`text-right ${r.remaining !== null && r.remaining < 0 ? "font-semibold text-red-700" : ""}`}>{money(r.remaining, cur)}</td>
                <td className="text-xs text-slate-600">{r.status ? SELECTION_STATUS_LABEL[r.status] ?? r.status : "Not picked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
