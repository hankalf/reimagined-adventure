"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canonicalAmazonUrl, extractAsin, fetchProductMetadata, isAmazonUrl } from "@/lib/amazon";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadImage, processImage } from "@/lib/images";
import { parseItemFile } from "@/lib/item-import";
import { recordPriceChange } from "@/lib/pricing";
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
  thumbFit: z.string().optional(),
  thumbZoom: z.string().optional(),
  thumbFocusX: z.string().optional(),
  thumbFocusY: z.string().optional(),
});

const clampInt = (raw: string | undefined, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(raw ?? ""));
  return raw && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

/** Process an uploaded File into a stored Image row; returns its id. */
async function storeUploadedFile(file: File): Promise<string> {
  const processed = await processImage(Buffer.from(await file.arrayBuffer()), file.type);
  return (await db.image.create({ data: processed })).id;
}

/** Download a remote photo and store it; null when it cannot be fetched or processed. */
async function storeImageFromUrl(url: string): Promise<string | null> {
  const fetched = await downloadImage(url);
  if (!fetched) return null;
  try {
    const processed = await processImage(fetched.buffer, fetched.mime);
    return (await db.image.create({ data: processed })).id;
  } catch {
    return null;
  }
}

async function deleteItemImage(row: { id: string; imageId: string }): Promise<void> {
  await db.itemImage.delete({ where: { id: row.id } }).catch(() => undefined);
  await db.image.delete({ where: { id: row.imageId } }).catch(() => undefined);
}

/**
 * Gallery and per-colour photos for a gift: extra uploads, removals, per-colour uploads/removals, and photos
 * fetched from the product page. Returns warnings for photos that could not be downloaded.
 */
