import { PageHeader } from "@/components/admin/page-header";
import { emptyItem, existingCategories } from "../helpers";
import { ItemForm } from "../item-form";

export default async function NewItemPage() {
  const categories = await existingCategories();
  return (
    <div>
      <PageHeader title="Add a gift" description="Products are bought by HR (usually from Amazon). Custom gifts are perks HR arranges internally." />
      <ItemForm initial={emptyItem()} categories={categories} />
    </div>
  );
}
