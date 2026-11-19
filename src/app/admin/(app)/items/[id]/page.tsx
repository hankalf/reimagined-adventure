import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { existingCategories, toFormValues } from "../helpers";
import { ItemForm } from "../item-form";

export default async function EditItemPage({ params }: PageProps<"/admin/items/[id]">) {
  const { id } = await params;
  const [item, categories, selectionCount, campaigns] = await Promise.all([
    db.item.findUnique({ where: { id } }),
    existingCategories(),
    db.selection.count({ where: { itemId: id } }),
    db.campaignItem.findMany({ where: { itemId: id }, include: { campaign: { select: { id: true, name: true } } } }),
  ]);
  if (!item) notFound();
  return (
    <div>
      <PageHeader
        title={item.name}
        description={campaigns.length > 0 ? `Shown in: ${campaigns.map((c) => c.campaign.name).join(", ")}` : "Not shown in any campaign yet."}
        actions={
          <Link href="/admin/items" className="btn-secondary">
            ← Back to catalog
          </Link>
        }
      />
      <ItemForm initial={toFormValues(item, selectionCount)} categories={categories} />
    </div>
  );
}
