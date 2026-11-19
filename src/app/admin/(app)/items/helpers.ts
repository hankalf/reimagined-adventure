import { db } from "@/lib/db";
import { dec } from "@/lib/utils";
import type { ItemFormValues } from "./item-form";

export async function existingCategories(): Promise<string[]> {
  const rows = await db.item.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}

export function emptyItem(): ItemFormValues {
  return { type: "PRODUCT", name: "", nameEs: "", description: "", descriptionEs: "", category: "", productUrl: "", asin: "", sku: "", unitCost: "", fulfillmentNote: "", optionLabel: "", optionValues: "", imageUrl: "", imageId: null, active: true };
}

export function toFormValues(item: NonNullable<Awaited<ReturnType<typeof db.item.findUnique>>>, selectionCount: number): ItemFormValues {
  return {
    id: item.id,
    type: item.type,
    name: item.name,
    nameEs: item.nameEs ?? "",
    description: item.description,
    descriptionEs: item.descriptionEs ?? "",
    category: item.category ?? "",
    productUrl: item.productUrl ?? "",
    asin: item.asin ?? "",
    sku: item.sku ?? "",
    unitCost: dec(item.unitCost)?.toString() ?? "",
    fulfillmentNote: item.fulfillmentNote ?? "",
    optionLabel: item.optionLabel ?? "",
    optionValues: item.optionValues.join(", "),
    imageUrl: item.imageUrl ?? "",
    imageId: item.imageId,
    active: item.active,
    selectionCount,
  };
}
