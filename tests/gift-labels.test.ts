import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import JSZip from "jszip";
import sharp from "sharp";
import { LINE_WIDTH_PT, fitName, fitPrefixed, giftLine, labelRows, placeOnSheets, wrappedLines, type LabelSource } from "@/lib/gift-labels";

vi.mock("server-only", () => ({}));
const { buildGiftLabelsDocx } = await import("@/lib/gift-labels-docx");

const row = (firstName: string, lastName: string, department: string | null, status: string, itemName = "Mug", o1: string | null = null, o2: string | null = null): LabelSource => ({
  firstName,
  lastName,
  department,
  status,
  itemName,
  option1Value: o1,
  option2Value: o2,
});

describe("which labels, in what order", () => {
  const rows = [
    row("Ana", "Zamora", "Shipping", "SELECTED"),
    row("Bo", "Adams", null, "RECEIVED"),
    row("Cy", "Adams", "Assembly", "ORDERED", "Hoodie"),
    row("Di", "Lee", "Assembly", "COLLECTED"),
    row("Ed", "Moe", "Assembly", "NEEDS_REPICK"),
  ];
  it("defaults to picks not yet collected, by department then name ('no department' last)", () => {
    expect(labelRows(rows).map((r) => r.firstName)).toEqual(["Cy", "Ana", "Bo"]);
  });
  it("filters by status and sorts by name or gift", () => {
    expect(labelRows(rows, { status: "received" }).map((r) => r.firstName)).toEqual(["Bo"]);
    expect(labelRows(rows, { status: "all", sort: "name" }).map((r) => r.firstName)).toEqual(["Bo", "Cy", "Di", "Ana"]);
    expect(labelRows(rows, { status: "all", sort: "gift" }).map((r) => r.firstName)).toEqual(["Cy", "Bo", "Di", "Ana"]);
  });
});

describe("fitting text on a 2⅝-inch label", () => {
  it("shows the colour and size after the gift", () => {
    expect(giftLine("Company Hoodie", ["Navy", "L"])).toBe("Company Hoodie – Navy, L");
    expect(giftLine("Insulated Travel Tumbler 40 oz", ["Teal", null])).toBe("Insulated Travel Tumbler 40 oz – Teal");
    expect(giftLine("4 hours of paid time off", [null, null])).toBe("4 hours of paid time off");
  });
  it("shortens only a long gift name, at a word boundary, keeping colour and size", () => {
    const long = "Ultra Premium Insulated Stainless Steel Vacuum Travel Tumbler with Leak Proof Lid and Handle Extra Large Edition";
    const line = giftLine(long, ["Heather Grey", "2XL"]);
    expect(line.endsWith("… – Heather Grey, 2XL")).toBe(true);
    expect(long.startsWith(line.split("…")[0])).toBe(true);
    expect(wrappedLines(line, LINE_WIDTH_PT, 8)).toBeLessThanOrEqual(2);
  });
  it("keeps long two-surname names whole: smaller, then on two lines beside the logo", () => {
    expect(fitName("Ana Ruiz", 118)).toEqual({ value: "Ana Ruiz", sizePt: 10 });
    const long = fitName("José Luis Hernández Martínez", 118);
    expect(long.value).toBe("José Luis Hernández Martínez");
    expect(long.sizePt).toBeLessThanOrEqual(9);
    expect(wrappedLines(`To: ${long.value}`, 118, long.sizePt, true)).toBe(2);
    const absurd = fitName("María Guadalupe de los Ángeles Fernández-Villaseñor y Rodríguez de la Concepción Montenegro", 118);
    expect(absurd.value.endsWith("…")).toBe(true);
    expect(wrappedLines(`To: ${absurd.value}`, 118, absurd.sizePt, true)).toBeLessThanOrEqual(2);
  });
  it("shortens a very long From text to one line", () => {
    const from = fitPrefixed("From: ", "The Entire Plant Leadership Team and Everyone in Human Resources at the North Campus", LINE_WIDTH_PT, [8.5, 8, 7.5, 7]);
    expect(from.value.endsWith("…")).toBe(true);
    expect(wrappedLines(`From: ${from.value}`, LINE_WIDTH_PT, from.sizePt)).toBe(1);
  });
  it("places labels on sheets of 30, optionally starting part-way down a used sheet", () => {
    expect(placeOnSheets(30).sheets).toBe(1);
    const p = placeOnSheets(35, 3);
    expect(p.cells.slice(0, 3)).toEqual([null, null, 0]);
    expect(p.cells.length).toBe(39);
    expect(p.sheets).toBe(2);
  });
});

describe("Word document", () => {
  const people = Array.from({ length: 35 }, (_, i) => row(`First${i}`, `Last${i}`, i % 2 ? "Ops" : "Finance", "SELECTED", i % 3 ? "Company Hoodie" : "Insulated Travel Tumbler 40 oz", "Navy", "L"));
  people[0] = row("José Luis", "Hernández Martínez", "Finance", "SELECTED", "Ultra Premium Insulated Stainless Steel Vacuum Travel Tumbler with Leak Proof Lid", "Heather Grey", "2XL");

  it("is laid out for Avery 5960: Letter page, 3/16\" sides, 0.5\" top, 2⅝\" × 1\" labels, ⅛\" gaps", async () => {
    const logo = await sharp({ create: { width: 400, height: 160, channels: 3, background: "#15803d" } }).png().toBuffer();
    const buf = await buildGiftLabelsDocx(people, { from: "The Plant Leadership Team", primaryColor: "#b91c1c", accentColor: "#15803d", logo, startAt: 3 });
    if (process.env.LABELS_OUT) fs.writeFileSync(process.env.LABELS_OUT, buf);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toMatch(/<w:pgSz w:w="12240" w:h="15840"/);
    expect(xml).toMatch(/w:top="720"/);
    expect(xml).toMatch(/w:left="270"/);
    expect(xml).toMatch(/w:right="270"/);
    expect(xml).toContain('<w:gridCol w:w="3780"/><w:gridCol w:w="180"/><w:gridCol w:w="3780"/><w:gridCol w:w="180"/><w:gridCol w:w="3780"/>');
    expect((xml.match(/<w:trHeight w:val="1440" w:hRule="exact"\/>/g) ?? []).length).toBe(13); // 2 skipped + 35 labels = 13 rows
    expect((xml.match(/>To: </g) ?? []).length).toBe(35);
    expect(xml).toContain("The Plant Leadership Team");
    expect(xml).toContain("José Luis");
    expect(xml).toContain("Company Hoodie – Navy, L");
    expect(xml).toMatch(/… – Heather Grey, 2XL/);
    expect(Object.keys(zip.files).filter((f) => f.startsWith("word/media/")).length).toBeGreaterThanOrEqual(2); // ribbon + logo
  });

  it("works without a logo and says so when nothing matches", async () => {
    const noLogo = await JSZip.loadAsync(await buildGiftLabelsDocx(people.slice(0, 3), { from: "HR", primaryColor: "#1e3a8a", accentColor: "#7dd3fc", logo: null }));
    expect((await noLogo.file("word/document.xml")!.async("string")).match(/>To: </g)?.length).toBe(3);
    const empty = await JSZip.loadAsync(await buildGiftLabelsDocx([], { from: "HR", primaryColor: "#1e3a8a", accentColor: "#7dd3fc", logo: null }));
    expect(await empty.file("word/document.xml")!.async("string")).toContain("No picks match");
  });
});
