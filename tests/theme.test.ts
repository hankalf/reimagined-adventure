import { describe, expect, it } from "vitest";
import { BG_PATTERNS, QUICK_THEMES, fontStack, luminance, pageBackgroundStyle, pageThemeAttrs, resolvedTextMode } from "@/lib/theme";

const base = { bgPattern: "none", bgColor: "#f8fafc", bgColor2: "#e2e8f0", bgImageUrl: null, bgOverlay: 35, textMode: "auto", fontStyle: "modern", cardStyle: "solid", accentColor: "#f59e0b" };

describe("page theme", () => {
  it("computes luminance", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
  });
  it("picks light text on dark backgrounds and dark text on light ones", () => {
    expect(resolvedTextMode(base)).toBe("dark");
    expect(resolvedTextMode({ ...base, bgColor: "#14532d" })).toBe("light");
    expect(resolvedTextMode({ ...base, bgPattern: "gradient", bgColor: "#fde68a", bgColor2: "#fb7185" })).toBe("dark");
    expect(resolvedTextMode({ ...base, bgImageUrl: "/x.jpg", bgOverlay: 50 })).toBe("light");
    expect(resolvedTextMode({ ...base, bgImageUrl: "/x.jpg", bgOverlay: 10 })).toBe("dark");
    expect(resolvedTextMode({ ...base, bgColor: "#000000", textMode: "dark" })).toBe("dark");
  });
  it("renders every pattern, and a photo overrides the pattern with a darkening layer", () => {
    for (const p of BG_PATTERNS) {
      const css = pageBackgroundStyle({ ...base, bgPattern: p.key });
      expect(css.backgroundColor, p.key).toBe("#f8fafc");
      if (p.key !== "none") expect(String(css.backgroundImage), p.key).toMatch(/gradient/);
    }
    const photo = pageBackgroundStyle({ ...base, bgPattern: "snow", bgImageUrl: "/api/images/abc", bgOverlay: 40 });
    expect(String(photo.backgroundImage)).toBe('linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url("/api/images/abc")');
  });
  it("falls back safely on bad values", () => {
    expect(pageBackgroundStyle({ ...base, bgColor: "red", bgPattern: "nope" })).toEqual({ backgroundColor: "#f8fafc" });
    expect(fontStack("nope")).toBe(fontStack("modern"));
    expect(pageThemeAttrs({ ...base, cardStyle: "weird" }).cardStyle).toBe("solid");
  });
  it("quick themes use valid patterns and readable text settings", () => {
    for (const q of QUICK_THEMES) {
      expect(BG_PATTERNS.some((p) => p.key === q.bgPattern), q.key).toBe(true);
      const mode = resolvedTextMode({ ...base, ...q, textMode: "auto" });
      expect(mode, `${q.key} auto text mode matches its preset`).toBe(q.textMode === "auto" ? mode : q.textMode);
    }
  });
});
