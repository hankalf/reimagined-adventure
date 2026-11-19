import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { money } from "@/lib/utils";
import { offeredGroups } from "@/lib/options";
import { ImportForm } from "@/app/admin/(app)/employees/import-form";
import { removeEligibleEmployeeAction, setEligibilityModeAction, updateBudgetOverrideAction } from "../../actions";
import { AddEligibleForm, PickOnBehalfForm } from "./forms";

export default async function CampaignEmployeesPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/employees">) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [campaign, data, items, eligibleRows] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id } }),
    buildReportData(id),
    db.campaignItem.findMany({ where: { campaignId: id }, include: { item: true }, orderBy: { sortOrder: "asc" } }),
    db.campaignEmployee.findMany({ where: { campaignId: id }, select: { employeeId: true } }),
  ]);
  const detailByNumber = new Map(data.detail.map((d) => [d.employeeNumber, d]));
  const employeesByNumber = new Map((await db.employee.findMany({ where: { active: true }, select: { id: true, employeeNumber: true } })).map((e) => [e.employeeNumber, e.id]));
  const explicitlyEligible = new Set(eligibleRows.map((r) => r.employeeId));

  let rows = data.employeeBudgets.map((r) => ({ ...r, detail: detailByNumber.get(r.employeeNumber) ?? null, employeeId: employeesByNumber.get(r.employeeNumber) ?? "" }));
  if (filter === "picked") rows = rows.filter((r) => r.detail && r.detail.status !== "NEEDS_REPICK");
  if (filter === "notpicked") rows = rows.filter((r) => !r.detail || r.detail.status === "NEEDS_REPICK");
  if (filter === "repick") rows = rows.filter((r) => r.detail?.status === "NEEDS_REPICK");
  if (q) rows = rows.filter((r) => `${r.employeeNumber} ${r.firstName} ${r.lastName} ${r.department ?? ""}`.toLowerCase().includes(q));

  const base = `/admin/campaigns/${id}/employees`;
  const pickItems = items.map((ci) => ({ id: ci.itemId, name: ci.item.name, groups: offeredGroups(ci.item, ci), outOfStock: ci.status === "OUT_OF_STOCK" }));
  const pickEmployees = data.employeeBudgets.map((r) => ({ id: employeesByNumber.get(r.employeeNumber) ?? "", label: `${r.employeeNumber} — ${r.firstName} ${r.lastName}` })).filter((e) => e.id);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Eligible" value={data.counts.eligible} hint={campaign.allEmployeesEligible ? "All active employees" : "Uploaded list for this campaign"} />
        <Stat label="Picked" value={data.counts.picked} tone="good" />
        <Stat label="Not picked yet" value={data.counts.notPicked} />
        <Stat label="Need a re-pick" value={data.counts.needsRepick} tone={data.counts.needsRepick > 0 ? "warn" : "default"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Who is eligible</h2>
          <form action={setEligibilityModeAction} className="mt-3 space-y-2 text-sm">
            <input type="hidden" name="id" value={id} />
            <label className="flex items-start gap-2">
              <input type="radio" name="allEmployeesEligible" value="1" defaultChecked={campaign.allEmployeesEligible} className="mt-1" />
              <span>
                <strong>All active employees</strong> on the master list can pick.
                <span className="block text-xs text-slate-500">You can still upload a CSV with budgets for specific people.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="allEmployeesEligible" value="0" defaultChecked={!campaign.allEmployeesEligible} className="mt-1" />
              <span>
                <strong>Only the list uploaded for this campaign</strong> ({explicitlyEligible.size} people).
                <span className="block text-xs text-slate-500">Use this for service awards or a department-only program.</span>
              </span>
            </label>
            <button className="btn-secondary btn-sm">Save</button>
          </form>
          <h3 className="mt-5 text-sm font-semibold">Upload a list for this campaign</h3>
          <div className="mt-2">
            <ImportForm campaignId={id} campaignAllEligible={campaign.allEmployeesEligible} />
          </div>
          <h3 className="mt-5 text-sm font-semibold">Add one person</h3>
          <AddEligibleForm campaignId={id} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Pick on behalf of an employee</h2>
          <p className="mt-1 text-xs text-slate-500">For walk-ups or people without a phone. Bypasses the budget check and the open/closed window.</p>
          <PickOnBehalfForm campaignId={id} employees={pickEmployees} items={pickItems} />
          <h2 className="mt-6 font-semibold">Exports</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`/api/export/${id}?type=notpicked`} className="btn-secondary btn-sm">
              ⬇ Not picked yet (CSV)
            </a>
            <a href={`/api/export/${id}?type=detail`} className="btn-secondary btn-sm">
              ⬇ All selections (CSV)
            </a>
            <a href={`/api/export/${id}?type=xlsx`} className="btn-secondary btn-sm">
              ⬇ Excel workbook
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">Use the “not picked” list to send reminders through your usual channels.</p>
        </section>
      </div>

      <section className="card overflow-x-auto">
        <form className="flex flex-wrap items-center gap-2 p-4">
          <input name="q" defaultValue={q} placeholder="Search number, name, department" className="input sm:max-w-xs" />
          <select name="filter" defaultValue={filter} className="input sm:max-w-[200px]">
            <option value="all">Everyone eligible</option>
            <option value="picked">Picked</option>
            <option value="notpicked">Not picked yet</option>
            <option value="repick">Needs a re-pick</option>
          </select>
          <button className="btn-secondary">Filter</button>
          <span className="ml-auto text-sm text-slate-500">{rows.length} shown</span>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>Employee #</th>
              <th>Name</th>
              <th>Department</th>
              <th>Budget</th>
              <th>Gift</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  Nobody matches this filter.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.employeeNumber}>
                <td className="font-mono">{r.employeeNumber}</td>
                <td>
                  {r.firstName} {r.lastName}
                </td>
                <td className="text-slate-600">{r.department ?? "—"}</td>
                <td>
                  <form action={updateBudgetOverrideAction} className="flex items-center gap-1">
                    <input type="hidden" name="campaignId" value={id} />
                    <input type="hidden" name="employeeId" value={r.employeeId} />
                    <input name="budget" defaultValue={r.budget ?? ""} placeholder={data.campaign.defaultEmployeeBudget?.toString() ?? "—"} className="input w-20" inputMode="decimal" aria-label="Budget" />
                    <button className="btn-ghost btn-sm">Save</button>
                  </form>
                </td>
                <td>
                  {r.detail ? (
                    <>
                      {r.detail.itemName}
                      {r.detail.optionText && <span className="text-slate-500"> · {r.detail.optionText}</span>}
                      <div className="text-xs text-slate-500">
                        {money(r.detail.cost, campaign.currency)} · code {r.detail.confirmationCode}
                      </div>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td>{r.detail ? <StatusBadge status={r.detail.status} /> : <span className="badge bg-slate-100 text-slate-600">Not picked</span>}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    {r.detail && (
                      <Link href={`/admin/campaigns/${id}/orders?q=${encodeURIComponent(r.employeeNumber)}`} className="btn-ghost btn-sm">
                        Order
                      </Link>
                    )}
                    {!campaign.allEmployeesEligible && r.employeeId && (
                      <form action={removeEligibleEmployeeAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="employeeId" value={r.employeeId} />
                        <button className="btn-ghost btn-sm text-red-700">Remove</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-slate-500">
        Manage the master employee list on the{" "}
        <Link href="/admin/employees" className="text-blue-700 hover:underline">
          Employees page
        </Link>
        . Reset or change a selection from the <Link href={`${base.replace("/employees", "/orders")}`} className="text-blue-700 hover:underline">Orders tab</Link>.
      </p>
    </div>
  );
}