async function syncItemImages(itemId: string, formData: FormData, option1Values: string[], opts: { hasPrimary: boolean }): Promise<{ warnings: string[]; primaryImageId: string | null }> {
  const warnings: string[] = [];
  let primaryImageId: string | null = null;
  const existing = await db.itemImage.findMany({ where: { itemId }, orderBy: { sortOrder: "asc" } });
  let nextOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;

  // Removals requested from the form
  const removeIds = new Set(formData.getAll("removeImageIds").map(String));
  for (const row of existing) if (removeIds.has(row.id)) await deleteItemImage(row);

  // Colour photos whose value no longer exists
  for (const row of existing) if (row.option1Value && !option1Values.includes(row.option1Value) && !removeIds.has(row.id)) await deleteItemImage(row);

  // Extra gallery uploads
  for (const file of formData.getAll("extraImages")) {
    if (!(file instanceof File) || file.size === 0) continue;
    try {
      const imageId = await storeUploadedFile(file);
      await db.itemImage.create({ data: { itemId, imageId, sortOrder: nextOrder++ } });
    } catch (err) {
      warnings.push(`${file.name}: ${err instanceof Error ? err.message : "could not process"}`);
    }
  }

  // Per-colour uploads / removals
  for (const value of option1Values) {
    const current = existing.find((r) => r.option1Value === value && !removeIds.has(r.id));
    const file = formData.get(`colorImage:${value}`);
    if (file instanceof File && file.size > 0) {
      try {
        const imageId = await storeUploadedFile(file);
        if (current) await deleteItemImage(current);
        await db.itemImage.create({ data: { itemId, imageId, option1Value: value, sortOrder: nextOrder++ } });
      } catch (err) {
        warnings.push(`${value}: ${err instanceof Error ? err.message : "could not process"}`);
      }
    } else if (formData.get(`colorImageRemove:${value}`) === "1" && current) {
      await deleteItemImage(current);
    }
  }

  // Photos fetched from the product page (URLs chosen in the form)
  if (formData.get("useFetchedPhotos") === "on") {
    let urls: string[] = [];
    try {
      urls = JSON.parse(str(formData, "autoImageUrls") || "[]");
    } catch {
      urls = [];
    }
    let failed = 0;
    for (const url of urls.slice(0, 8)) {
      if (typeof url !== "string") continue;
      const imageId = await storeImageFromUrl(url);
      if (!imageId) {
        failed += 1;
        continue;
      }
      if (!opts.hasPrimary && !primaryImageId) primaryImageId = imageId;
      else await db.itemImage.create({ data: { itemId, imageId, sortOrder: nextOrder++ } });
    }
    if (failed > 0) warnings.push(`${failed} of ${urls.length} product photo(s) could not be downloaded; you can upload them manually.`);
  }
  return { warnings, primaryImageId };
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
    thumbFit: str(formData, "thumbFit"),
    thumbZoom: str(formData, "thumbZoom"),
    thumbFocusX: str(formData, "thumbFocusX"),
    thumbFocusY: str(formData, "thumbFocusY"),
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
      imageId = await storeUploadedFile(file);
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
    thumbFit: d.thumbFit === "cover" ? "cover" : "contain",
    thumbZoom: clampInt(d.thumbZoom, 100, 250, 100),
    thumbFocusX: clampInt(d.thumbFocusX, 0, 100, 50),
    thumbFocusY: clampInt(d.thumbFocusY, 0, 100, 50),
    ...(imageId !== undefined ? { imageId } : {}),
  };

  let id = d.id;
  let hasPrimary: boolean;
  if (id) {
    const existing = await db.item.findUnique({ where: { id } });
    if (!existing) return { error: "Gift not found." };
    await db.item.update({ where: { id }, data });
    await recordPriceChange({ itemId: id, oldPrice: existing.unitCost, newPrice: unitCost, source: "CATALOG", admin: { id: admin.id, name: admin.name } });
    if (imageId !== undefined && existing.imageId && existing.imageId !== imageId) await db.image.delete({ where: { id: existing.imageId } }).catch(() => undefined);
    hasPrimary = imageId === undefined ? Boolean(existing.imageId) : Boolean(imageId);
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.updated", entityType: "Item", entityId: id, meta: { name: d.name } });
  } else {
    const created = await db.item.create({ data: { ...data, imageId: imageId ?? null } });
    id = created.id;
    hasPrimary = Boolean(imageId);
    await recordPriceChange({ itemId: id, oldPrice: null, newPrice: unitCost, source: "CATALOG", admin: { id: admin.id, name: admin.name }, note: "Created" });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.created", entityType: "Item", entityId: id, meta: { name: d.name } });
  }
  const synced = await syncItemImages(id, formData, option1Values, { hasPrimary });
  if (synced.primaryImageId) await db.item.update({ where: { id }, data: { imageId: synced.primaryImageId } });
  revalidatePath("/admin/items");
  const warn = synced.warnings.length > 0 ? `&warn=${encodeURIComponent(synced.warnings.join(" "))}` : "";
  redirect(`/admin/items?saved=${encodeURIComponent(d.name)}${warn}`);
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
    const gallery = await db.itemImage.findMany({ where: { itemId: id } });
    await db.item.delete({ where: { id } });
    if (item.imageId) await db.image.delete({ where: { id: item.imageId } }).catch(() => undefined);
    for (const g of gallery) await db.image.delete({ where: { id: g.imageId } }).catch(() => undefined);
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "item.deleted", entityType: "Item", entityId: id, meta: { name: item.name } });
  }
  revalidatePath("/admin/items");
  redirect("/admin/items");
}

export type AmazonLookup = {
  ok: boolean;
  asin?: string;
  url?: string;
  title?: string;
  imageUrl?: string;
  images?: string[];
  price?: number;
  description?: string;
  category?: string;
  variants?: Array<{ label: string; values: string[] }>;
  message: string;
};

