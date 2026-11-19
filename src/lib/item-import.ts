/**
 * Bulk import of catalog gifts from a spreadsheet (.xlsx or .csv). The column list below is the single
 * source of truth for both the parser (loose header matching) and the downloadable template.
 */
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { canonicalAmazonUrl, extractAsin, isAmazonUrl } from "./amazon";
import { parseOptionValues } from "./options";

export type ItemImportColumn = {
  key: string;
  header: string;
  aliases: string[];
  required?: boolean;
  description: string;
  example1: string;
  example2: string;
};

export const ITEM_IMPORT_COLUMNS: ItemImportColumn[] = [
  { key: "name", header: "name", aliases: ["gift", "item", "title", "product", "product name", "gift name", "item name"], required: true, description: "Gift name shown to employees (English).", example1: "Wireless Noise-Cancelling Earbuds", example2: "4 hours of paid time off" },
  { key: "name_es", header: "name_es", aliases: ["spanish name", "name (spanish)", "nombre"], description: "Optional Spanish name.", example1: "Audífonos inalámbricos con cancelación de ruido", example2: "4 horas de tiempo libre pagado" },
  { key: "description", header: "description", aliases: ["details", "desc"], description: "Short description (English).", example1: "Compact earbuds with active noise cancelling and a charging case.", example2: "Take a long lunch or leave early. Coordinate the date with your manager." },
  { key: "description_es", header: "description_es", aliases: ["spanish description", "descripcion", "descripción"], description: "Optional Spanish description.", example1: "", example2: "" },
  { key: "category", header: "category", aliases: ["cat", "group"], description: "Category used for the filter on the employee page, e.g. Tech, Home, Apparel, Perks.", example1: "Tech", example2: "Perks" },
  { key: "type", header: "type", aliases: ["kind", "gift type"], description: "product (HR buys it) or custom (HR arranges it, e.g. PTO). Default: product.", example1: "product", example2: "custom" },
  { key: "amazon_url", header: "amazon_url", aliases: ["amazon link", "url", "link", "product_url", "product url", "product link", "amazon"], description: "Amazon (or other store) link. The ASIN is extracted automatically from Amazon links.", example1: "https://www.amazon.com/dp/B0CHWRXH8B", example2: "" },
  { key: "asin", header: "asin", aliases: [], description: "Amazon ASIN, if you prefer to give it directly. Used to match existing gifts on re-import.", example1: "", example2: "" },
  { key: "sku", header: "sku", aliases: ["reference", "ref", "item number", "part number"], description: "Your own reference. Used to match existing gifts on re-import when there is no ASIN.", example1: "", example2: "PTO-4H" },
  { key: "unit_cost", header: "unit_cost", aliases: ["cost", "price", "unit price", "unit cost", "amount"], description: "Cost per unit, numbers only (69.99). Used for budgets.", example1: "69.99", example2: "0" },
  { key: "option1_label", header: "option1_label", aliases: ["option label", "option 1 label", "option1 label", "option_label"], description: "Label of the first option group, e.g. Color.", example1: "Color", example2: "" },
  { key: "option1_values", header: "option1_values", aliases: ["option values", "option 1 values", "option1 values", "option_values", "options"], description: "Values for the first group, separated by commas or |, e.g. Black, Teal, Rose.", example1: "Black, Teal, Rose", example2: "" },
  { key: "option2_label", header: "option2_label", aliases: ["option 2 label", "option2 label"], description: "Label of the second option group, e.g. Size.", example1: "", example2: "" },
  { key: "option2_values", header: "option2_values", aliases: ["option 2 values", "option2 values"], description: "Values for the second group, e.g. S, M, L, XL.", example1: "", example2: "" },
  { key: "colors", header: "colors", aliases: ["colours", "color", "colour"], description: "Shortcut: fills option group 1 with label Color (ignored when option1_values is given).", example1: "", example2: "" },
  { key: "sizes", header: "sizes", aliases: ["size"], description: "Shortcut: fills the next free option group with label Size.", example1: "", example2: "" },
  { key: "image_url", header: "image_url", aliases: ["image", "photo", "picture", "image link", "photo url", "images", "photos"], description: "Link(s) to product photos, separated by |. The first becomes the main picture; the rest go in the gallery. The importer can download them.", example1: "https://m.media-amazon.com/images/I/example.jpg | https://m.media-amazon.com/images/I/example-2.jpg", example2: "" },
  { key: "color_images", header: "color_images", aliases: ["colour images", "color photos", "colour photos", "option images"], description: "A photo per colour (option group 1 value): Value=link | Value=link, e.g. Teal=https://… | Rose=https://…", example1: "", example2: "" },
  { key: "fulfillment_note", header: "fulfillment_note", aliases: ["fulfilment note", "fulfillment", "how to fulfil", "hr note", "note"], description: "Custom gifts only: how HR fulfils it (shown to HR, never to employees).", example1: "", example2: "HR adds 4 hours of PTO in payroll and emails the manager." },
  { key: "active", header: "active", aliases: ["enabled", "status"], description: "yes/no. Inactive gifts are kept in the catalog but hidden. Default: yes.", example1: "yes", example2: "yes" },
];

