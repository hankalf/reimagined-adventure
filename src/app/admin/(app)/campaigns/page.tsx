import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { duplicateCampaignAction } from "./actions";

export default async function CampaignsPage() {
  const campaigns = await db.campaign.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { _count: { select: { selections: true, items: true, employees: true } } },
  });
  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="A campaign is one gift program (e.g. Holiday 2026) with its own gifts, employees, QR code and branding. Duplicate last year's to start the next one in one click."
        actions={
          <Link href="/admin/campaigns/new" className="btn-primary">
            + New campaign
          </Link>
        }
      />
      {campaigns.length === 0 ? (
        <EmptyState
          title="No campaigns yet"
          body="Create a campaign, add gifts from the catalog, upload the employee list, then print the QR poster."
          action={
            <Link href="/admin/campaigns/new" className="btn-primary">
              + New campaign
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Gifts</th>
                <th>Selections</th>
                <th>Closes</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">/g/{c.slug}</div>
                  </td>
                  <td>
                    <StatusBadge status={c.status} label={c.status} />
                  </td>
                  <td>{c._count.items}</td>
                  <td>{c._count.selections}</td>
                  <td>{fmtDate(c.closesAt)}</td>
                  <td>{fmtDate(c.createdAt)}</td>
                  <td>
                    <form action={duplicateCampaignAction} className="flex justify-end">
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-ghost btn-sm" title="Copy gifts, employees, branding and text into a new draft">
                        ⧉ Duplicate
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
