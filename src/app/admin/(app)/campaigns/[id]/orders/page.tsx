import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { money } from "@/lib/utils";
import { bulkItemStatusAction } from "../../actions";
import { OrdersTable, type OrderRow } from "./orders-table";

export default async function OrdersPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/orders">) {
  const { id } = await params;
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [campaign, data] = await Promise.all([db.campaign.findUniqueOrThrow({ where: { id } }), buildReportData(id)]);

  let rows = data.detail;
  if (status) rows = rows.filter((r) => r.status === status);
  if (q) rows = rows.filter((r) => `${r.employeeNumber} ${r.firstName} ${r.lastName} ${r.department ?? ""} ${r.itemName} ${r.confirmationCode}`.toLowerCase().includes(q));
  const serial: OrderRow[] = rows.map((r) => ({
    id: r.selectionId,
    employeeNumber: r.employeeNumber,
    name: `${r.firstName} ${r.lastName}`.trim(),
    department: r.department,
    itemName: r.itemName,
    itemType: r.itemType,
    optionValue: r.optionValue,
    cost: r.cost,
    status: r.status,
    code: r.confirmationCode,
    selectedAt: r.selectedAt.toISOString(),
    productUrl: r.productUrl,
    overBudget: r.overBudget,
  }));
  const returnTo = `/admin/campaigns/${id}/orders${status || q ? `?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) })}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="To order" value={data.counts.toOrder} tone={data.counts.toOrder > 0 ? "warn" : "default"} />
        <Stat label="Ordered" value={data.counts.ordered} />
        <Stat label="Received" value={data.counts.received} />
        <Stat label="Collected" value={data.counts.collected} tone="good" />
        <Stat label="Need re-pick" value={data.counts.needsRepick} tone={data.counts.needsRepick > 0 ? "warn" : "default"} />
      </div>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <h2 className="font-semibold">Main order list (grouped by gift)</h2>
            <p className="text-xs text-slate-500">Quantities HR needs to buy, with the Amazon link. “Mark all ordered” moves every not-yet-ordered pick for that line to Ordered.</p>
          </div>
          <div className="flex gap-2">
            <a href={`/api/export/${id}?type=xlsx`} className="btn-primary btn-sm">
              ⬇ Excel workbook
            </a>
            <a href={`/api/export/${id}?type=summary`} className="btn-secondary btn-sm">
              ⬇ Summary CSV
            </a>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Gift</th>
              <th>Option</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit cost</th>
              <th className="text-right">Subtotal</th>
              <th>Progress</th>
              <th>Link</th>
              <th className="text-right">Bulk</th>
            </tr>
          </thead>
          <tbody>
            {data.summary.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No selections yet.
                </td>
              </tr>
            )}
            {data.summary.map((r) => (
              <tr key={`${r.itemId}-${r.optionValue}`} className={r.type === "CUSTOM" ? "bg-emerald-50/40" : ""}>
                <td>
                  <div className="font-medium">{r.name}</div>
                  {r.type === "CUSTOM" && <div className="text-xs text-emerald-800">Custom gift{r.fulfillmentNote ? ` · ${r.fulfillmentNote}` : ""}</div>}
                  {r.asin && <div className="text-xs text-slate-500">ASIN {r.asin}</div>}
                </td>
                <td>{r.optionValue ?? "—"}</td>
                <td className="text-right font-semibold">{r.quantity}</td>
                <td className="text-right">{money(r.unitCost, campaign.currency)}</td>
                <td className="text-right">{money(r.subtotal, campaign.currency)}</td>
                <td className="text-xs text-slate-600">
                  <span className="text-blue-800">{r.byStatus.SELECTED ?? 0} to order</span> · <span className="text-violet-800">{r.byStatus.ORDERED ?? 0} ordered</span> ·{" "}
                  <span className="text-teal-800">{r.byStatus.RECEIVED ?? 0} received</span> · <span className="text-emerald-800">{r.byStatus.COLLECTED ?? 0} collected</span>
                </td>
                <td>
                  {r.productUrl ? (
                    <a href={r.productUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      Open ↗
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    {(r.byStatus.SELECTED ?? 0) > 0 && (
                      <form action={bulkItemStatusAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="optionValue" value={r.optionValue ?? ""} />
                        <input type="hidden" name="fromStatus" value="SELECTED" />
                        <input type="hidden" name="toStatus" value="ORDERED" />
                        <button className="btn-primary btn-sm">Mark {r.byStatus.SELECTED} ordered</button>
                      </form>
                    )}
                    {(r.byStatus.ORDERED ?? 0) > 0 && (
                      <form action={bulkItemStatusAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="optionValue" value={r.optionValue ?? ""} />
                        <input type="hidden" name="fromStatus" value="ORDERED" />
                        <input type="hidden" name="toStatus" value="RECEIVED" />
                        <button className="btn-secondary btn-sm">Mark {r.byStatus.ORDERED} received</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data.summary.length > 0 && (
              <tr className="font-semibold">
                <td colSpan={2}>Total</td>
                <td className="text-right">{data.summary.reduce((a, r) => a + r.quantity, 0)}</td>
                <td />
                <td className="text-right">{money(data.budget.committed, campaign.currency)}</td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <input name="q" defaultValue={q} placeholder="Search employee #, name, gift or code (pickup day: type the number)" className="input sm:max-w-md" />
          <select name="status" defaultValue={status} className="input sm:max-w-[180px]">
            <option value="">All statuses</option>
            <option value="SELECTED">To order</option>
            <option value="ORDERED">Ordered</option>
            <option value="RECEIVED">Received</option>
            <option value="COLLECTED">Collected</option>
            <option value="NEEDS_REPICK">Needs re-pick</option>
          </select>
          <button className="btn-secondary">Filter</button>
          <a href={`/admin/campaigns/${id}/kiosk`} target="_blank" rel="noreferrer" className="btn-primary btn-sm ml-auto">
            📷 Open pickup kiosk
          </a>
          <a href={`/api/export/${id}?type=detail`} className="btn-ghost btn-sm">
            ⬇ Detail CSV
          </a>
        </form>
        <OrdersTable campaignId={id} rows={serial} currency={campaign.currency} returnTo={returnTo} />
      </section>
    </div>
  );
}