export type ItemImportRow = {
  rowNumber: number;
  name: string;
  nameEs: string | null;
  description: string;
  descriptionEs: string | null;
  category: string | null;
  type: "PRODUCT" | "CUSTOM";
  productUrl: string | null;
  asin: string | null;
  sku: string | null;
  unitCost: number | null;
  option1Label: string | null;
  option1Values: string[];
  option2Label: string | null;
  option2Values: string[];
  /** First = main picture, rest = gallery. */
  imageUrls: string[];
  /** Photo per option-1 value. */
  colorImages: Array<{ value: string; url: string }>;
  fulfillmentNote: string | null;
  active: boolean;
  matchBy: { kind: "asin" | "sku" | "name"; value: string };
};

export type ItemImportResult = { rows: ItemImportRow[]; errors: string[]; skipped: number };

function norm(h: string): string {
  return h.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s_\-()]+/g, " ").trim();
}

function findColumns(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  const normalized = headers.map(norm);
  for (const col of ITEM_IMPORT_COLUMNS) {
    const names = [col.header, ...col.aliases].map(norm);
    const idx = normalized.findIndex((h) => names.includes(h));
    if (idx >= 0 && !map.has(col.key)) map.set(col.key, idx);
  }
  return map;
}

function truthy(value: string): boolean {
  return !/^(n|no|false|0|inactive|off|hidden)$/i.test(value.trim());
}

