import "server-only";

export type ProcessedImage = {
  mime: string;
  data: Uint8Array<ArrayBuffer>;
  thumb: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
};

/** Prisma's Bytes fields want a Uint8Array backed by a plain ArrayBuffer, not a Node Buffer. */
export function toBytes(buf: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(buf);
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

/**
 * Resize an uploaded image to a web-friendly full size (max 1200px) and a 480px thumbnail.
 * Uses sharp when available; falls back to storing the original bytes for both if sharp fails to load.
 */
export async function processImage(input: Buffer, mime: string): Promise<ProcessedImage> {
  if (!ALLOWED.has(mime)) throw new Error("Unsupported image type. Please upload a JPG, PNG, WebP, GIF or AVIF file.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new Error("Image is too large. Maximum size is 8 MB.");
  try {
    const sharp = (await import("sharp")).default;
    const base = sharp(input, { animated: false }).rotate();
    const meta = await base.metadata();
    const full = await base
      .clone()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await base
      .clone()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return {
      mime: "image/webp",
      data: toBytes(full.data),
      thumb: toBytes(thumb),
      width: full.info.width ?? meta.width ?? 0,
      height: full.info.height ?? meta.height ?? 0,
    };
  } catch (err) {
    if (err instanceof Error && /Unsupported|too large/.test(err.message)) throw err;
    console.warn("[images] sharp unavailable or failed, storing original bytes:", err instanceof Error ? err.message : err);
    return { mime, data: toBytes(input), thumb: toBytes(input), width: 0, height: 0 };
  }
}

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED.has(mime);
}

/** Download an image from a URL (10 s timeout, size-capped). Returns null on any failure. */
export async function downloadImage(url: string, timeoutMs = 10_000): Promise<{ buffer: Buffer; mime: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; GiftPortal/1.0)", accept: "image/*" } });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!mime.startsWith("image/")) return null;
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) return null;
    return { buffer, mime: mime === "image/jpg" ? "image/jpeg" : mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
