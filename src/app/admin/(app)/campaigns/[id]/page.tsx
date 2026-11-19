import Link from "next/link";
import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { appUrl, fmtDate, money } from "@/lib/utils";

export default async function CampaignOverviewPage({ params }: PageProps<"/admin/campaigns/[id]">) {
  const { id } = await params;
  const [campaign, data] = await Promise.all([db.campaign.findUniqueOrThrow({ where: { id } }), buildReportData(id)]);
  const base = `/admin/campaigns/${id}`;
  const url = `${appUrl()}/g/${campaign.slug}`;
  const pct = data.counts.eligible > 0 ? Math.round((data.counts.picked / data.counts.eligible) * 100) : 0;
  const checklist = [
    { done: data.summary.length > 0 || (await db.campaignItem.count({ where: { campaignId: id } })) > 0, label: "Add gifts to show", href: `${base}/items` },
    { done: data.counts.eligible > 0, label: "Upload the employee list", href: `${base}/employees` },
    { done: Boolean(campaign.welcomeMessage || campaign.logoImageId), label: "Add a welcome message and logo", href: `${base}/branding` },
    { done: campaign.status === "OPEN", label: "Open the campaign and print the QR poster", href: `${base}/poster` },
  ];

  return (
    <div className="space-y-6">
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
          <h2 className="mb-3 font-semibold">Setup checklist</h2>
          <ul className="space-y-2">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-3 text-sm">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${c.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{c.done ? "✓" : "•"}</span>
                <Link href={c.href} className={c.done ? "text-slate-500 line-through" : "text-slate-800 hover:underline"}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
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
              <dd>{fmtDate(campaign.closesAt)}</dd>
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