/** Map a 2-D table (first row = headers) to typed rows. Pure; used by both the xlsx and csv readers. */
export function mapItemRows(table: string[][]): ItemImportResult {
  const data = table.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (data.length === 0) return { rows: [], errors: ["The file is empty."], skipped: 0 };
  const headers = (data[0] ?? []).map((h) => String(h ?? ""));
  const cols = findColumns(headers);
  if (!cols.has("name")) {
    return { rows: [], errors: [`Could not find a "name" column. Found headers: ${headers.filter(Boolean).join(", ") || "(none)"}. Download the template to see the expected layout.`], skipped: 0 };
  }

  const rows: ItemImportRow[] = [];
  const errors: string[] = [];
  const seenKeys = new Set<string>();
  let skipped = 0;
  for (let i = 1; i < data.length; i += 1) {
    const r = data[i] ?? [];
    const rowNumber = i + 1;
    const cell = (key: string): string => {
      const idx = cols.get(key);
      return idx === undefined ? "" : String(r[idx] ?? "").trim();
    };
    const name = cell("name");
    if (!name) {
      errors.push(`Row ${rowNumber}: missing name, skipped.`);
      skipped += 1;
      continue;
    }

    const typeRaw = cell("type").toLowerCase();
    const type: "PRODUCT" | "CUSTOM" = /^(custom|perk|pto|internal|non-purchase)$/.test(typeRaw) ? "CUSTOM" : "PRODUCT";

    let productUrl: string | null = cell("amazon_url") || null;
    let asin: string | null = cell("asin").toUpperCase() || null;
    if (productUrl && !/^https?:\/\//i.test(productUrl)) productUrl = `https://${productUrl}`;
    if (productUrl) {
      const fromUrl = extractAsin(productUrl);
      if (fromUrl) {
        asin = asin ?? fromUrl;
        if (isAmazonUrl(productUrl)) productUrl = canonicalAmazonUrl(fromUrl, productUrl);
      }
    } else if (asin) {
      productUrl = canonicalAmazonUrl(asin);
    }
    if (asin && !/^[A-Z0-9]{10}$/.test(asin)) {
      errors.push(`Row ${rowNumber}: "${asin}" is not a valid ASIN (10 letters/digits); ignored.`);
      asin = null;
    }
    if (type === "CUSTOM") {
      productUrl = null;
      asin = null;
    }

    const costCell = cell("unit_cost");
    const costRaw = costCell.replace(/[^0-9.\-]/g, "");
    const unitCost = costRaw ? Number(costRaw) : null;
    if (costCell && (unitCost === null || !Number.isFinite(unitCost) || unitCost < 0)) {
      errors.push(`Row ${rowNumber}: unit cost "${cell("unit_cost")}" is not a number; left empty.`);
    }

    // Option groups: explicit columns first, then the colors/sizes shortcuts into the next free slot.
    let option1Label: string | null = cell("option1_label") || null;
    let option1Values = parseOptionValues(cell("option1_values"));
    let option2Label: string | null = cell("option2_label") || null;
    let option2Values = parseOptionValues(cell("option2_values"));
    const colors = parseOptionValues(cell("colors"));
    const sizes = parseOptionValues(cell("sizes"));
    for (const [label, values] of [["Color", colors], ["Size", sizes]] as const) {
      if (values.length === 0) continue;
      if (option1Values.length === 0) {
        option1Label = option1Label ?? label;
        option1Values = values;
      } else if (option2Values.length === 0) {
        option2Label = option2Label ?? label;
        option2Values = values;
      } else {
        errors.push(`Row ${rowNumber}: more than two option groups; "${label}" ignored.`);
      }
    }
    if (option1Values.length === 0 && option2Values.length > 0) {
      option1Label = option2Label;
      option1Values = option2Values;
      option2Label = null;
      option2Values = [];
    }
    if (option1Values.length > 0 && !option1Label) option1Label = "Option";
    if (option2Values.length > 0 && !option2Label) option2Label = "Option 2";
    if (option1Values.length === 0) option1Label = null;
    if (option2Values.length === 0) option2Label = null;

    const sku = cell("sku") || null;
    const matchBy: ItemImportRow["matchBy"] = asin ? { kind: "asin", value: asin } : sku ? { kind: "sku", value: sku } : { kind: "name", value: name.toLowerCase() };
    const dedupeKey = `${matchBy.kind}:${matchBy.value}`;
    if (seenKeys.has(dedupeKey)) {
      errors.push(`Row ${rowNumber}: duplicate of an earlier row (${matchBy.kind} ${matchBy.value}); skipped.`);
      skipped += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    const imageUrls: string[] = [];
    for (const raw of cell("image_url").split(/[|\n]/)) {
      const u = raw.trim();
      if (!u) continue;
      if (/^https?:\/\//i.test(u)) imageUrls.push(u);
      else errors.push(`Row ${rowNumber}: image link "${u}" must start with http(s)://; ignored.`);
    }
    const colorImages: Array<{ value: string; url: string }> = [];
    for (const raw of cell("color_images").split(/[|\n]/)) {
      const part = raw.trim();
      if (!part) continue;
      const eq = part.indexOf("=");
      const value = eq > 0 ? part.slice(0, eq).trim() : "";
      const url = eq > 0 ? part.slice(eq + 1).trim() : "";
      if (!value || !/^https?:\/\//i.test(url)) {
        errors.push(`Row ${rowNumber}: color_images entry "${part}" must look like Value=https://…; ignored.`);
        continue;
      }
      colorImages.push({ value, url });
    }

    rows.push({
      rowNumber,
      name,
      nameEs: cell("name_es") || null,
      description: cell("description"),
      descriptionEs: cell("description_es") || null,
      category: cell("category") || null,
      type,
      productUrl,
      asin,
      sku,
      unitCost: unitCost !== null && Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : null,
      option1Label,
      option1Values,
      option2Label,
      option2Values,
      imageUrls,
      colorImages,
      fulfillmentNote: cell("fulfillment_note") || null,
      active: cell("active") ? truthy(cell("active")) : true,
      matchBy,
    });
  }
  return { rows, errors, skipped };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  return String(value);
}

/** Read an .xlsx or .csv upload into rows. Picks the "Gifts" sheet when present, otherwise the first sheet. */
export async function parseItemFile(buffer: Buffer, filename: string): Promise<ItemImportResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const parsed = Papa.parse<string[]>(buffer.toString("utf8").replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    return mapItemRows(parsed.data);
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: ["Could not read the file. Upload an .xlsx workbook or a .csv file."], skipped: 0 };
  }
  const sheet = wb.getWorksheet("Gifts") ?? wb.worksheets[0];
  if (!sheet) return { rows: [], errors: ["The workbook has no sheets."], skipped: 0 };
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-based: values[0] is empty
    table.push(values.slice(1).map(cellText));
  });
  return mapItemRows(table);
}

