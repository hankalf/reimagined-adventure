import Link from "next/link";
import { Alert, StatusBadge } from "@/components/ui";
import { offeredValues, optionGroups } from "@/lib/options";
import { OptionsSaveButton } from "./options-save-button";
import { ItemThumb } from "@/components/item-thumb";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/image-src";
import { COMMITTED_STATUSES } from "@/lib/budget";
import { dec, money } from "@/lib/utils";
import { addCampaignItemsAction, moveCampaignItemAction, removeCampaignItemAction, toggleStockAction, updateCampaignItemAction } from "../../actions";
import { OutOfStockButton } from "./stock-button";

export default async function CampaignItemsPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/items">) {
  const { id } = await params;
  const sp = await searchParams;
  const [campaign, rows, catalog, taken, pending] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id } }),
    db.campaignItem.findMany({ where: { campaignId: id }, include: { item: true }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] }),
    db.item.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db.selection.groupBy({ by: ["itemId", "status"], where: { campaignId: id }, _count: { _all: true } }),
    db.selection.findMany({ where: { campaignId: id, status: "SELECTED" }, select: { itemId: true, option1Value: true, option2Value: true } }),
  ]);
  // How many not-yet-ordered picks hold each option value, keyed "enabled1:<value>" / "enabled2:<value>" per item.
  const chosenByItem = new Map<string, Record<string, number>>();
  for (const p of pending) {
    const rec = chosenByItem.get(p.itemId) ?? {};
    if (p.option1Value) rec[`enabled1:${p.option1Value}`] = (rec[`enabled1:${p.option1Value}`] ?? 0) + 1;
    if (p.option2Value) rec[`enabled2:${p.option2Value}`] = (rec[`enabled2:${p.option2Value}`] ?? 0) + 1;
    chosenByItem.set(p.itemId, rec);
  }
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
      {typeof sp.saved === "string" && <Alert kind="success">{sp.saved}</Alert>}
      {typeof sp.error === "string" && <Alert kind="error">{sp.error}</Alert>}
      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="font-semibold">Gifts shown to employees ({rows.length})</h2>
            <p className="text-xs text-slate-500">
              Order here is the order employees see. Set a stock limit to cap how many can choose an item; mark it out of stock to pull it immediately. Untick a colour or size to stop offering
              it in this campaign.
            </p>
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
              <th>Limit · cost · offered options</th>
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
                      <div className="w-14 shrink-0">
                        <ItemThumb src={src} framing={r.item} className="rounded-lg border border-slate-200" />
                      </div>
                      <div>
                        <Link href={`/admin/items/${r.itemId}`} className="font-medium text-slate-900 hover:underline">
                          {r.item.name}
                        </Link>
                        <div className="text-xs text-slate-500">{r.item.type === "CUSTOM" ? "Custom gift" : money(dec(r.item.unitCost), campaign.currency)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-semibold">{committed}</span>
                    {remaining !== null && <span className="text-xs text-slate-500"> · {remaining} left</span>}
                  </td>
                  <td>
                    <form action={updateCampaignItemAction} className="space-y-2">
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="itemId" value={r.itemId} />
                      <input type="hidden" name="hasOptions" value={optionGroups(r.item).length > 0 ? "1" : "0"} />
                      <div className="flex items-center gap-2">
                        <input name="stockLimit" defaultValue={r.stockLimit ?? ""} placeholder="∞" className="input w-20" inputMode="numeric" aria-label="Stock limit" title="Stock limit" />
                        <input name="unitCostOverride" defaultValue={dec(r.unitCostOverride) ?? ""} placeholder={dec(r.item.unitCost)?.toString() ?? "cost"} className="input w-24" inputMode="decimal" aria-label="Cost override" title="Cost override" />
                        <OptionsSaveButton chosenCounts={chosenByItem.get(r.itemId) ?? {}} />
                      </div>
                      {optionGroups(r.item).map((g) => {
                        const offered = new Set(offeredValues(g.values, g.index === 1 ? r.enabledOption1Values : r.enabledOption2Values));
                        const counts = chosenByItem.get(r.itemId) ?? {};
                        return (
                          <fieldset key={g.index} className="text-xs">
                            <legend className="font-medium text-slate-600">{g.label}</legend>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                              {g.values.map((v) => {
                                const on = offered.has(v);
                                const chosen = counts[`enabled${g.index}:${v}`] ?? 0;
                                return (
                                  <label key={v} className={`flex items-center gap-1 ${on ? "text-slate-800" : "text-slate-400 line-through"}`}>
                                    <input type="checkbox" name={`enabled${g.index}`} value={v} defaultChecked={on} data-initial={on ? "1" : "0"} className="h-3.5 w-3.5" />
                                    {v}
                                    {chosen > 0 && <span className="text-slate-400 no-underline">({chosen})</span>}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        );
                      })}
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
        <p className="text-xs text-slate-500">Tick the gifts to add. For gifts with colours or sizes, untick any values you don&apos;t want to offer in this campaign.</p>
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
                  <li key={item.id} className="rounded-lg border border-slate-200 hover:bg-slate-50">
                    <label className="flex cursor-pointer items-center gap-3 p-2">
                      <input type="checkbox" name="itemIds" value={item.id} className="h-4 w-4" />
                      <div className="w-12 shrink-0">
                        <ItemThumb src={src} framing={item} className="rounded border border-slate-200" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          {item.category ?? "Uncategorised"} · {item.type === "CUSTOM" ? "Custom" : money(dec(item.unitCost), campaign.currency)}
                        </div>
                      </div>
                    </label>
                    {optionGroups(item).length > 0 && (
                      <div className="space-y-1 border-t border-slate-100 px-2 pb-2 pt-1 text-xs">
                        {optionGroups(item).map((g) => (
                          <div key={g.index} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium text-slate-600">{g.label}:</span>
                            {g.values.map((v) => (
                              <label key={v} className="flex items-center gap-1 text-slate-700">
                                <input type="checkbox" name={`enabled${g.index}:${item.id}`} value={v} defaultChecked className="h-3.5 w-3.5" />
                                {v}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
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
