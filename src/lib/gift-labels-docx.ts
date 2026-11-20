import "server-only";
import { AlignmentType, BorderStyle, Document, HeightRule, ImageRun, Packer, Paragraph, Table, TableBorders, TableCell, TableLayoutType, TableRow, TextRun, VerticalAlign, WidthType } from "docx";
import sharp from "sharp";
import { qrInk } from "./theme";
import {
  LABELS_PER_ROW,
  LINE_WIDTH_PT,
  TO_WIDTH_PT,
  TO_WIDTH_WITH_LOGO_PT,
  fitName,
  fitPrefixed,
  giftLine,
  placeOnSheets,
  type LabelSource,
} from "./gift-labels";

/**
 * Avery 5960 / 5160 geometry in twips (1/1440 in): Letter page, 0.5" top margin, 3/16" side margins,
 * 2⅝" × 1" labels in 3 columns with a ⅛" gap, no gap between rows.
 */
const PAGE_W = 12240;
const PAGE_H = 15840;
const MARGIN_TOP = 720;
const MARGIN_SIDE = 270;
const MARGIN_BOTTOM = 648; // a hair under 0.5" so a full last sheet never spills an empty paragraph onto a blank page
const LABEL_W = 3780;
const GAP_W = 180;
const ROW_H = 1440;
const LABEL_PAD = 86; // 0.06"

// Inside a label: ribbon strip | text | logo.
const INNER_W = LABEL_W - 2 * LABEL_PAD;
const RIBBON_W = 144; // 0.1"
const LOGO_W = 720; // 0.5"
const TEXT_W = INNER_W - RIBBON_W - LOGO_W;

const FONT = "Arial";
const INK = "334155";
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE };

export type LabelOptions = {
  from: string;
  primaryColor: string;
  accentColor: string;
  logo: Buffer | null;
  startAt?: number;
};

/** A candy-stripe ribbon in the campaign's two colours (festive, and on-brand). */
async function ribbonPng(primary: string, accent: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="344" viewBox="0 0 40 344">
    <defs><pattern id="s" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="22" height="22" fill="${primary}"/><rect x="0" width="8" height="22" fill="${accent}"/><rect x="8" width="2" height="22" fill="#ffffff"/>
    </pattern></defs>
    <rect width="40" height="344" rx="12" fill="url(#s)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The campaign logo as a PNG that fits a 0.5" × 0.3" corner box, or null if it can't be read. */
async function logoPng(logo: Buffer | null): Promise<{ data: Buffer; width: number; height: number } | null> {
  if (!logo) return null;
  try {
    const data = await sharp(logo).resize(300, 180, { fit: "inside", withoutEnlargement: false }).png().toBuffer();
    const meta = await sharp(data).metadata();
    const ratio = (meta.width ?? 1) / (meta.height ?? 1);
    // Pixels at 96/in: box 48 × 28.8.
    let width = 48;
    let height = width / ratio;
    if (height > 28.8) {
      height = 28.8;
      width = height * ratio;
    }
    return { data, width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}

const tiny = () => new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: "exact" }, children: [new TextRun({ text: "", size: 2, font: FONT })] });

function textCell(children: TextRun[], opts: { columnSpan?: number; width: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new TableCell({
    columnSpan: opts.columnSpan,
    width: { size: opts.width, type: WidthType.DXA },
    borders: NO_BORDERS,
    margins: { top: 0, bottom: 0, left: 72, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: opts.align, spacing: { before: 0, after: 10 }, children })],
  });
}

