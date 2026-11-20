import { describe, expect, it } from "vitest";
import { POSTER_MAX_TILES, posterLayout, posterTiles } from "@/lib/poster";

describe("poster layout", () => {
  it("keeps bigger tiles for up to 6 gifts and rows of 8 from 7 on", () => {
    expect(posterLayout(0).cols).toBe(0);
    expect(posterLayout(3).cols).toBe(4);
    expect(posterLayout(4).cols).toBe(4);
    expect(posterLayout(5).cols).toBe(5);
    expect(posterLayout(6).cols).toBe(6);
    expect(posterLayout(7).cols).toBe(8);
    expect(posterLayout(16).cols).toBe(8);
    expect(posterLayout(30).cols).toBe(8);
  });
  it("shrinks the QR code as more rows of gifts are needed", () => {
    const qr = [0, 4, 6, 16, 17].map((n) => posterLayout(n).qrIn);
    expect([...qr].sort((a, b) => b - a)).toEqual(qr);
    expect(posterLayout(17).qrIn).toBeLessThan(posterLayout(16).qrIn);
  });
  it("shows at most 3 rows of 8; the last tile becomes 'and more!'", () => {
    expect(POSTER_MAX_TILES).toBe(24);
    const many = Array.from({ length: 30 }, (_, i) => i);
    expect(posterTiles(many)).toEqual({ shown: many.slice(0, 23), more: true });
    const full = many.slice(0, 24);
    expect(posterTiles(full)).toEqual({ shown: full, more: false });
    expect(posterTiles([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: false });
  });
});
