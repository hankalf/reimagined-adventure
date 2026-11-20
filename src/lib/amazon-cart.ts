/**
 * One-click Amazon cart: turns the "to order" list into Amazon add-to-cart links
 * (https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=…&Quantity.1=…). Pure, so it is unit-tested.
 */
import { extractAsin, isAmazonUrl } from "./amazon";

/** Items per link. Amazon's add-to-cart form handles small batches reliably; larger orders get several links. */
export const CART_CHUNK = 20;

export type CartLineInput = {
  /** Catalog item id; returned in `itemIds` when the line goes into the cart. */
  itemId?: string;
  name: string;
  asin: string | null;
  productUrl: string | null;
  quantity: number;
  optionText?: string;
};

export type CartLink = { host: string; url: string; part: number; parts: number; lines: Array<{ asin: string; name: string; quantity: number }>; units: number };

export type AmazonCartPlan = {
  links: CartLink[];
  /** Items with colours/sizes: the cart gets the ASIN on file, so HR should double-check the variant. */
  checkVariants: Array<{ name: string; asin: string; options: string[] }>;
  /** To-order items that are not Amazon products (no ASIN): order these another way. */
  notOnAmazon: Array<{ name: string; quantity: number }>;
  totalUnits: number;
  /** Item ids of every line that went into a cart link. */
  itemIds: string[];
};

/** The ASIN on file, or one read from an Amazon product link when the ASIN field was left blank. */
export function cartAsin(asin: string | null | undefined, productUrl: string | null | undefined): string | null {
  if (asin && /^[A-Z0-9]{10}$/i.test(asin.trim())) return asin.trim().toUpperCase();
  if (productUrl && isAmazonUrl(productUrl)) return extractAsin(productUrl);
  return null;
}

/** "www.amazon.co.uk" from a product link; amazon.com when unknown. */
export function amazonHost(productUrl: string | null | undefined): string {
  if (!productUrl) return "www.amazon.com";
  try {
    const h = new URL(productUrl).hostname.toLowerCase();
    const i = h.indexOf("amazon.");
    if (i === -1) return "www.amazon.com";
    return `www.${h.slice(i)}`;
  } catch {
    return "www.amazon.com";
  }
}

export function cartUrl(host: string, lines: Array<{ asin: string; quantity: number }>): string {
  const params = new URLSearchParams();
  lines.forEach((l, i) => {
    params.set(`ASIN.${i + 1}`, l.asin);
    params.set(`Quantity.${i + 1}`, String(l.quantity));
  });
  return `https://${host}/gp/aws/cart/add.html?${params.toString()}`;
}

export function planAmazonCart(input: CartLineInput[], chunk = CART_CHUNK): AmazonCartPlan {
  const byHost = new Map<string, Map<string, { asin: string; name: string; quantity: number }>>();
  const variants = new Map<string, { name: string; asin: string; options: string[] }>();
  const notOnAmazon = new Map<string, number>();
  const itemIds = new Set<string>();
  let totalUnits = 0;

  for (const line of input) {
    if (line.quantity <= 0) continue;
    const asin = cartAsin(line.asin, line.productUrl);
    if (!asin) {
      notOnAmazon.set(line.name, (notOnAmazon.get(line.name) ?? 0) + line.quantity);
      continue;
    }
    const host = amazonHost(line.productUrl);
    const lines = byHost.get(host) ?? new Map();
    const existing = lines.get(asin) ?? { asin, name: line.name, quantity: 0 };
    existing.quantity += line.quantity;
    lines.set(asin, existing);
    byHost.set(host, lines);
    totalUnits += line.quantity;
    if (line.itemId) itemIds.add(line.itemId);
    if (line.optionText) {
      const v = variants.get(asin) ?? { name: line.name, asin, options: [] };
      v.options.push(`${line.optionText} × ${line.quantity}`);
      variants.set(asin, v);
    }
  }

  const links: CartLink[] = [];
  for (const [host, lineMap] of byHost) {
    const all = [...lineMap.values()];
    const parts = Math.max(1, Math.ceil(all.length / chunk));
    for (let p = 0; p < parts; p += 1) {
      const slice = all.slice(p * chunk, (p + 1) * chunk);
      links.push({ host, url: cartUrl(host, slice), part: p + 1, parts, lines: slice, units: slice.reduce((a, l) => a + l.quantity, 0) });
    }
  }
  return {
    links,
    checkVariants: [...variants.values()],
    notOnAmazon: [...notOnAmazon.entries()].map(([name, quantity]) => ({ name, quantity })),
    totalUnits,
    itemIds: [...itemIds],
  };
}
