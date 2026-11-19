import { Alert } from "@/components/ui";
import { Stat } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { receiveAllOrderedAction } from "../../actions";
import { ReceiveForm } from "./receive-form";

export default async function ReceivingPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/receiving">) {
  const { id } = await params;
  const sp = await searchParams;
  const [ordered, received, byItem] = await Promise.all([
    db.selection.count({ where: { campaignId: id, status: "ORDERED" } }),
    db.selection.count({ where: { campaignId: id, status: "RECEIVED" } }),
    db.selection.groupBy({ by: ["itemId"], where: { campaignId: id, status: "ORDERED" }, _count: { _all: true } }),
  ]);
  const items = await db.item.findMany({ where: { id: { in: byItem.map((b) => b.itemId) } }, select: { id: true, name: true, asin: true, sku: true } });
  return (
    <div className="space-y-6">
      {typeof sp.saved === "string" && <Alert kind="success">{sp.saved} selection(s) marked received.</Alert>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Ordered, not yet received" value={ordered} tone={ordered > 0 ? "warn" : "default"} />
        <Stat label="Received, awaiting pickup" value={received} tone="good" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Receiving mode</h2>
          <p className="mt-1 text-xs text-slate-500">
            When boxes arrive, paste what&apos;s on the packing slips: ASINs, SKUs, employee numbers or confirmation codes (one per line or comma separated). Every ordered pick that matches is marked
            <strong> received</strong>. A USB barcode scanner can scan ASIN barcodes straight into the box.
          </p>
          <ReceiveForm campaignId={id} />
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Still on order</h2>
          {byItem.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nothing is waiting to be received.</p>
          ) : (
            <table className="table mt-3">
              <thead>
                <tr>
                  <th>Gift</th>
                  <th>ASIN / SKU</th>
                  <th className="text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {byItem.map((b) => {
                  const item = items.find((i) => i.id === b.itemId);
                  return (
                    <tr key={b.itemId}>
                      <td>{item?.name ?? "—"}</td>
                      <td className="font-mono text-xs">{item?.asin ?? item?.sku ?? "—"}</td>
                      <td className="text-right">{b._count._all}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <form action={receiveAllOrderedAction} className="mt-4">
            <input type="hidden" name="campaignId" value={id} />
            <button className="btn-secondary" disabled={ordered === 0}>
              Mark everything ordered as received ({ordered})
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
