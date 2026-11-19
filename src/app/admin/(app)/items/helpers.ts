import { db } from "@/lib/db";
import { dec } from "@/lib/utils";
import type { ItemFormValues } from "./item-form";

export async function existingCategories(): Promise<string[]> {
  const rows = await db.item.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ["category"], orderBy: { category: "asc" } });
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
}

export function emptyItem(): ItemFormValues {
  return { type: "PRODUCT", name: "", nameEs: "", description: "", descriptionEs: "", category: "", productUrl: "", asin: "", sku: "", unitCost: "", fulfillmentNote: "", option1Label: "", option1Values: "", option2Label: "", option2Values: "", imageUrl: "", imageId: null, extraImages: [], thumbFit: "contain", thumbZoom: 100, thumbFocusX: 50, thumbFocusY: 50, active: true };
}

type ItemWithImages = NonNullable<Awaited<ReturnType<typeof db.item.findUnique>>> & { images: Array<{ id: string; imageId: string; option1Value: string | null }> };

export function toFormValues(item: ItemWithImages, selectionCount: number): ItemFormValues {
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
    option1Label: item.option1Label ?? "",
    option1Values: item.option1Values.join(", "),
    option2Label: item.option2Label ?? "",
    option2Values: item.option2Values.join(", "),
    imageUrl: item.imageUrl ?? "",
    imageId: item.imageId,
    extraImages: item.images.map((i) => ({ id: i.id, imageId: i.imageId, option1Value: i.option1Value })),
    thumbFit: item.thumbFit,
    thumbZoom: item.thumbZoom,
    thumbFocusX: item.thumbFocusX,
    thumbFocusY: item.thumbFocusY,
    active: item.active,
    selectionCount,
  };
}
