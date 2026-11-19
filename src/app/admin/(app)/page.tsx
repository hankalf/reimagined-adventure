import Link from "next/link";
import { Alert, StatusBadge } from "@/components/ui";
import { PageHeader, Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { fmtDate, money } from "@/lib/utils";

export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const campaigns = await db.campaign.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  const reports = await Promise.all(campaigns.map((c) => buildReportData(c.id)));
  const [itemCount, employeeCount] = await Promise.all([db.item.count({ where: { active: true } }), db.employee.count({ where: { active: true } })]);

  const openReports = reports.filter((r) => r.campaign.status === "OPEN");
  const toOrder = reports.reduce((a, r) => a + r.counts.toOrder, 0);
  const needsRepick = reports.reduce((a, r) => a + r.counts.needsRepick, 0);

  const popularity = new Map<string, { name: string; qty: number }>();
  for (const r of openReports) for (const s of r.summary) {
    const row = popularity.get(s.itemId) ?? { name: s.name, qty: 0 };
    row.qty += s.quantity;
    popularity.set(s.itemId, row);
  }
  const top = [...popularity.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="What's happening across your gift programs."
        actions={
          <Link href="/admin/campaigns/new" className="btn-primary">
            + New campaign
          </Link>
        }
      />
      {sp.forbidden === "1" && (
        <Alert kind="warning" className="mb-4">
          That page is only available to users with the ADMIN role.
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Open campaigns" value={openReports.length} hint={`${campaigns.length} total`} />
        <Stat label="Waiting to be ordered" value={toOrder} tone={toOrder > 0 ? "warn" : "default"} hint="Selections with status Selected" />
        <Stat label="Need a re-pick" value={needsRepick} tone={needsRepick > 0 ? "warn" : "good"} hint="Chosen gift went out of stock" />
        <Stat label="Catalog" value={itemCount} hint={`${employeeCount} active employees`} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">Campaigns</h2>
      {reports.length === 0 ? (
        <div className="card p-8 text-center text-slate-600">
          No campaigns yet.{" "}
          <Link href="/admin/campaigns/new" className="text-blue-700 hover:underline">
            Create your first campaign
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.map((r) => {
            const pct = r.counts.eligible > 0 ? Math.round((r.counts.picked / r.counts.eligible) * 100) : 0;
            const budgetPct = r.budget.totalBudget ? Math.min(100, Math.round((r.budget.committed / r.budget.totalBudget) * 100)) : null;
            return (
              <Link key={r.campaign.id} href={`/admin/campaigns/${r.campaign.id}`} className="card block p-5 transition hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{r.campaign.name}</h3>
                    <p className="text-xs text-slate-500">/g/{r.campaign.slug}</p>
                  </div>
                  <StatusBadge status={r.campaign.status} label={r.campaign.status} />
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      {r.counts.picked} of {r.counts.eligible} picked
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {budgetPct !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>
                        Budget {money(r.budget.committed, r.campaign.currency)} of {money(r.budget.totalBudget, r.campaign.currency)}
                      </span>
                      <span>{budgetPct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${budgetPct >= 100 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${budgetPct}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded bg-blue-50 py-1 text-blue-800">{r.counts.toOrder} to order</div>
                  <div className="rounded bg-violet-50 py-1 text-violet-800">{r.counts.ordered} ordered</div>
                  <div className="rounded bg-teal-50 py-1 text-teal-800">{r.counts.received} received</div>
                  <div className="rounded bg-emerald-50 py-1 text-emerald-800">{r.counts.collected} collected</div>
                </div>
                {r.campaign.lastHrEmailAt && <p className="mt-3 text-xs text-slate-500">Last HR email: {fmtDate(r.campaign.lastHrEmailAt, true)}</p>}
              </Link>
            );
          })}
        </div>
      )}

      {top.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-900">Most popular gifts (open campaigns)</h2>
          <div className="card divide-y divide-slate-100">
            {top.map((t, i) => (
              <div key={t.name} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  <span className="mr-2 text-slate-400">{i + 1}.</span>
                  {t.name}
                </span>
                <span className="font-semibold">{t.qty}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
