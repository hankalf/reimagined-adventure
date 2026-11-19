import Link from "next/link";
import { Alert, StatusBadge } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { imageSrc } from "@/lib/image-src";
import { dec, money } from "@/lib/utils";

export default async function ItemsPage({ searchParams }: PageProps<"/admin/items">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const type = sp.type === "PRODUCT" || sp.type === "CUSTOM" ? sp.type : undefined;
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
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
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
                      <Link href={`/admin/items/${item.id}`} className="flex items-center gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xl">🎁</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 hover:underline">{item.name}</div>
                          {item.asin && <div className="text-xs text-slate-500">ASIN {item.asin}</div>}
                        </div>
                      </Link>
                    </td>
                    <td>{item.type === "CUSTOM" ? <span className="badge bg-emerald-100 text-emerald-800">Custom</span> : <span className="badge bg-slate-100 text-slate-700">Product</span>}</td>
                    <td className="text-slate-600">{item.category ?? "—"}</td>
                    <td className="text-slate-600">{item.optionValues.length > 0 ? `${item.optionLabel}: ${item.optionValues.join(", ")}` : "—"}</td>
                    <td className="text-right">{money(dec(item.unitCost))}</td>
                    <td className="text-slate-600">{item._count.campaigns}</td>
                    <td className="text-slate-600">{item._count.selections}</td>
                    <td>{item.active ? <StatusBadge status="AVAILABLE" label="Active" /> : <StatusBadge status="CLOSED" label="Inactive" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
