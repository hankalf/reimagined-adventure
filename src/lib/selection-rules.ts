/** Pure business rules for identifying employees and deciding gift availability. No database access here. */

import { normalizeEmployeeNumber } from "./csv";

export { normalizeEmployeeNumber };

/** Lower-case, strip accents, punctuation and extra spaces: "García-López" -> "garcia lopez". */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does the typed last name match the stored one? Accepts the whole name, or any single part of a
 * multi-part surname ("de la Cruz" matches "cruz", "Smith-Jones" matches "jones").
 */
const NAME_PARTICLES = new Set(["de", "la", "del", "las", "los", "da", "das", "do", "dos", "di", "van", "von", "der", "den", "le", "el", "y", "e", "al", "bin", "ibn", "mc", "mac", "st"]);

export function lastNameMatches(input: string, stored: string): boolean {
  const a = normalizeName(input);
  const b = normalizeName(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const significant = (parts: string[]) => parts.filter((p) => p.length > 2 && !NAME_PARTICLES.has(p));
  const storedParts = significant(b.split(" "));
  const inputParts = significant(a.split(" "));
  if (inputParts.length === 0) return false;
  if (inputParts.length === 1 && storedParts.includes(inputParts[0])) return true;
  if (inputParts.length > 1 && inputParts.every((p) => storedParts.includes(p))) return true;
  return false;
}

/** Candidate employee numbers to look up: as typed, and with leading zeros stripped/added for numeric IDs. */
export function employeeNumberCandidates(input: string): string[] {
  const base = normalizeEmployeeNumber(input);
  const out = new Set<string>();
  if (base) out.add(base);
  if (/^\d+$/.test(base)) {
    const stripped = base.replace(/^0+/, "");
    if (stripped) out.add(stripped);
  }
  return [...out];
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateConfirmationCode(length = 6, random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export type AvailabilityInput = {
  status: "AVAILABLE" | "OUT_OF_STOCK";
  stockLimit: number | null;
  taken: number; // committed selections for this item in the campaign
  itemActive: boolean;
};

export type Availability = { available: boolean; soldOut: boolean; remaining: number | null; reason?: string };

export function itemAvailability(input: AvailabilityInput): Availability {
  if (!input.itemActive) return { available: false, soldOut: true, remaining: 0, reason: "inactive" };
  if (input.status === "OUT_OF_STOCK") return { available: false, soldOut: true, remaining: 0, reason: "out_of_stock" };
  if (input.stockLimit !== null && input.stockLimit !== undefined) {
    const remaining = Math.max(0, input.stockLimit - input.taken);
    return { available: remaining > 0, soldOut: remaining <= 0, remaining, reason: remaining <= 0 ? "limit_reached" : undefined };
  }
  return { available: true, soldOut: false, remaining: null };
}

export type CampaignWindow = { status: "DRAFT" | "OPEN" | "CLOSED"; opensAt: Date | null; closesAt: Date | null };

/** A campaign accepts picks when it is OPEN and the current time is inside its optional window. */
export function campaignAcceptsPicks(c: CampaignWindow, now = new Date()): { ok: boolean; reason?: "draft" | "closed" | "not_yet_open" | "expired" } {
  if (c.status === "DRAFT") return { ok: false, reason: "draft" };
  if (c.status === "CLOSED") return { ok: false, reason: "closed" };
  if (c.opensAt && now < c.opensAt) return { ok: false, reason: "not_yet_open" };
  if (c.closesAt && now > c.closesAt) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Which selection statuses still allow the employee to change their mind (when the campaign permits it). */
export function canChangeSelection(status: string, allowChangeUntilOrdered: boolean): boolean {
  if (status === "NEEDS_REPICK") return true;
  return allowChangeUntilOrdered && status === "SELECTED";
}

/** Whole days from now until `date` (server-side helper so pages don't call Date.now() during render). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}
