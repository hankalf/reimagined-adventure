import { en, type Dictionary } from "./en";
import { es } from "./es";

export type Lang = "en" | "es";
export const LANGS: readonly Lang[] = ["en", "es"] as const;
export const LANG_COOKIE = "gp_lang";

const dictionaries: Record<Lang, Dictionary> = { en, es };

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es";
}

/** Resolve the employee UI language from an explicit choice, a cookie, or the browser's Accept-Language header. */
export function pickLang(
  explicit?: string | null,
  cookieValue?: string | null,
  acceptLanguage?: string | null,
): Lang {
  if (isLang(explicit)) return explicit;
  if (isLang(cookieValue)) return cookieValue;
  if (acceptLanguage) {
    const first = acceptLanguage
      .split(",")
      .map((part) => part.trim().split(";")[0]?.toLowerCase() ?? "")
      .find((tag) => tag.length > 0);
    if (first?.startsWith("es")) return "es";
  }
  return "en";
}

export function dict(lang: Lang): Dictionary {
  return dictionaries[lang] ?? en;
}

/** Fill `{placeholders}` in a translated string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] === undefined ? `{${key}}` : String(values[key]),
  );
}

/** Choose the Spanish variant of campaign/item content when the language is Spanish and a translation exists. */
export function localized(lang: Lang, english: string, spanish?: string | null): string {
  if (lang === "es" && spanish && spanish.trim().length > 0) return spanish;
  return english;
}

export function formatMoney(amount: number | null | undefined, currency = "USD", lang: Lang = "en"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "";
  try {
    return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** "Dec 1, 3:45 PM" / "1 dic, 3:45 p.m." in the given time zone (the device's own when omitted). */
export function formatDateTime(date: Date | string, lang: Lang | string = "en", timeZone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(d);
}

export function formatDate(date: Date | string | null | undefined, lang: Lang = "en"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === "es" ? "es-US" : "en-US", {
    dateStyle: "long",
  }).format(d);
}
