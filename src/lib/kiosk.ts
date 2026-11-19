/** Pure helpers for the pickup kiosk: turn whatever a scanner or person typed into a lookup key. */

const CODE_RE = /^[A-Z0-9]{6,8}$/;

export type ScanPayload = { code: string | null; text: string };

/**
 * Accepts a raw confirmation code, a "GIFT:CODE" payload, or a URL that ends with the code or carries
 * `?code=`. Returns the normalised code when it looks like one of ours, plus the cleaned text for a fallback
 * employee-number / name lookup.
 */
export function parseScanPayload(raw: string): ScanPayload {
  let text = (raw ?? "").trim();
  if (!text) return { code: null, text: "" };

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const param = url.searchParams.get("code") ?? url.searchParams.get("c");
      const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
      text = param ?? last;
    } catch {
      // keep text as-is
    }
  }
  text = text.replace(/^(gift|gp|code)\s*[:=]\s*/i, "").trim();
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return { code: CODE_RE.test(compact) ? compact : null, text };
}

export function looksLikeConfirmationCode(value: string): boolean {
  return CODE_RE.test(value.trim().toUpperCase());
}