/** Header + example rows for the downloadable template. */
export function templateRows(): string[][] {
  return [ITEM_IMPORT_COLUMNS.map((c) => c.header), ITEM_IMPORT_COLUMNS.map((c) => c.example1), ITEM_IMPORT_COLUMNS.map((c) => c.example2)];
}

/** Build the .xlsx template with a Gifts sheet and an Instructions sheet. */
export async function buildTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  const gifts = wb.addWorksheet("Gifts");
  const [header, ...examples] = templateRows();
  gifts.addRow(header);
  for (const ex of examples) gifts.addRow(ex);
  gifts.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  gifts.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  gifts.views = [{ state: "frozen", ySplit: 1 }];
  ITEM_IMPORT_COLUMNS.forEach((c, i) => {
    gifts.getColumn(i + 1).width = Math.min(60, Math.max(12, c.header.length + 2, c.example1.length + 2, c.example2.length + 2));
  });
  for (const r of [2, 3]) gifts.getRow(r).font = { italic: true, color: { argb: "FF6B7280" } };

  const info = wb.addWorksheet("Instructions");
  info.addRow(["How to use this template"]).font = { bold: true, size: 14 };
  info.addRow(["1. Fill one row per gift on the Gifts sheet. The two grey example rows show the format; delete or overwrite them."]);
  info.addRow(["2. Only name is required. Paste an Amazon link in amazon_url and the ASIN is picked up automatically."]);
  info.addRow(["3. Options: use option1_label/option1_values (and option2_*) for colours and sizes, or the colors / sizes shortcut columns."]);
  info.addRow(["4. Re-importing the same file updates existing gifts (matched by ASIN, then SKU, then name) instead of creating duplicates."]);
  info.addRow(["5. Upload the file on Admin → Gift catalog → Import gifts from a spreadsheet."]);
  info.addRow([]);
  info.addRow(["Column", "Required", "Description"]).font = { bold: true };
  for (const c of ITEM_IMPORT_COLUMNS) info.addRow([c.header, c.required ? "yes" : "", c.description]);
  info.getColumn(1).width = 20;
  info.getColumn(2).width = 10;
  info.getColumn(3).width = 110;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
