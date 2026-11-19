import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { existingCategories, toFormValues } from "../helpers";
import { ItemForm } from "../item-form";
import { fmtDate, money } from "@/lib/utils";
import { duplicateItemAction } from "../actions";

export default async function EditItemPage({ params }: PageProps<"/admin/items/[id]">) {
  const { id } = await params;
  const [item, categories, selectionCount, campaigns, history] = await Promise.all([
    db.item.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: "asc" } } } }),
    existingCategories(),
    db.selection.count({ where: { itemId: id } }),
    db.campaignItem.findMany({ where: { itemId: id }, include: { campaign: { select: { id: true, name: true } } } }),
    db.itemPriceHistory.findMany({ where: { itemId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  if (!item) notFound();
  const campaignNames = new Map((await db.campaign.findMany({ where: { id: { in: history.map((h) => h.campaignId).filter((c): c is string => Boolean(c)) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const sourceLabel: Record<string, string> = { ORDER: "Confirmed at order time", CATALOG: "Edited in catalog", IMPORT: "Spreadsheet import" };
  return (
    <div>
      <PageHeader
        title={item.name}
        description={campaigns.length > 0 ? `Shown in: ${campaigns.map((c) => c.campaign.name).join(", ")}` : "Not shown in any campaign yet."}
        actions={
          <>
            <form action={duplicateItemAction}>
              <input type="hidden" name="id" value={id} />
              <button className="btn-secondary">⧉ Duplicate gift</button>
            </form>
            <Link href="/admin/items" className="btn-secondary">
              ← Back to catalog
            </Link>
          </>
        }
      />
      <ItemForm initial={toFormValues(item, selectionCount)} categories={categories} />
      <section className="card mt-6 overflow-x-auto">
        <div className="p-4">
          <h2 className="font-semibold">Price history</h2>
          <p className="text-xs text-slate-500">Every change to this gift&apos;s unit cost, including prices HR confirmed when placing orders.</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th className="text-right">From</th>
              <th className="text-right">To</th>
              <th>Source</th>
              <th>Campaign</th>
              <th>By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-500">
                  No price changes recorded yet.
                </td>
              </tr>
            )}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="whitespace-nowrap">{fmtDate(h.createdAt, true)}</td>
                <td className="text-right">{money(h.oldPrice === null ? null : Number(h.oldPrice))}</td>
                <td className="text-right font-semibold">{money(Number(h.newPrice))}</td>
                <td>{sourceLabel[h.source] ?? h.source}</td>
                <td className="text-slate-600">{h.campaignId ? campaignNames.get(h.campaignId) ?? "—" : "—"}</td>
                <td className="text-slate-600">{h.changedByName ?? "—"}</td>
                <td className="text-xs text-slate-500">{h.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
