"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canonicalAmazonUrl, extractAsin, fetchProductMetadata, isAmazonUrl } from "@/lib/amazon";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { processImage } from "@/lib/images";

export type ItemFormState = { error?: string; success?: string } | null;

const itemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["PRODUCT", "CUSTOM"]),
  name: z.string().trim().min(1, "Name is required").max(200),
  nameEs: z.string().trim().max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  descriptionEs: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(60).optional(),
  productUrl: z.string().trim().max(2000).optional(),
  sku: z.string().trim().max(80).optional(),
  unitCost: z.string().trim().optional(),
  fulfillmentNote: z.string().trim().max(2000).optional(),
  optionLabel: z.string().trim().max(40).optional(),
  optionValues: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().max(2000).optional(),
  active: z.string().optional(),
  removeImage: z.string().optional(),
});

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

export async function saveItemAction(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const admin = await requireAdmin();
  const parsed = itemSchema.safeParse({
    id: str(formData, "id") || undefined,
    type: str(formData, "type"),
    name: str(formData, "name"),
    nameEs: str(formData, "nameEs"),
    description: str(formData, "description"),
    descriptionEs: str(formData, "descriptionEs"),
    category: str(formData, "category"),
    productUrl: str(formData, "productUrl"),
    sku: str(formData, "sku"),
    unitCost: str(formData, "unitCost"),
    fulfillmentNote: str(formData, "fulfillmentNote"),
    optionLabel: str(formData, "optionLabel"),
    optionValues: str(formData, "optionValues"),
    imageUrl: str(formData, "imageUrl"),
    active: str(formData, "active"),
    removeImage: str(formData, "removeImage"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const unitCost = d.unitCost ? Number(d.unitCost.replace(/[^0-9.]/g, "")) : null;
  if (d.unitCost && (unitCost === null || !Number.isFinite(unitCost) || unitCost < 0)) return { error: "Unit cost must be a number." };
  const optionValues = (d.optionValues ?? "").split(/[,\n]/).map((v) => v.trim()).filter(Boolean);
  if (optionValues.length > 0 && !d.optionLabel) return { error: "Give the option group a label (e.g. Size) or clear the option values." };
  if (d.imageUrl && !/^https?:\/\//i.test(d.imageUrl)) return { error: "Image URL must start with http:// or https://" };

  let productUrl = d.productUrl || null;
  let asin: string | null = null;
  if (productUrl) {
    if (!/^https?:\/\//i.test(productUrl)) productUrl = `https://${productUrl}`;
    asin = extractAsin(productUrl);
    if (asin && isAmazonUrl(productUrl)) productUrl = canonicalAmazonUrl(asin, productUrl);
  }

  let imageId: string | null | undefined = undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      const processed = await processImage(Buffer.from(await file.arrayBuffer()), file.type);
      const img = await db.image.create({ data: processed });
      imageId = img.id;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not process the image." };
    }
  } else if (d.removeImage === "1") {
    imageId = null;
  }

  const data = {
    type: d.type,
    name: d.name,
    nameEs: d.nameEs || null,
    description: d.description ?? "",
    descriptionEs: d.descriptionEs || null,
    category: d.category || null,
    productUrl: d.type === "PRODUCT" ? productUrl : null,
    asin: d.type === "PRODUCT" ? asin : null,
    sku: d.sku || null,
    unitCost,
    fulfillmentNote: d.fulfillmentNote || null,
    optionLabel: optionValues.length > 0 ? d.optionLabel || null : null,
    optionValues,
    imageUrl: d.imageUrl || null,
    active: d.active === "on" || d.active === "1",
    ...(imageId !== undefined ? { imageId } : {}),
  };

  let id = d.id;
  if (id) {
    const existing = await db.item.findUnique({ where: { id } });
    if (!existing) return { error: "Gift not found." };
    await db.item.update({ where: { id }, data });
    if (imageId !== undefined && existing.imageId && existing.imageId !== imageId) await db.image.delete({ where: { id: existing.imageId } }).catch(() => undefined);
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.updated", entityType: "Item", entityId: id, meta: { name: d.name } });
  } else {
    const created = await db.item.create({ data: { ...data, imageId: imageId ?? null } });
    id = created.id;
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.created", entityType: "Item", entityId: id, meta: { name: d.name } });
  }
  revalidatePath("/admin/items");
  redirect(`/admin/items?saved=${encodeURIComponent(d.name)}`);
}

export async function deleteItemAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  const selections = await db.selection.count({ where: { itemId: id } });
  const item = await db.item.findUnique({ where: { id } });
  if (!item) return;
  if (selections > 0) {
    await db.item.update({ where: { id }, data: { active: false } });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.deactivated", entityType: "Item", entityId: id, meta: { reason: "has selections" } });
  } else {
    await db.item.delete({ where: { id } });
    if (item.imageId) await db.image.delete({ where: { id: item.imageId } }).catch(() => undefined);
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.deleted", entityType: "Item", entityId: id, meta: { name: item.name } });
  }
  revalidatePath("/admin/items");
  redirect("/admin/items");
}

export type AmazonLookup = { ok: boolean; asin?: string; url?: string; title?: string; imageUrl?: string; price?: number; description?: string; message: string };

/** Called from the item form: normalise the Amazon link and try to prefill details. */
export async function lookupAmazonAction(url: string): Promise<AmazonLookup> {
  await requireAdmin();
  const asin = extractAsin(url);
  if (!asin) return { ok: false, message: "Couldn't find an ASIN in that link. Paste the product page URL (it usually contains /dp/XXXXXXXXXX)." };
  const canonical = canonicalAmazonUrl(asin, url);
  const meta = await fetchProductMetadata(canonical);
  if (meta.source === "none") {
    return { ok: true, asin, url: canonical, message: `Found ASIN ${asin}. Amazon didn't share product details automatically, so please type the name and price and upload a photo.` };
  }
  return { ok: true, asin, url: canonical, title: meta.title, imageUrl: meta.imageUrl, price: meta.price, description: meta.description, message: `Found ASIN ${asin} and prefilled the details from Amazon. Please double-check them.` };
}
