/**
 * Employee page look: background (plain, gradient, holiday patterns or an uploaded photo), text contrast,
 * font and card style. Pure functions so the admin preview and the real pages render identically.
 */
import type { CSSProperties } from "react";

export const BG_PATTERNS = [
  { key: "none", label: "Plain colour" },
  { key: "gradient", label: "Gradient" },
  { key: "snow", label: "Snowfall" },
  { key: "stars", label: "Starry night" },
  { key: "stripes", label: "Candy cane stripes" },
  { key: "plaid", label: "Holiday plaid" },
  { key: "confetti", label: "Confetti" },
  { key: "dots", label: "Polka dots" },
] as const;
export type BgPattern = (typeof BG_PATTERNS)[number]["key"];

export const FONT_STYLES = [
  { key: "modern", label: "Modern", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { key: "rounded", label: "Rounded & friendly", stack: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Varela Round", "Nunito", ui-sans-serif, system-ui, sans-serif' },
  { key: "classic", label: "Classic serif", stack: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  { key: "elegant", label: "Elegant", stack: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", Georgia, serif' },
] as const;
export type FontStyle = (typeof FONT_STYLES)[number]["key"];

export const TEXT_MODES = ["auto", "dark", "light"] as const;
export type TextMode = (typeof TEXT_MODES)[number];
export const CARD_STYLES = ["solid", "glass"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];

export type PageTheme = {
  bgPattern: string;
  bgColor: string;
  bgColor2: string;
  bgImageUrl: string | null;
  bgOverlay: number;
  textMode: string;
  fontStyle: string;
  cardStyle: string;
  accentColor: string;
};

export const isBgPattern = (v: string | null | undefined): v is BgPattern => BG_PATTERNS.some((p) => p.key === v);
export const isFontStyle = (v: string | null | undefined): v is FontStyle => FONT_STYLES.some((f) => f.key === v);
export const isTextMode = (v: string | null | undefined): v is TextMode => TEXT_MODES.includes(v as TextMode);
export const isCardStyle = (v: string | null | undefined): v is CardStyle => CARD_STYLES.includes(v as CardStyle);
export const isHex = (v: string | null | undefined): v is string => /^#[0-9a-fA-F]{6}$/.test(v ?? "");

/** Ready-made looks; picking one fills in the colours, pattern, font and text mode. */
export const QUICK_THEMES = [
  { key: "clean", label: "Clean & simple", primaryColor: "#1d4ed8", accentColor: "#f59e0b", bgPattern: "none", bgColor: "#f8fafc", bgColor2: "#e2e8f0", fontStyle: "modern", textMode: "auto", cardStyle: "solid" },
  { key: "christmas", label: "Classic Christmas", primaryColor: "#b91c1c", accentColor: "#15803d", bgPattern: "snow", bgColor: "#14532d", bgColor2: "#166534", fontStyle: "classic", textMode: "light", cardStyle: "solid" },
  { key: "winter", label: "Winter wonderland", primaryColor: "#1e3a8a", accentColor: "#7dd3fc", bgPattern: "snow", bgColor: "#1e3a8a", bgColor2: "#0c4a6e", fontStyle: "rounded", textMode: "light", cardStyle: "glass" },
  { key: "candy", label: "Candy cane", primaryColor: "#dc2626", accentColor: "#16a34a", bgPattern: "stripes", bgColor: "#fff1f2", bgColor2: "#fecaca", fontStyle: "rounded", textMode: "dark", cardStyle: "solid" },
  { key: "gold", label: "Gold & midnight", primaryColor: "#b45309", accentColor: "#facc15", bgPattern: "stars", bgColor: "#0f172a", bgColor2: "#1e293b", fontStyle: "elegant", textMode: "light", cardStyle: "glass" },
  { key: "plaid", label: "Cozy plaid", primaryColor: "#991b1b", accentColor: "#ca8a04", bgPattern: "plaid", bgColor: "#7f1d1d", bgColor2: "#14532d", fontStyle: "classic", textMode: "light", cardStyle: "solid" },
  { key: "party", label: "New Year party", primaryColor: "#7c3aed", accentColor: "#f59e0b", bgPattern: "confetti", bgColor: "#faf5ff", bgColor2: "#c4b5fd", fontStyle: "rounded", textMode: "dark", cardStyle: "solid" },
  { key: "sunset", label: "Warm sunset", primaryColor: "#c2410c", accentColor: "#db2777", bgPattern: "gradient", bgColor: "#fde68a", bgColor2: "#fb7185", fontStyle: "modern", textMode: "dark", cardStyle: "glass" },
] as const;

export function hexToRgb(hex: string): [number, number, number] {
  const h = isHex(hex) ? hex.slice(1) : "f8fafc";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** QR codes need dark modules on white to scan reliably. Darken the brand colour until it has about 4.5:1 contrast with white. */
export const QR_MAX_LUMINANCE = 0.18;
export function qrInk(hex: string | null | undefined): string {
  if (!isHex(hex)) return "#000000";
  let [r, g, b] = hexToRgb(hex);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  let out = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  while (luminance(out) > QR_MAX_LUMINANCE) {
    r *= 0.9;
    g *= 0.9;
    b *= 0.9;
    out = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  return out.toLowerCase();
}

/** Whether text placed directly on the background should be dark or light. */
export function resolvedTextMode(t: Pick<PageTheme, "textMode" | "bgPattern" | "bgColor" | "bgColor2" | "bgImageUrl" | "bgOverlay">): "dark" | "light" {
  if (t.textMode === "dark" || t.textMode === "light") return t.textMode;
  if (t.bgImageUrl) return t.bgOverlay >= 30 ? "light" : "dark";
  const lum = t.bgPattern === "gradient" || t.bgPattern === "stripes" ? (luminance(t.bgColor) + luminance(t.bgColor2)) / 2 : luminance(t.bgColor);
  return lum < 0.36 ? "light" : "dark";
}

/** CSS for the page background. An uploaded photo wins over the pattern. */
export function pageBackgroundStyle(t: Pick<PageTheme, "bgPattern" | "bgColor" | "bgColor2" | "bgImageUrl" | "bgOverlay" | "accentColor">): CSSProperties {
  const c1 = isHex(t.bgColor) ? t.bgColor : "#f8fafc";
  const c2 = isHex(t.bgColor2) ? t.bgColor2 : "#e2e8f0";
  if (t.bgImageUrl) {
    const o = Math.min(0.8, Math.max(0, t.bgOverlay / 100));
    return {
      backgroundColor: c1,
      backgroundImage: `linear-gradient(rgba(0, 0, 0, ${o}), rgba(0, 0, 0, ${o})), url("${t.bgImageUrl}")`,
      backgroundSize: "cover, cover",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat, no-repeat",
    };
  }
  switch (t.bgPattern as BgPattern) {
    case "gradient":
      return { backgroundColor: c1, backgroundImage: `linear-gradient(160deg, ${c1}, ${c2})` };
    case "snow":
      return {
        backgroundColor: c1,
        backgroundImage: [
          "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.85) 0 2px, transparent 3px)",
          "radial-gradient(circle at 70% 60%, rgba(255,255,255,0.65) 0 1.5px, transparent 2.5px)",
          "radial-gradient(circle at 40% 85%, rgba(255,255,255,0.75) 0 2.5px, transparent 3.5px)",
          `linear-gradient(180deg, ${c1}, ${c2})`,
        ].join(", "),
        backgroundSize: "120px 120px, 90px 90px, 170px 170px, 100% 100%",
      };
    case "stars":
      return {
        backgroundColor: c1,
        backgroundImage: [
          "radial-gradient(circle at 15% 25%, rgba(253,230,138,0.95) 0 1.5px, transparent 2.5px)",
          "radial-gradient(circle at 65% 75%, rgba(255,255,255,0.8) 0 1px, transparent 2px)",
          "radial-gradient(circle at 85% 15%, rgba(253,230,138,0.7) 0 2px, transparent 3px)",
          `linear-gradient(180deg, ${c1}, ${c2})`,
        ].join(", "),
        backgroundSize: "140px 140px, 80px 80px, 210px 210px, 100% 100%",
      };
    case "stripes":
      return { backgroundColor: c1, backgroundImage: `repeating-linear-gradient(45deg, ${c1} 0 24px, ${c2} 24px 48px)` };
    case "plaid":
      return {
        backgroundColor: c1,
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${rgba(c2, 0.45)} 0 18px, transparent 18px 54px)`,
          `repeating-linear-gradient(90deg, ${rgba(c2, 0.45)} 0 18px, transparent 18px 54px)`,
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 27px)",
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px 27px)",
        ].join(", "),
      };
    case "confetti":
      return {
        backgroundColor: c1,
        backgroundImage: [
          `radial-gradient(circle at 10% 20%, ${rgba(c2, 0.9)} 0 3px, transparent 4px)`,
          `radial-gradient(circle at 60% 40%, ${rgba(t.accentColor, 0.8)} 0 2.5px, transparent 3.5px)`,
          `radial-gradient(circle at 35% 75%, ${rgba(c2, 0.7)} 0 2px, transparent 3px)`,
          `radial-gradient(circle at 85% 85%, ${rgba(t.accentColor, 0.6)} 0 3px, transparent 4px)`,
        ].join(", "),
        backgroundSize: "110px 110px, 150px 150px, 90px 90px, 170px 170px",
      };
    case "dots":
      return { backgroundColor: c1, backgroundImage: `radial-gradient(${rgba(c2, 0.9)} 22%, transparent 24%)`, backgroundSize: "28px 28px" };
    case "none":
    default:
      return { backgroundColor: c1 };
  }
}

export function fontStack(fontStyle: string): string {
  return (FONT_STYLES.find((f) => f.key === fontStyle) ?? FONT_STYLES[0]).stack;
}

/** Everything the employee layout needs: wrapper style and data attributes. */
export function pageThemeAttrs(t: PageTheme): { style: CSSProperties; textMode: "dark" | "light"; cardStyle: CardStyle } {
  return {
    style: { ...pageBackgroundStyle(t), fontFamily: fontStack(t.fontStyle) },
    textMode: resolvedTextMode(t),
    cardStyle: isCardStyle(t.cardStyle) ? t.cardStyle : "solid",
  };
}