function labelCell(source: LabelSource, o: LabelOptions & { ribbon: Buffer; logoImg: Awaited<ReturnType<typeof logoPng>> }): TableCell {
  const primary = qrInk(o.primaryColor).slice(1);
  const accent = qrInk(o.accentColor).slice(1);
  const name = `${source.firstName} ${source.lastName}`.replace(/\s+/g, " ").trim();
  const to = fitName(name, o.logoImg ? TO_WIDTH_WITH_LOGO_PT : TO_WIDTH_PT);
  const from = fitPrefixed("From: ", o.from, LINE_WIDTH_PT, [8.5, 8, 7.5, 7], false);
  const gift = giftLine(source.itemName, [source.option1Value, source.option2Value], LINE_WIDTH_PT, 8, 2);

  const run = (text: string, sizePt: number, color: string, bold = false) => new TextRun({ text, size: Math.round(sizePt * 2), color, bold, font: FONT });

  const ribbonCell = new TableCell({
    rowSpan: 3,
    width: { size: RIBBON_W, type: WidthType.DXA },
    borders: NO_BORDERS,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: "png", data: o.ribbon, transformation: { width: 9, height: 78 }, altText: { name: "ribbon", description: "Festive ribbon", title: "ribbon" } })] })],
  });
  const toRuns = [run("To: ", to.sizePt, primary, true), run(to.value, to.sizePt, primary, true)];
  const firstRow = o.logoImg
    ? [
        ribbonCell,
        textCell(toRuns, { width: TEXT_W }),
        new TableCell({
          width: { size: LOGO_W, type: WidthType.DXA },
          borders: NO_BORDERS,
          margins: { top: 0, bottom: 0, left: 29, right: 0 },
          verticalAlign: VerticalAlign.TOP,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
              children: [new ImageRun({ type: "png", data: o.logoImg.data, transformation: { width: o.logoImg.width, height: o.logoImg.height }, altText: { name: "logo", description: "Company logo", title: "logo" } })],
            }),
          ],
        }),
      ]
    : [ribbonCell, textCell(toRuns, { width: TEXT_W + LOGO_W, columnSpan: 2 })];

  const inner = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: INNER_W, type: WidthType.DXA },
    columnWidths: [RIBBON_W, TEXT_W, LOGO_W],
    borders: TableBorders.NONE,
    rows: [
      new TableRow({ children: firstRow }),
      new TableRow({ children: [textCell([run("From: ", from.sizePt, accent, true), run(from.value, from.sizePt, accent)], { width: TEXT_W + LOGO_W, columnSpan: 2 })] }),
      new TableRow({ children: [textCell([run(gift, 8, INK)], { width: TEXT_W + LOGO_W, columnSpan: 2 })] }),
    ],
  });

  return new TableCell({
    width: { size: LABEL_W, type: WidthType.DXA },
    borders: NO_BORDERS,
    margins: { top: 0, bottom: 0, left: LABEL_PAD, right: LABEL_PAD },
    verticalAlign: VerticalAlign.CENTER,
    children: [inner, tiny()],
  });
}

const emptyCell = (width: number) =>
  new TableCell({ width: { size: width, type: WidthType.DXA }, borders: NO_BORDERS, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [tiny()] });

/** A Word document of gift labels laid out for Avery 5960 / 5160 sheets. */
export async function buildGiftLabelsDocx(labels: LabelSource[], opts: LabelOptions): Promise<Buffer> {
  const [ribbon, logoImg] = await Promise.all([ribbonPng(opts.primaryColor, opts.accentColor), logoPng(opts.logo)]);
  const page = { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN_TOP, bottom: MARGIN_BOTTOM, left: MARGIN_SIDE, right: MARGIN_SIDE, header: 0, footer: 0, gutter: 0 } };

  if (labels.length === 0) {
    return Packer.toBuffer(
      new Document({
        creator: "Employee Gift Portal",
        title: "Gift labels",
        sections: [{ properties: { page }, children: [new Paragraph({ children: [new TextRun({ text: "No picks match this selection, so there are no labels to print.", font: FONT, size: 22 })] })] }],
      }),
    );
  }

  const { cells } = placeOnSheets(labels.length, opts.startAt ?? 1);
  const rows: TableRow[] = [];
  for (let r = 0; r < cells.length / LABELS_PER_ROW; r += 1) {
    const children: TableCell[] = [];
    for (let c = 0; c < LABELS_PER_ROW; c += 1) {
      if (c > 0) children.push(emptyCell(GAP_W));
      const index = cells[r * LABELS_PER_ROW + c];
      children.push(index === null || index === undefined ? emptyCell(LABEL_W) : labelCell(labels[index], { ...opts, ribbon, logoImg }));
    }
    rows.push(new TableRow({ height: { value: ROW_H, rule: HeightRule.EXACT }, cantSplit: true, children }));
  }

  const grid = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 3 * LABEL_W + 2 * GAP_W, type: WidthType.DXA },
    columnWidths: [LABEL_W, GAP_W, LABEL_W, GAP_W, LABEL_W],
    borders: TableBorders.NONE,
    rows,
  });

  const doc = new Document({
    creator: "Employee Gift Portal",
    title: "Gift labels (Avery 5960)",
    sections: [{ properties: { page }, children: [grid, tiny()] }],
  });
  return Packer.toBuffer(doc);
}