/** Called from the item form: normalise the Amazon link and try to prefill details. */
export async function lookupAmazonAction(url: string): Promise<AmazonLookup> {
  await requireAdmin();
  const asin = extractAsin(url);
  if (!asin) return { ok: false, message: "Couldn't find an ASIN in that link. Paste the product page URL (it usually contains /dp/XXXXXXXXXX)." };
  const canonical = canonicalAmazonUrl(asin, url);
  const meta = await fetchProductMetadata(canonical);
  if (meta.source === "none") {
    return { ok: true, asin, url: canonical, images: [], variants: [], message: `Found ASIN ${asin}. Amazon didn't share product details automatically (it often blocks automated requests), so please type the name and price and upload photos.` };
  }
  const found = [meta.title && "name", meta.price && "price", meta.images.length > 0 && `${meta.images.length} photo(s)`, meta.variants.length > 0 && "options", meta.category && "category"].filter(Boolean).join(", ");
  return {
    ok: true,
    asin,
    url: canonical,
    title: meta.title,
    imageUrl: meta.imageUrl,
    images: meta.images,
    price: meta.price,
    description: meta.description,
    category: meta.category,
    variants: meta.variants,
    message: `Found ASIN ${asin} and prefilled ${found || "what was available"} from the product page. Please double-check before saving.`,
  };
}

// ---------- spreadsheet import ----------

export type ImportItemsState = { error?: string; summary?: { created: number; updated: number; skipped: number; imagesStored: number; errors: string[] } } | null;

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
    const galleryIds: string[] = [];
    const colorIds: Array<{ value: string; imageId: string }> = [];
    if (downloadImages) {
      const [primaryUrl, ...moreUrls] = row.imageUrls;
      if (primaryUrl && (!existing || !existing.imageId)) {
        const id = await storeImageFromUrl(primaryUrl);
        if (id) {
          imageId = id;
          imagesStored += 1;
        } else errors.push(`Row ${row.rowNumber}: could not download ${primaryUrl}; kept as a link.`);
      }
      for (const url of moreUrls) {
        const id = await storeImageFromUrl(url);
        if (id) {
          galleryIds.push(id);
          imagesStored += 1;
        } else errors.push(`Row ${row.rowNumber}: could not download ${url}.`);
      }
      for (const c of row.colorImages) {
        const id = await storeImageFromUrl(c.url);
        if (id) {
          colorIds.push({ value: c.value, imageId: id });
          imagesStored += 1;
        } else errors.push(`Row ${row.rowNumber}: could not download the ${c.value} photo.`);
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
      imageUrl: row.imageUrls[0] ?? null,
      active: row.active,
      ...(imageId ? { imageId } : {}),
    };
    let itemId: string;
    if (existing) {
      await db.item.update({ where: { id: existing.id }, data });
      itemId = existing.id;
      updated += 1;
      await recordPriceChange({ itemId, oldPrice: existing.unitCost, newPrice: row.unitCost, source: "IMPORT", admin: { id: admin.id, name: admin.name }, note: file.name });
    } else {
      itemId = (await db.item.create({ data })).id;
      created += 1;
      await recordPriceChange({ itemId, oldPrice: null, newPrice: row.unitCost, source: "IMPORT", admin: { id: admin.id, name: admin.name }, note: `Imported from ${file.name}` });
    }
    if (galleryIds.length > 0 || colorIds.length > 0) {
      const max = await db.itemImage.aggregate({ where: { itemId }, _max: { sortOrder: true } });
      let order = (max._max.sortOrder ?? -1) + 1;
      for (const gid of galleryIds) await db.itemImage.create({ data: { itemId, imageId: gid, sortOrder: order++ } });
      for (const c of colorIds) {
        const old = await db.itemImage.findFirst({ where: { itemId, option1Value: c.value } });
        if (old) await deleteItemImage(old);
        await db.itemImage.create({ data: { itemId, imageId: c.imageId, option1Value: c.value, sortOrder: order++ } });
      }
    }
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "items.imported", entityType: "Item", entityId: "bulk", meta: { file: file.name, created, updated, skipped: parsed.skipped, imagesStored } });
  revalidatePath("/admin/items");
  return { summary: { created, updated, skipped: parsed.skipped, imagesStored, errors: errors.slice(0, 20) } };
}
