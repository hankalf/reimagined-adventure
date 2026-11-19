import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { setCampaignStatusAction } from "../actions";
import { CampaignTabs } from "./tabs";
import { launchStatus } from "@/lib/launch";

export default async function CampaignLayout({ children, params }: LayoutProps<"/admin/campaigns/[id]">) {
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const [toOrder, needsRepick, launch] = await Promise.all([
    db.selection.count({ where: { campaignId: id, status: "SELECTED" } }),
    db.selection.count({ where: { campaignId: id, status: "NEEDS_REPICK" } }),
    campaign.status === "OPEN" ? Promise.resolve(null) : launchStatus(id),
  ]);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} label={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Employee link:{" "}
            <a href={`/g/${campaign.slug}`} target="_blank" rel="noreferrer" className="font-mono text-blue-700 hover:underline">
              /g/{campaign.slug}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/campaigns/${id}/poster`} className="btn-secondary" target="_blank">
            🖨️ QR poster
          </Link>
          <Link href={`/admin/campaigns/${id}/kiosk`} className="btn-secondary" target="_blank">
            📷 Pickup kiosk
          </Link>
          <a href={`/admin/campaigns/${id}/preview`} target="_blank" rel="noreferrer" className="btn-secondary">
            👀 Preview as employee
          </a>
          {campaign.status !== "OPEN" ? (
            launch && !launch.canOpen ? (
              <Link href={`/admin/campaigns/${id}`} className="btn-primary opacity-60" title={`Not ready: ${launch.blockers.map((b) => b.label).join("; ")}`}>
                Open campaign (see checklist)
              </Link>
            ) : (
              <form action={setCampaignStatusAction}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="status" value="OPEN" />
                <button className="btn-primary">Open campaign</button>
              </form>
            )
          ) : (
            <form action={setCampaignStatusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="CLOSED" />
              <button className="btn-secondary">Close campaign</button>
            </form>
          )}
        </div>
      </div>
      <CampaignTabs id={id} badges={{ orders: toOrder, employees: needsRepick }} />
      <div className="pt-6">{children}</div>
    </div>
  );
}
