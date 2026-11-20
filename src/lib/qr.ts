import QRCode from "qrcode";
import sharp from "sharp";
import { qrInk } from "./theme";

/** Campaign branding for the QR code: module colour and an optional logo in the middle. */
export type QrBrand = { color?: string | null; logo?: Buffer | null };

const MARGIN = 2;
/** Logo plate width as a share of the whole image. Error correction H recovers ~30% of the code. */
const PLATE_SHARE = 0.22;

function qrOptions(brand?: QrBrand) {
  return {
    margin: MARGIN,
    errorCorrectionLevel: brand?.logo ? ("H" as const) : ("M" as const),
    color: { dark: `${qrInk(brand?.color ?? "#000000")}ff`, light: "#ffffffff" },
  };
}

/** The logo on a white rounded plate, as a PNG of `px` × `px`. */
async function logoPlate(logo: Buffer, px: number): Promise<Buffer> {
  const pad = Math.round(px * 0.12);
  const inner = Math.max(1, px - pad * 2);
  const logoPng = await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  const radius = Math.round(px * 0.18);
  const plate = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><rect width="${px}" height="${px}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`);
  return sharp(plate).composite([{ input: logoPng, gravity: "center" }]).png().toBuffer();
}

export async function qrPng(text: string, size = 512, brand?: QrBrand): Promise<Buffer> {
  const png = await QRCode.toBuffer(text, { type: "png", width: size, ...qrOptions(brand) });
  if (!brand?.logo) return png;
  try {
    const { width = size, height = size } = await sharp(png).metadata();
    const px = Math.round(Math.min(width, height) * PLATE_SHARE);
    const plate = await logoPlate(brand.logo, px);
    return await sharp(png)
      .composite([{ input: plate, left: Math.round((width - px) / 2), top: Math.round((height - px) / 2) }])
      .png()
      .toBuffer();
  } catch {
    // An unreadable logo should never break the QR code itself.
    return QRCode.toBuffer(text, { type: "png", width: size, ...qrOptions({ color: brand.color }) });
  }
}

export async function qrSvg(text: string, brand?: QrBrand): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", ...qrOptions(brand) });
  if (!brand?.logo) return svg;
  try {
    const modules = QRCode.create(text, { errorCorrectionLevel: "H" }).modules.size;
    const total = modules + MARGIN * 2;
    const plate = total * PLATE_SHARE;
    const pad = plate * 0.12;
    const at = (total - plate) / 2;
    const logoPng = await sharp(brand.logo).resize(256, 256, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    const r = (plate * 0.18).toFixed(3);
    const overlay =
      `<rect x="${at.toFixed(3)}" y="${at.toFixed(3)}" width="${plate.toFixed(3)}" height="${plate.toFixed(3)}" rx="${r}" ry="${r}" fill="#ffffff"/>` +
      `<image x="${(at + pad).toFixed(3)}" y="${(at + pad).toFixed(3)}" width="${(plate - pad * 2).toFixed(3)}" height="${(plate - pad * 2).toFixed(3)}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logoPng.toString("base64")}"/>`;
    return svg.replace(/<\/svg>\s*$/, `${overlay}</svg>`);
  } catch {
    return QRCode.toString(text, { type: "svg", ...qrOptions({ color: brand.color }) });
  }
}

/** Plain black-and-white QR (pickup confirmation codes scanned at the kiosk). */
export async function qrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: "M" });
}
