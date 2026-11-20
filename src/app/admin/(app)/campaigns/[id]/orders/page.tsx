import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { buildReportData } from "@/lib/report";
import { money } from "@/lib/utils";
import { bulkItemStatusAction, markCartOrderedAction, orderRowAction } from "../../actions";
import { Alert, ConfirmButton } from "@/components/ui";
import { planAmazonCart } from "@/lib/amazon-cart";
import { OrdersTable, type OrderRow } from "./orders-table";

export default async function OrdersPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/orders">) {
  const { id } = await params;
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [campaign, data] = await Promise.all([db.campaign.findUniqueOrThrow({ where: { id } }), buildReportData(id)]);
  const saved = typeof sp.saved === "string" ? sp.saved : null;
  // One-click Amazon cart: product lines that still need ordering.
  const toOrderLines = data.summary.filter((r) => r.type === "PRODUCT" && (r.byStatus.SELECTED ?? 0) > 0);
  const cart = planAmazonCart(toOrderLines.map((r) => ({ itemId: r.itemId, name: r.name, asin: r.asin, productUrl: r.productUrl, quantity: r.byStatus.SELECTED ?? 0, optionText: r.optionDetail || r.optionText })));
  // The exact picks in the cart, so a pick made after the cart was opened is not marked ordered by mistake.
  const cartSelectionIds = data.detail.filter((d) => d.status === "SELECTED" && cart.itemIds.includes(d.itemId)).map((d) => d.selectionId);

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
    optionText: r.optionText,
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
      {saved && <Alert kind="success">{saved}</Alert>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat label="To order" value={data.counts.toOrder} tone={data.counts.toOrder > 0 ? "warn" : "default"} />
        <Stat label="Ordered" value={data.counts.ordered} />
        <Stat label="Received" value={data.counts.received} />
        <Stat label="Collected" value={data.counts.collected} tone="good" />
        <Stat label="Need re-pick" value={data.counts.needsRepick} tone={data.counts.needsRepick > 0 ? "warn" : "default"} />
      </div>

      <section className="card p-5" data-amazon-cart>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">🛒 Order on Amazon</h2>
            <p className="max-w-2xl text-xs text-slate-500">
              Opens Amazon with every gift still to order already in your cart, at the right quantities. Sign in to your company Amazon (or Amazon Business) account, review the cart and check
              out, then come back and mark them ordered.
            </p>
          </div>
          {cart.totalUnits > 0 && (
            <form action={markCartOrderedAction}>
              <input type="hidden" name="campaignId" value={id} />
              {cartSelectionIds.map((sid) => (
                <input key={sid} type="hidden" name="selectionIds" value={sid} />
              ))}
              <ConfirmButton message={`Mark the ${cart.totalUnits} unit(s) from the Amazon cart as ordered? Do this after you have checked out on Amazon.`} className="btn-secondary btn-sm" data-cart-mark-ordered>
                ✓ I checked out: mark {cart.totalUnits} ordered
              </ConfirmButton>
            </form>
          )}
        </div>
        {cart.totalUnits === 0 && cart.notOnAmazon.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing is waiting to be ordered right now.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {cart.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {cart.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-primary" data-cart-link>
                    🛒 Open Amazon cart
                    {l.parts > 1 ? ` (part ${l.part} of ${l.parts})` : ""} · {l.lines.length} item{l.lines.length === 1 ? "" : "s"}, {l.units} unit{l.units === 1 ? "" : "s"}
                    {l.host !== "www.amazon.com" ? ` · ${l.host.replace("www.", "")}` : ""}
                  </a>
                ))}
              </div>
            )}
            {cart.links.length > 0 && (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer">What goes in the cart</summary>
                <ul className="mt-1 list-disc pl-5">
                  {cart.links.flatMap((l) => l.lines).map((line) => (
                    <li key={line.asin}>
                      {line.quantity} × {line.name} <span className="font-mono text-slate-400">{line.asin}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {cart.checkVariants.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-cart-variants>
                <strong>Check colour / size in the cart.</strong> Amazon adds the product on file; change the variant in the cart if needed:
                <ul className="mt-1 list-disc pl-5">
                  {cart.checkVariants.map((v) => (
                    <li key={v.asin}>
                      {v.name}: {v.options.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cart.notOnAmazon.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" data-cart-not-amazon>
                <strong>Order these another way</strong> (no Amazon ASIN on file):{" "}
                {cart.notOnAmazon.map((n) => `${n.quantity} × ${n.name}`).join(", ")}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <h2 className="font-semibold">Main order list (grouped by gift)</h2>
            <p className="text-xs text-slate-500">
              Quantities HR needs to buy, with the Amazon link. Type the price you actually paid before clicking “Mark ordered”: it updates the gift&apos;s price everywhere and is kept in the
              gift&apos;s price history.
            </p>
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
              <th>Options</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit cost (editable)</th>
              <th className="text-right">Subtotal</th>
              <th>Progress</th>
              <th>Link</th>
              <th className="text-right">Order</th>
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
              <tr key={`${r.itemId}-${r.option1Value}-${r.option2Value}`} className={r.type === "CUSTOM" ? "bg-emerald-50/40" : ""}>
                <td>
                  <div className="font-medium">{r.name}</div>
                  {r.type === "CUSTOM" && <div className="text-xs text-emerald-800">Custom gift{r.fulfillmentNote ? ` · ${r.fulfillmentNote}` : ""}</div>}
                  {r.asin && <div className="text-xs text-slate-500">ASIN {r.asin}</div>}
                </td>
                <td>{r.optionDetail || "—"}</td>
                <td className="text-right font-semibold">{r.quantity}</td>
                <td className="text-right">
                  <input
                    form={`order-row-${r.itemId}-${r.option1Value ?? ""}-${r.option2Value ?? ""}`}
                    name="unitCost"
                    defaultValue={r.unitCost ?? ""}
                    inputMode="decimal"
                    aria-label="Unit cost paid"
                    title="Price actually paid; saving updates this gift everywhere"
                    className="input w-24 text-right"
                  />
                </td>
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
                    <form id={`order-row-${r.itemId}-${r.option1Value ?? ""}-${r.option2Value ?? ""}`} action={orderRowAction} className="flex gap-1">
                      <input type="hidden" name="campaignId" value={id} />
                      <input type="hidden" name="itemId" value={r.itemId} />
                      <input type="hidden" name="option1Value" value={r.option1Value ?? ""} />
                      <input type="hidden" name="option2Value" value={r.option2Value ?? ""} />
                      {(r.byStatus.SELECTED ?? 0) > 0 ? (
                        <button name="intent" value="order" className="btn-primary btn-sm whitespace-nowrap">
                          Mark {r.byStatus.SELECTED} ordered
                        </button>
                      ) : null}
                      <button name="intent" value="price" className="btn-ghost btn-sm whitespace-nowrap" title="Save the price without changing statuses">
                        Save price
                      </button>
                    </form>
                    {(r.byStatus.ORDERED ?? 0) > 0 && (
                      <form action={bulkItemStatusAction}>
                        <input type="hidden" name="campaignId" value={id} />
                        <input type="hidden" name="itemId" value={r.itemId} />
                        <input type="hidden" name="option1Value" value={r.option1Value ?? ""} />
                        <input type="hidden" name="option2Value" value={r.option2Value ?? ""} />
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
