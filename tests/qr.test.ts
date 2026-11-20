import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import sharp from "sharp";
import { qrPng, qrSvg } from "@/lib/qr";
import { QR_MAX_LUMINANCE, luminance, qrInk } from "@/lib/theme";

const URL = "https://reimagined-adventure-production.up.railway.app/g/holiday-gifts-2026-plant-north";

async function decode(png: Buffer): Promise<string | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

async function inkPixels(png: Buffer, ink: string): Promise<number> {
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
  let n = 0;
  for (let i = 0; i < data.length; i += 3) if (data[i] === r && data[i + 1] === g && data[i + 2] === b) n += 1;
  return n;
}

// A busy, dark logo: the worst case for scanning.
const logo = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 20, g: 20, b: 20 } } })
  .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><circle cx="150" cy="100" r="80" fill="#e11d48"/></svg>') }])
  .png()
  .toBuffer();

describe("QR ink colour", () => {
  it("keeps dark brand colours and darkens light ones until they scan reliably", () => {
    expect(qrInk("#1e3a8a")).toBe("#1e3a8a");
    expect(qrInk("#B91C1C")).toBe("#b91c1c");
    for (const light of ["#fde68a", "#f59e0b", "#ffffff", "#7dd3fc"]) {
      const ink = qrInk(light);
      expect(ink).not.toBe(light);
      expect(luminance(ink)).toBeLessThanOrEqual(QR_MAX_LUMINANCE);
    }
    expect(qrInk("not a colour")).toBe("#000000");
    expect(qrInk(null)).toBe("#000000");
  });
});

describe("branded QR code", () => {
  it("draws the modules in the brand colour", async () => {
    const png = await qrPng(URL, 512, { color: "#1e3a8a" });
    expect(await decode(png)).toBe(URL);
    expect(await inkPixels(png, "#1e3a8a")).toBeGreaterThan(1000);
  });
  it("still scans with the logo in the middle, at poster and preview sizes", async () => {
    for (const size of [320, 512, 1024]) {
      const png = await qrPng(URL, size, { color: "#b91c1c", logo });
      expect(await decode(png)).toBe(URL);
    }
  });
  it("still scans with a light brand colour and a logo", async () => {
    const png = await qrPng(URL, 512, { color: "#fde68a", logo });
    expect(await decode(png)).toBe(URL);
    expect(await inkPixels(png, qrInk("#fde68a"))).toBeGreaterThan(1000);
  });
  it("falls back to a plain branded code when the logo can't be read", async () => {
    const png = await qrPng(URL, 512, { color: "#1e3a8a", logo: Buffer.from("not an image") });
    expect(await decode(png)).toBe(URL);
  });
  it("SVG carries the brand colour and the logo", async () => {
    const svg = await qrSvg(URL, { color: "#1e3a8a", logo });
    expect(svg).toContain("#1e3a8a");
    expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,/);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    // Rendered, the SVG also scans.
    expect(await decode(await sharp(Buffer.from(svg), { density: 300 }).resize(800).png().toBuffer())).toBe(URL);
    const plain = await qrSvg(URL);
    expect(plain).not.toContain("<image");
  });
});
