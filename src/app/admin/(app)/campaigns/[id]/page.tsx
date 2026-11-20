import Link from "next/link";
import { Stat } from "@/components/admin/page-header";
import { Alert } from "@/components/ui";
import { launchStatus } from "@/lib/launch";
import { eligibleEmployees } from "@/lib/report";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { appUrl, money } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/time-zone";

export default async function CampaignOverviewPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const [campaign, data, launch] = await Promise.all([db.campaign.findUniqueOrThrow({ where: { id } }), buildReportData(id), launchStatus(id)]);
  const previewEmployees = (await eligibleEmployees(campaign)).slice(0, 200).map((e) => ({ id: e.employee.id, label: `${e.employee.employeeNumber} — ${e.employee.firstName} ${e.employee.lastName}` }));
  const base = `/admin/campaigns/${id}`;
  const url = `${appUrl()}/g/${campaign.slug}`;
  const pct = data.counts.eligible > 0 ? Math.round((data.counts.picked / data.counts.eligible) * 100) : 0;
  return (
    <div className="space-y-6">
      {typeof sp.error === "string" && <Alert kind="error">{sp.error}</Alert>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Picked" value={`${data.counts.picked} / ${data.counts.eligible}`} hint={`${pct}% of eligible employees`} />
        <Stat label="Waiting to order" value={data.counts.toOrder} tone={data.counts.toOrder > 0 ? "warn" : "default"} />
        <Stat label="Need a re-pick" value={data.counts.needsRepick} tone={data.counts.needsRepick > 0 ? "warn" : "good"} hint="Gift went out of stock" />
        <Stat
          label="Committed spend"
          value={money(data.budget.committed, campaign.currency)}
          hint={data.budget.totalBudget !== null ? `of ${money(data.budget.totalBudget, campaign.currency)} budget` : "no total budget set"}
          tone={data.budget.remaining !== null && data.budget.remaining < 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Launch checklist</h2>
            <span className={`badge ${launch.canOpen ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{launch.canOpen ? "Ready to open" : `${launch.blockers.length} blocker(s)`}</span>
          </div>
          <ul className="space-y-2">
            {launch.checks.map((c) => (
              <li key={c.key} className="flex items-start gap-3 text-sm">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${c.ok ? "bg-emerald-100 text-emerald-700" : c.blocking ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{c.ok ? "✓" : c.blocking ? "!" : "•"}</span>
                <div>
                  <Link href={c.href} className={c.ok ? "text-slate-500 line-through" : "text-slate-800 hover:underline"}>
                    {c.label}
                  </Link>
                  {!c.ok && c.blocking && <span className="ml-2 text-xs text-red-700">required</span>}
                  {c.detail && <div className="text-xs text-slate-500">{c.detail}</div>}
                </div>
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${campaign.status === "OPEN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{campaign.status === "OPEN" ? "✓" : "•"}</span>
              <Link href={`${base}/poster`} className={campaign.status === "OPEN" ? "text-slate-500 line-through" : "text-slate-800 hover:underline"}>
                Open the campaign and print the QR poster
              </Link>
            </li>
          </ul>
          <form method="get" action={`${base}/preview`} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3">
            <div className="min-w-[220px] flex-1">
              <label htmlFor="preview-employee" className="label">
                Preview as employee (nothing is saved)
              </label>
              <select id="preview-employee" name="employeeId" className="input">
                {previewEmployees.length === 0 && <option value="">Add employees first</option>}
                {previewEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-secondary" formTarget="_blank" disabled={previewEmployees.length === 0}>
              👀 Open preview
            </button>
          </form>
          <h2 className="mb-3 mt-6 font-semibold">Top gifts</h2>
          {data.summary.length === 0 ? (
            <p className="text-sm text-slate-500">No selections yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.summary.slice(0, 6).map((r) => (
                <li key={`${r.itemId}-${r.option1Value}-${r.option2Value}`} className="flex justify-between py-1.5">
                  <span>
                    {r.name}
                    {r.optionText && <span className="text-slate-500"> · {r.optionText}</span>}
                  </span>
                  <span className="font-semibold">{r.quantity}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5 text-center">
          <h2 className="mb-3 font-semibold">QR code</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/campaigns/${campaign.slug}/qr?size=320`} alt="QR code" className="mx-auto h-44 w-44 rounded-lg border border-slate-200" />
          <p className="mt-2 break-all font-mono text-xs text-slate-600">{url}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href={`${base}/poster`} target="_blank" className="btn-primary btn-sm">
              Print poster
            </Link>
            <a href={`/api/campaigns/${campaign.slug}/qr?size=1024&download=1`} className="btn-secondary btn-sm">
              PNG
            </a>
            <a href={`/api/campaigns/${campaign.slug}/qr?format=svg&download=1`} className="btn-secondary btn-sm">
              SVG
            </a>
          </div>
          <dl className="mt-5 space-y-1 text-left text-xs text-slate-600">
            <div className="flex justify-between">
              <dt>Closes</dt>
              <dd>{campaign.closesAt ? `${formatCalendarDate(campaign.closesAt, "en-US", "medium")}, 11:59 PM ET` : "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Gifts shown</dt>
              <dd>{await db.campaignItem.count({ where: { campaignId: id } })}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
