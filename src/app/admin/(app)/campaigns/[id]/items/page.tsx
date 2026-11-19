import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/image-src";
import { COMMITTED_STATUSES } from "@/lib/budget";
import { dec, money } from "@/lib/utils";
import { addCampaignItemsAction, moveCampaignItemAction, removeCampaignItemAction, toggleStockAction, updateCampaignItemAction } from "../../actions";
import { OutOfStockButton } from "./stock-button";

export default async function CampaignItemsPage({ params }: PageProps<"/admin/campaigns/[id]/items">) {
  const { id } = await params;
  const [campaign, rows, catalog, taken] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id } }),
    db.campaignItem.findMany({ where: { campaignId: id }, include: { item: true }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] }),
    db.item.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.selection.groupBy({ by: ["itemId", "status"], where: { campaignId: id }, _count: { _all: true } }),
  ]);
  const inCampaign = new Set(rows.map((r) => r.itemId));
  const available = catalog.filter((i) => !inCampaign.has(i.id));
  const committedBy = new Map<string, number>();
  const selectedBy = new Map<string, number>();
  for (const t of taken) {
    if (COMMITTED_STATUSES.includes(t.status)) committedBy.set(t.itemId, (committedBy.get(t.itemId) ?? 0) + t._count._all);
    if (t.status === "SELECTED") selectedBy.set(t.itemId, (selectedBy.get(t.itemId) ?? 0) + t._count._all);
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="font-semibold">Gifts shown to employees ({rows.length})</h2>
            <p className="text-xs text-slate-500">Order here is the order employees see. Set a stock limit to cap how many can choose an item; mark it out of stock to pull it immediately.</p>
          </div>
          <Link href="/admin/items/new" className="btn-secondary btn-sm">
            + New catalog gift
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Gift</th>
              <th>Chosen</th>
              <th>Stock limit</th>
              <th>Cost override</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No gifts yet. Add some from the catalog below.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const src = imageSrc(r.item, true);
              const committed = committedBy.get(r.itemId) ?? 0;
              const remaining = r.stockLimit !== null ? Math.max(0, r.stockLimit - committed) : null;
              return (
                <tr key={r.itemId} className={r.status === "OUT_OF_STOCK" ? "bg-red-50/40" : ""}>
                  <td>
                    <div className="flex flex-col">
                      <form action={moveCampaignItemAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="direction" value="up" />
                        <button className="btn-ghost btn-sm" disabled={i === 0} aria-label="Move up">
                          ▲
                        </button>
                      </form>
                      <form action={moveCampaignItemAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="direction" value="down" />
                        <button className="btn-ghost btn-sm" disabled={i === rows.length - 1} aria-label="Move down">
                          ▼
                        </button>
                      </form>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">🎁</div>
                        )}
                      </div>
                      <div>
                        <Link href={`/admin/items/${r.itemId}`} className="font-medium text-slate-900 hover:underline">
                          {r.item.name}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {r.item.type === "CUSTOM" ? "Custom gift" : money(dec(r.item.unitCost), campaign.currency)}
                          {r.item.optionValues.length > 0 && ` · ${r.item.optionLabel}: ${r.item.optionValues.join(", ")}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold">{committed}</span>
                    {remaining !== null && <span className="text-xs text-slate-500"> · {remaining} left</span>}
                  </td>
                  <td colSpan={2}>
                    <form action={updateCampaignItemAction} className="flex items-center gap-2">
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="itemId" value={r.itemId} />
                      <input name="stockLimit" defaultValue={r.stockLimit ?? ""} placeholder="∞" className="input w-20" inputMode="numeric" aria-label="Stock limit" />
                      <input name="unitCostOverride" defaultValue={dec(r.unitCostOverride) ?? ""} placeholder={dec(r.item.unitCost)?.toString() ?? "cost"} className="input w-24" inputMode="decimal" aria-label="Cost override" />
                      <button className="btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td>
                    <StatusBadge status={r.status} label={r.status === "OUT_OF_STOCK" ? "Out of stock" : remaining === 0 ? "Limit reached" : "Available"} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <form action={toggleStockAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="outOfStock" value={r.status === "OUT_OF_STOCK" ? "0" : "1"} />
                        <OutOfStockButton outOfStock={r.status === "OUT_OF_STOCK"} affected={selectedBy.get(r.itemId) ?? 0} />
                      </form>
                      <form action={removeCampaignItemAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <button className="btn-ghost btn-sm text-red-700">Remove</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Add from the catalog</h2>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Every active catalog gift is already in this campaign.{" "}
            <Link href="/admin/items/new" className="text-blue-700 hover:underline">
              Create a new gift
            </Link>
            .
          </p>
        ) : (
          <form action={addCampaignItemsAction} className="mt-3">
            <input type="hidden" name="campaignId" value={id} />
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {available.map((item) => {
                const src = imageSrc(item, true);
                return (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
                      <input type="checkbox" name="itemIds" value={item.id} className="h-4 w-4" />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">🎁</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          {item.category ?? "Uncategorised"} · {item.type === "CUSTOM" ? "Custom" : money(dec(item.unitCost), campaign.currency)}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            <button className="btn-primary mt-3">Add selected gifts</button>
          </form>
        )}
      </section>
    </div>
  );
}
