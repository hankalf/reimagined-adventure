/**
 * Gift labels for Avery 5960 / 5160 sheets (1" × 2⅝", 3 across × 10 down, 30 per US Letter sheet).
 * Pure helpers: which picks get a label, in what order, and how each line is fitted to the label. Unit-tested.
 */

export const LABELS_PER_ROW = 3;
export const ROWS_PER_SHEET = 10;
export const LABELS_PER_SHEET = LABELS_PER_ROW * ROWS_PER_SHEET;

/** Usable text widths in points, after padding, the ribbon strip and the logo (with a safety margin). */
export const TO_WIDTH_WITH_LOGO_PT = 118;
export const TO_WIDTH_PT = 152;
export const LINE_WIDTH_PT = 152;

export const LABEL_STATUSES = {
  open: ["SELECTED", "ORDERED", "RECEIVED"],
  received: ["RECEIVED"],
  ordered: ["ORDERED", "RECEIVED"],
  all: ["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"],
} as const;
export type LabelStatusFilter = keyof typeof LABEL_STATUSES;
export type LabelSort = "dept" | "name" | "gift";

export const isLabelStatus = (v: unknown): v is LabelStatusFilter => typeof v === "string" && v in LABEL_STATUSES;
export const isLabelSort = (v: unknown): v is LabelSort => v === "dept" || v === "name" || v === "gift";

export type LabelSource = {
  firstName: string;
  lastName: string;
  department: string | null;
  status: string;
  itemName: string;
  option1Value: string | null;
  option2Value: string | null;
};

const cmp = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

/** The picks that get a label, in print order. */
export function labelRows(rows: LabelSource[], opts: { status?: LabelStatusFilter; sort?: LabelSort } = {}): LabelSource[] {
  const allowed: readonly string[] = LABEL_STATUSES[opts.status ?? "open"];
  const byName = (a: LabelSource, b: LabelSource) => cmp(a.lastName, b.lastName) || cmp(a.firstName, b.firstName);
  const sort = opts.sort ?? "dept";
  return rows
    .filter((r) => allowed.includes(r.status))
    .sort((a, b) => {
      if (sort === "gift") return cmp(a.itemName, b.itemName) || byName(a, b);
      if (sort === "dept") {
        const da = a.department?.trim() || "￿"; // no department last
        const db = b.department?.trim() || "￿";
        return cmp(da, db) || byName(a, b);
      }
      return byName(a, b);
    });
}

// ---- Text fitting (Arial metrics, in 1/1000 em) ----

function charWidth(ch: string): number {
  const c = ch.normalize("NFD")[0] ?? ch; // accents don't change the width much
  if (" fijlrtI.,;:!|'`".includes(c)) return c === "r" ? 333 : 278;
  if ("-()[]/".includes(c)) return 333;
  if (c === "m") return 833;
  if (c === "w") return 722;
  if (c === "W") return 944;
  if (c === "M") return 833;
  if (c === "…" || c === "—") return 1000;
  if (/[A-Z]/.test(c)) return 700;
  if (/[0-9]/.test(c)) return 556;
  return 556;
}

/** Rendered width of a line in points: a slightly generous Arial estimate (bold is ~7% wider). */
export function estimateWidthPt(text: string, sizePt: number, bold = false): number {
  let units = 0;
  for (const ch of text) units += charWidth(ch);
  return (units / 1000) * sizePt * (bold ? 1.07 : 1) * 1.03;
}

/** How many lines `text` wraps to at `widthPt` (Word breaks a word that is longer than a whole line). */
export function wrappedLines(text: string, widthPt: number, sizePt: number, bold = false): number {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = 1;
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (estimateWidthPt(next, sizePt, bold) <= widthPt) {
      line = next;
      continue;
    }
    if (line) lines += 1;
    // A word wider than a whole line is broken across lines.
    let rest = w;
    while (estimateWidthPt(rest, sizePt, bold) > widthPt) {
      let cut = rest.length;
      while (cut > 1 && estimateWidthPt(rest.slice(0, cut), sizePt, bold) > widthPt) cut -= 1;
      rest = rest.slice(cut);
      lines += 1;
    }
    line = rest;
  }
  return lines;
}

