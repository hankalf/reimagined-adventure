"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canonicalAmazonUrl, extractAsin, fetchProductMetadata, isAmazonUrl } from "@/lib/amazon";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_UPLOAD_BYTES, processImage } from "@/lib/images";
import { parseItemFile } from "@/lib/item-import";
import { parseOptionValues } from "@/lib/options";

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
  option1Label: z.string().trim().max(40).optional(),
  option1Values: z.string().trim().max(1000).optional(),
  option2Label: z.string().trim().max(40).optional(),
  option2Values: z.string().trim().max(1000).optional(),
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
    option1Label: str(formData, "option1Label"),
    option1Values: str(formData, "option1Values"),
    option2Label: str(formData, "option2Label"),
    option2Values: str(formData, "option2Values"),
    imageUrl: str(formData, "imageUrl"),
    active: str(formData, "active"),
    removeImage: str(formData, "removeImage"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  const unitCost = d.unitCost ? Number(d.unitCost.replace(/[^0-9.]/g, "")) : null;
  if (d.unitCost && (unitCost === null || !Number.isFinite(unitCost) || unitCost < 0)) return { error: "Unit cost must be a number." };
  const option1Values = parseOptionValues(d.option1Values);
  const option2Values = parseOptionValues(d.option2Values);
  if (option1Values.length > 0 && !d.option1Label) return { error: "Give option group 1 a label (e.g. Color) or clear its values." };
  if (option2Values.length > 0 && !d.option2Label) return { error: "Give option group 2 a label (e.g. Size) or clear its values." };
  if (option2Values.length > 0 && option1Values.length === 0) return { error: "Fill option group 1 before option group 2." };
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
    option1Label: option1Values.length > 0 ? d.option1Label || null : null,
    option1Values,
    option2Label: option2Values.length > 0 ? d.option2Label || null : null,
    option2Values,
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

// ---------- spreadsheet import ----------

export type ImportItemsState = { error?: string; summary?: { created: number; updated: number; skipped: number; imagesStored: number; errors: string[] } } | null;

async function fetchImage(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; GiftPortal/1.0)" } });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!mime.startsWith("image/")) return null;
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_UPLOAD_BYTES) return null;
    return { buffer, mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function importItemsAction(_prev: ImportItemsState, formData: FormData): Promise<ImportItemsState> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const downloadImages = formData.get("downloadImages") === "on";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a spreadsheet first." };
  if (file.size > 10 * 1024 * 1024) return { error: "File is too large (max 10 MB)." };
  const parsed = await parseItemFile(Buffer.from(await file.arrayBuffer()), file.name);
  if (parsed.rows.length === 0) return { error: parsed.errors[0] ?? "No gift rows found." };

  let created = 0;
  let updated = 0;
  let imagesStored = 0;
  const errors = [...parsed.errors];
  for (const row of parsed.rows) {
    const existing =
      row.matchBy.kind === "asin"
        ? await db.item.findFirst({ where: { asin: row.matchBy.value } })
        : row.matchBy.kind === "sku"
          ? await db.item.findFirst({ where: { sku: row.matchBy.value } })
          : await db.item.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });

    let imageId: string | undefined;
    if (downloadImages && row.imageUrl && (!existing || !existing.imageId)) {
      const fetched = await fetchImage(row.imageUrl);
      if (fetched) {
        try {
          const processed = await processImage(fetched.buffer, fetched.mime);
          imageId = (await db.image.create({ data: processed })).id;
          imagesStored += 1;
        } catch {
          errors.push(`Row ${row.rowNumber}: could not process the image at ${row.imageUrl}; kept as a link.`);
        }
      } else {
        errors.push(`Row ${row.rowNumber}: could not download ${row.imageUrl}; kept as a link.`);
      }
    }

    const data = {
      type: row.type,
      name: row.name,
      nameEs: row.nameEs,
      description: row.description,
      descriptionEs: row.descriptionEs,
      category: row.category,
      productUrl: row.productUrl,
      asin: row.asin,
      sku: row.sku,
      unitCost: row.unitCost,
      fulfillmentNote: row.fulfillmentNote,
      option1Label: row.option1Label,
      option1Values: row.option1Values,
      option2Label: row.option2Label,
      option2Values: row.option2Values,
      imageUrl: row.imageUrl,
      active: row.active,
      ...(imageId ? { imageId } : {}),
    };
    if (existing) {
      await db.item.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await db.item.create({ data });
      created += 1;
    }
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "items.imported", entityType: "Item", entityId: "bulk", meta: { file: file.name, created, updated, skipped: parsed.skipped, imagesStored } });
  revalidatePath("/admin/items");
  return { summary: { created, updated, skipped: parsed.skipped, imagesStored, errors: errors.slice(0, 20) } };
}
