import { APP_TIME_ZONE } from "./time-zone";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "campaign";
}

/** Convert Prisma Decimal / string / number to a plain number (or null). Safe to pass to client components. */
export function dec(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

export function money(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** A moment in Eastern Time: "Nov 20, 2026" or "Nov 20, 2026, 4:34 PM EST". (Campaign open/close dates: formatCalendarDate.) */
export function fmtDate(value: Date | string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(
    "en-US",
    withTime ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE, timeZoneName: "short" } : { dateStyle: "medium", timeZone: APP_TIME_ZONE },
  ).format(d);
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function appUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function parseEmails(raw: string): string[] {
  return [...new Set(raw.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))];
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export const SELECTION_STATUS_LABEL: Record<string, string> = {
  SELECTED: "Selected",
  NEEDS_REPICK: "Needs re-pick",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  COLLECTED: "Collected",
};

export const SELECTION_STATUS_ORDER = ["SELECTED", "NEEDS_REPICK", "ORDERED", "RECEIVED", "COLLECTED"] as const;
