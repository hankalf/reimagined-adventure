import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildTemplateWorkbook, ITEM_IMPORT_COLUMNS, mapItemRows, parseItemFile, templateRows } from "@/lib/item-import";

describe("mapItemRows", () => {
  it("reads the template layout and derives ASIN / canonical URL / options", () => {
    const res = mapItemRows(templateRows());
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(2);
    const [earbuds, pto] = res.rows;
    expect(earbuds).toMatchObject({ name: "Wireless Noise-Cancelling Earbuds", type: "PRODUCT", asin: "B0CHWRXH8B", productUrl: "https://www.amazon.com/dp/B0CHWRXH8B", unitCost: 69.99, option1Label: "Color", option1Values: ["Black", "Teal", "Rose"], option2Values: [], active: true, matchBy: { kind: "asin", value: "B0CHWRXH8B" } });
    expect(pto).toMatchObject({ name: "4 hours of paid time off", type: "CUSTOM", productUrl: null, asin: null, sku: "PTO-4H", unitCost: 0, fulfillmentNote: expect.stringContaining("PTO"), matchBy: { kind: "sku", value: "PTO-4H" } });
  });
  it("matches loose headers and the colors/sizes shortcuts", () => {
    const res = mapItemRows([
      ["Product Name", "Amazon Link", "Price", "Colours", "Sizes", "Enabled"],
      ["Company Hoodie", "https://www.amazon.com/Some-Hoodie/dp/B07P5RTMQ6/ref=x", "$55.00", "Navy | Grey", "S, M, L", "no"],
    ]);
    expect(res.errors).toEqual([]);
    expect(res.rows[0]).toMatchObject({ name: "Company Hoodie", asin: "B07P5RTMQ6", unitCost: 55, option1Label: "Color", option1Values: ["Navy", "Grey"], option2Label: "Size", option2Values: ["S", "M", "L"], active: false });
  });
  it("reports missing names, bad costs, duplicates and a missing name column", () => {
    const res = mapItemRows([
      ["name", "sku", "unit_cost"],
      ["", "X1", "10"],
      ["Mug", "M1", "ten"],
      ["Mug again", "M1", "12"],
      ["Plain Mug", "", ""],
      ["plain mug", "", ""],
    ]);
    expect(res.rows.map((r) => r.name)).toEqual(["Mug", "Plain Mug"]);
    expect(res.skipped).toBe(3);
    expect(res.errors.join("\n")).toMatch(/missing name/);
    expect(res.errors.join("\n")).toMatch(/not a number/);
    expect(res.errors.join("\n")).toMatch(/duplicate/);
    expect(mapItemRows([["foo", "bar"], ["a", "b"]]).errors[0]).toMatch(/"name" column/);
  });
  it("reads multiple image links and per-colour photos", () => {
    const res = mapItemRows([
      ["name", "image_url", "color_images"],
      ["Tumbler", "https://x/1.jpg | https://x/2.jpg", "Teal=https://x/teal.jpg | Rose=https://x/rose.jpg | bad"],
    ]);
    expect(res.rows[0].imageUrls).toEqual(["https://x/1.jpg", "https://x/2.jpg"]);
    expect(res.rows[0].colorImages).toEqual([
      { value: "Teal", url: "https://x/teal.jpg" },
      { value: "Rose", url: "https://x/rose.jpg" },
    ]);
    expect(res.errors.join(" ")).toMatch(/color_images entry "bad"/);
  });
  it("uses option2 columns alone as group 1 and labels unnamed groups", () => {
    const res = mapItemRows([["name", "option2_values"], ["Thing", "A, B"]]);
    expect(res.rows[0]).toMatchObject({ option1Label: "Option", option1Values: ["A", "B"], option2Label: null, option2Values: [] });
  });
});

describe("parseItemFile", () => {
  it("round-trips the generated xlsx template", async () => {
    const buf = await buildTemplateWorkbook();
    const res = await parseItemFile(buf, "gift-template.xlsx");
    expect(res.errors).toEqual([]);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].asin).toBe("B0CHWRXH8B");
    expect(res.rows[0].imageUrls).toHaveLength(2);
  });
  it("reads csv", async () => {
    const csv = Papa.unparse(templateRows());
    const res = await parseItemFile(Buffer.from(`﻿${csv}`), "gifts.csv");
    expect(res.rows).toHaveLength(2);
  });
  it("rejects junk", async () => {
    const res = await parseItemFile(Buffer.from("not a workbook"), "gifts.xlsx");
    expect(res.errors[0]).toMatch(/Could not read/);
  });
  it("template columns have unique headers", () => {
    const headers = ITEM_IMPORT_COLUMNS.map((c) => c.header);
    expect(new Set(headers).size).toBe(headers.length);
  });
});
