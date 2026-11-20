/** Pure business rules for identifying employees and deciding gift availability. No database access here. */

import { normalizeEmployeeNumber } from "./csv";
import { closesAtInstant, opensAtInstant } from "./time-zone";

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

const NAME_PARTICLES = new Set(["de", "la", "del", "las", "los", "da", "das", "do", "dos", "di", "van", "von", "der", "den", "le", "el", "y", "e", "al", "bin", "ibn", "mc", "mac", "st"]);

/** Name parts that identify a person: at least 2 letters and not a particle like "de" or "la". */
function significantParts(normalized: string): string[] {
  return normalized.split(" ").filter((p) => p.length >= 2 && !NAME_PARTICLES.has(p));
}

/**
 * Does what the employee typed match the last name on file? Built for people with two surnames:
 *   on file "Hernández López" → "Hernandez", "López", "Hernández López", "Lopez-Hernandez" all match;
 *   on file "García" → "García López" also matches (the list only has the first surname);
 *   "Luis Hernández López" matches too when the first name is supplied (first-name words are ignored).
 * Case, accents, hyphens and particles ("de la") don't matter. A wrong surname never matches.
 */
export function lastNameMatches(input: string, stored: string, firstName?: string | null): boolean {
  const a = normalizeName(input);
  const b = normalizeName(stored);
  if (!a || !b) return false;
  if (a === b) return true;

  const storedParts = significantParts(b);
  let typedParts = significantParts(a);
  if (firstName) {
    const firstParts = new Set(significantParts(normalizeName(firstName)));
    const withoutFirst = typedParts.filter((p) => !firstParts.has(p) || storedParts.includes(p));
    if (withoutFirst.length > 0) typedParts = withoutFirst;
  }
  if (typedParts.length === 0 || storedParts.length === 0) return false;

  // Everything typed is part of the surname on file (one surname, both, any order).
  if (typedParts.every((p) => storedParts.includes(p))) return true;
  // Everything on file was typed (file has one surname, employee typed both).
  if (storedParts.every((p) => typedParts.includes(p))) return true;
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

/**
 * A campaign accepts picks when it is OPEN and the current time is inside its optional window: from the start of
 * the open date until 11:59 PM on the close date, Eastern Time.
 */
export function campaignAcceptsPicks(c: CampaignWindow, now = new Date()): { ok: boolean; reason?: "draft" | "closed" | "not_yet_open" | "expired" } {
  if (c.status === "DRAFT") return { ok: false, reason: "draft" };
  if (c.status === "CLOSED") return { ok: false, reason: "closed" };
  const opens = opensAtInstant(c);
  const closes = closesAtInstant(c);
  if (opens && now < opens) return { ok: false, reason: "not_yet_open" };
  if (closes && now > closes) return { ok: false, reason: "expired" };
  return { ok: true };
}

export type ChangePolicy = { allowChangeUntilOrdered: boolean; changeWindowHours: number | null };
export const MAX_CHANGE_WINDOW_HOURS = 24 * 90;

/** When the employee's chance to change their gift ends, or null when only HR ordering ends it. */
export function changeDeadline(firstSelectedAt: Date, changeWindowHours: number | null | undefined): Date | null {
  if (changeWindowHours == null || !Number.isFinite(changeWindowHours) || changeWindowHours <= 0) return null;
  return new Date(firstSelectedAt.getTime() + changeWindowHours * 3_600_000);
}

export type ChangeState =
  | { ok: true; deadline: Date | null }
  | { ok: false; reason: "final" | "ordered" | "window_closed"; deadline: Date | null };

/**
 * Whether the employee may still change their pick:
 * - a forced re-pick (gift out of stock, colour removed) is always allowed;
 * - otherwise only while the pick is not yet ordered, the campaign allows changes, and the change window
 *   (N hours after the first pick) has not passed.
 */
export function changeState(
  selection: { status: string; firstSelectedAt: Date },
  policy: ChangePolicy,
  now: Date = new Date(),
): ChangeState {
  const deadline = policy.allowChangeUntilOrdered ? changeDeadline(selection.firstSelectedAt, policy.changeWindowHours) : null;
  if (selection.status === "NEEDS_REPICK") return { ok: true, deadline: null };
  if (selection.status !== "SELECTED") return { ok: false, reason: "ordered", deadline };
  if (!policy.allowChangeUntilOrdered) return { ok: false, reason: "final", deadline };
  if (deadline && now >= deadline) return { ok: false, reason: "window_closed", deadline };
  return { ok: true, deadline };
}

export function canChangeSelection(selection: { status: string; firstSelectedAt: Date }, policy: ChangePolicy, now: Date = new Date()): boolean {
  return changeState(selection, policy, now).ok;
}

/** Whole days from now until `date` (server-side helper so pages don't call Date.now() during render). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}