function cutToFit(text: string, fits: (t: string) => boolean): string {
  if (fits(text)) return text;
  const words = text.split(" ");
  // Drop whole words first, so names are shortened at a word boundary.
  for (let n = words.length - 1; n >= 1; n -= 1) {
    const candidate = `${words.slice(0, n).join(" ").replace(/[\s,.;:–-]+$/, "")}…`;
    if (fits(candidate)) return candidate;
  }
  for (let n = text.length - 1; n >= 1; n -= 1) {
    const candidate = `${text.slice(0, n).trimEnd()}…`;
    if (fits(candidate)) return candidate;
  }
  return "…";
}

/** One line: the largest size from `sizes` that fits, else the smallest size with the text shortened ("…"). */
export function fitLine(text: string, widthPt: number, sizes: number[], bold = false): { text: string; sizePt: number } {
  for (const size of sizes) if (estimateWidthPt(text, size, bold) <= widthPt) return { text, sizePt: size };
  const smallest = sizes[sizes.length - 1];
  return { text: cutToFit(text, (t) => estimateWidthPt(t, smallest, bold) <= widthPt), sizePt: smallest };
}

/** "From: …" on `maxLines` lines: the largest size that fits; the value is shortened only when the smallest can't. */
export function fitPrefixed(prefix: string, value: string, widthPt: number, sizes: number[], bold = false, maxLines = 1): { value: string; sizePt: number } {
  const fits = (v: string, size: number) => wrappedLines(`${prefix}${v}`, widthPt, size, bold) <= maxLines;
  for (const size of sizes) if (fits(value, size)) return { value, sizePt: size };
  const smallest = sizes[sizes.length - 1];
  return { value: cutToFit(value, (v) => fits(v, smallest)), sizePt: smallest };
}

/**
 * "To: Name": one line at 10–8.5 pt when it fits; otherwise two lines at 9–7 pt (beside the logo, which makes that
 * row two lines tall anyway), so long two-surname names are shown in full. Shortened only as a last resort.
 */
export function fitName(name: string, widthPt: number): { value: string; sizePt: number } {
  const oneLine = [10, 9.5, 9, 8.5];
  for (const size of oneLine) if (wrappedLines(`To: ${name}`, widthPt, size, true) <= 1) return { value: name, sizePt: size };
  return fitPrefixed("To: ", name, widthPt, [9, 8.5, 8, 7.5, 7], true, 2);
}

/**
 * "Company Hoodie – Navy, L": the gift with its chosen colour and size. Fits in `maxLines` lines; when it doesn't, only
 * the gift name is shortened (at a word boundary, with "…") so the colour and size are always shown.
 */
export function giftLine(name: string, options: Array<string | null | undefined>, widthPt = LINE_WIDTH_PT, sizePt = 8, maxLines = 2): string {
  const chosen = options.map((o) => o?.trim()).filter((o): o is string => Boolean(o));
  const suffix = chosen.length > 0 ? ` – ${chosen.join(", ")}` : "";
  const fits = (n: string) => wrappedLines(`${n}${suffix}`, widthPt, sizePt) <= maxLines;
  return `${cutToFit(name.trim(), fits)}${suffix}`;
}

/** Cells in print order: `null` for skipped positions on a partly used first sheet. */
export function placeOnSheets(count: number, startAt = 1): { cells: Array<number | null>; sheets: number } {
  const skip = Math.min(LABELS_PER_SHEET - 1, Math.max(0, Math.floor(startAt) - 1));
  const cells: Array<number | null> = [...Array.from({ length: skip }, () => null), ...Array.from({ length: count }, (_, i) => i)];
  while (cells.length % LABELS_PER_ROW !== 0) cells.push(null);
  return { cells, sheets: Math.max(1, Math.ceil(cells.length / LABELS_PER_SHEET)) };
}
