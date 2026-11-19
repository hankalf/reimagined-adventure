import Link from "next/link";
import { Alert, StatusBadge } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/image-src";
import { dec, money } from "@/lib/utils";
import { optionGroups } from "@/lib/options";
import { ImportItemsForm } from "./import-form";
import { ItemThumb } from "@/components/item-thumb";
import { bulkItemsAction } from "./actions";
import { BulkBar } from "./bulk-bar";

export default async function ItemsPage({ searchParams }: PageProps<"/admin/items">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = sp.type === "PRODUCT" || sp.type === "CUSTOM" ? sp.type : undefined;
  const campaigns = await db.campaign.findMany({ where: { status: { not: "CLOSED" } }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" } });
  const items = await db.item.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }, { asin: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { _count: { select: { campaigns: true, selections: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Gift catalog"
        description="Everything employees can be offered. Add gifts here, then choose which ones each campaign shows."
        actions={
          <Link href="/admin/items/new" className="btn-primary">
            + Add gift
          </Link>
        }
      />
      {typeof sp.saved === "string" && (
        <Alert kind="success" className="mb-4">
          Saved “{sp.saved}”.
        </Alert>
      )}
      {typeof sp.warn === "string" && (
        <Alert kind="warning" className="mb-4">
          {sp.warn}
        </Alert>
      )}
      <details className="card mb-4 p-4" open={sp.import === "1"}>
        <summary className="cursor-pointer font-semibold">Import gifts from a spreadsheet</summary>
        <p className="mt-1 text-xs text-slate-500">
          Upload an Excel (.xlsx) or CSV file with one gift per row. Re-importing updates existing gifts (matched by ASIN, then SKU, then name) instead of creating duplicates.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="/api/items/template?format=xlsx" className="btn-secondary btn-sm">
            ⬇ Download Excel template
          </a>
          <a href="/api/items/template?format=csv" className="btn-secondary btn-sm">
            ⬇ Download CSV template
          </a>
        </div>
        <div className="mt-4">
          <ImportItemsForm />
        </div>
      </details>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, category or ASIN" className="input sm:max-w-xs" />
        <select name="type" defaultValue={type ?? ""} className="input sm:max-w-[180px]">
          <option value="">All types</option>
          <option value="PRODUCT">Products</option>
          <option value="CUSTOM">Custom gifts</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No gifts yet"
          body="Add your first gift. Paste an Amazon link to prefill the name and price, upload a photo, and it is ready to add to a campaign."
          action={
            <Link href="/admin/items/new" className="btn-primary">
              + Add gift
            </Link>
          }
        />
      ) : (
        <form action={bulkItemsAction} className="card overflow-x-auto">
          <BulkBar campaigns={campaigns} categories={[...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort()} />
          <table className="table">
            <thead>
              <tr>
                <th className="w-8">
                  <span className="sr-only">Select</span>
                </th>
                <th>Gift</th>
                <th>Type</th>
                <th>Category</th>
                <th>Options</th>
                <th className="text-right">Cost</th>
                <th>In campaigns</th>
                <th>Chosen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const src = imageSrc(item, true);
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td>
                      <input type="checkbox" name="ids" value={item.id} className="h-4 w-4" aria-label={`Select ${item.name}`} />
                    </td>
                    <td>
                      <Link href={`/admin/items/${item.id}`} className="flex items-center gap-3">
                        <div className="w-14 shrink-0">
                          <ItemThumb src={src} framing={item} className="rounded-lg border border-slate-200" placeholder="🎁" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 hover:underline">{item.name}</div>
                          {item.asin && <div className="text-xs text-slate-500">ASIN {item.asin}</div>}
                        </div>
                      </Link>
                    </td>
                    <td>{item.type === "CUSTOM" ? <span className="badge bg-emerald-100 text-emerald-800">Custom</span> : <span className="badge bg-slate-100 text-slate-700">Product</span>}</td>
                    <td className="text-slate-600">{item.category ?? "—"}</td>
                    <td className="text-slate-600">
                      {optionGroups(item).length === 0 ? "—" : optionGroups(item).map((g) => <div key={g.index}>{`${g.label}: ${g.values.join(", ")}`}</div>)}
                    </td>
                    <td className="text-right">{money(dec(item.unitCost))}</td>
                    <td className="text-slate-600">{item._count.campaigns}</td>
                    <td className="text-slate-600">{item._count.selections}</td>
                    <td>{item.active ? <StatusBadge status="AVAILABLE" label="Active" /> : <StatusBadge status="CLOSED" label="Inactive" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </form>
      )}
    </div>
  );
}
