/**
 * Amazon helpers: pull an ASIN out of any Amazon URL shape, build a canonical link, and make a
 * best-effort attempt to read Open Graph metadata so the admin form can be prefilled.
 * Amazon frequently blocks automated requests, so metadata fetching is optional and never required.
 */

const ASIN_RE = /\b([A-Z0-9]{10})\b/;

const PATH_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/gp\/aw\/d\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/product\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/o\/ASIN\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/ASIN\/([A-Z0-9]{10})(?:[/?]|$)/i,
  /\/d\/([A-Z0-9]{10})(?:[/?]|$)/i,
];

export function isAmazonUrl(input: string): boolean {
  try {
    const host = new URL(input.trim()).hostname.toLowerCase();
    return /(^|\.)amazon\.[a-z.]+$/.test(host) || host === "amzn.to" || host === "a.co" || host.endsWith(".amzn.com");
  } catch {
    return false;
  }
}

/** Extract a 10-character ASIN from an Amazon URL, or from a bare ASIN string. Returns upper-case. */
export function extractAsin(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare ASIN typed directly.
  if (/^[A-Z0-9]{10}$/i.test(raw)) return raw.toUpperCase();

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  for (const pattern of PATH_PATTERNS) {
    const match = url.pathname.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  const asinParam = url.searchParams.get("asin") ?? url.searchParams.get("ASIN");
  if (asinParam && /^[A-Z0-9]{10}$/i.test(asinParam)) return asinParam.toUpperCase();

  // Last resort: a standalone 10-char token that looks like an ASIN (starts with B or is all digits).
  for (const segment of url.pathname.split("/")) {
    const m = segment.match(ASIN_RE);
    if (m && (/^B[0-9A-Z]{9}$/.test(m[1]) || /^\d{10}$/.test(m[1]))) return m[1];
  }
  return null;
}

/** Keep the regional marketplace (amazon.ca, amazon.co.uk, ...) when known, otherwise default to amazon.com. */
export function canonicalAmazonUrl(asin: string, originalUrl?: string | null): string {
  let host = "www.amazon.com";
  if (originalUrl) {
    try {
      const h = new URL(originalUrl).hostname.toLowerCase();
      if (/(^|\.)amazon\.[a-z.]+$/.test(h)) host = `www.${h.slice(h.indexOf("amazon."))}`;
    } catch {
      // ignore
    }
  }
  return `https://${host}/dp/${asin.toUpperCase()}`;
}

export type ProductMetadata = {
  title?: string;
  imageUrl?: string;
  price?: number;
  description?: string;
  source: "opengraph" | "none";
};

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaContent(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1].trim());
  }
  return undefined;
}

export function parseProductMetadata(html: string): ProductMetadata {
  const title =
    metaContent(html, ["og:title", "twitter:title"]) ??
    html.match(/<span[^>]+id=["']productTitle["'][^>]*>([^<]+)</i)?.[1]?.trim() ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const imageUrl =
    metaContent(html, ["og:image", "twitter:image"]) ??
    html.match(/"hiRes":"(https:[^"]+)"/)?.[1] ??
    html.match(/<img[^>]+id=["']landingImage["'][^>]*src=["']([^"']+)["']/i)?.[1];
  const priceText =
    metaContent(html, ["product:price:amount", "og:price:amount", "twitter:data1"]) ??
    html.match(/class=["']a-offscreen["'][^>]*>\s*\$?([0-9][0-9,]*\.?[0-9]*)\s*</i)?.[1];
  const description = metaContent(html, ["og:description", "description"]);
  const price = priceText ? Number(priceText.replace(/[^0-9.]/g, "")) : undefined;

  const cleanedTitle = title ? decodeEntities(title).replace(/\s*[:|-]\s*Amazon\.[a-z.]+.*$/i, "").trim() : undefined;
  const hasAny = Boolean(cleanedTitle || imageUrl || (price !== undefined && !Number.isNaN(price)));
  return {
    title: cleanedTitle || undefined,
    imageUrl,
    price: price !== undefined && !Number.isNaN(price) && price > 0 ? price : undefined,
    description: description ? description.slice(0, 1000) : undefined,
    source: hasAny ? "opengraph" : "none",
  };
}

/** Best-effort metadata fetch with a short timeout. Never throws. */
export async function fetchProductMetadata(url: string, timeoutMs = 7000): Promise<ProductMetadata> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return { source: "none" };
    const html = (await res.text()).slice(0, 2_000_000);
    return parseProductMetadata(html);
  } catch {
    return { source: "none" };
  } finally {
    clearTimeout(timer);
  }
}
