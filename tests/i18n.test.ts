import { describe, expect, it } from "vitest";
import { dict, fill, localized, pickLang } from "@/i18n";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" && v !== null ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("i18n", () => {
  it("Spanish has every English key", () => {
    expect(keys(es as unknown as Record<string, unknown>).sort()).toEqual(keys(en as unknown as Record<string, unknown>).sort());
  });
  it("picks language from explicit, cookie, then Accept-Language", () => {
    expect(pickLang("es", "en", "en-US")).toBe("es");
    expect(pickLang(null, "es", "en-US")).toBe("es");
    expect(pickLang(null, null, "es-MX,es;q=0.9,en;q=0.8")).toBe("es");
    expect(pickLang(null, null, "fr-FR")).toBe("en");
    expect(pickLang("xx", "yy", null)).toBe("en");
  });
  it("fills placeholders and falls back to English content", () => {
    expect(fill(dict("es").pick.greeting, { name: "Ana" })).toBe("¡Hola Ana!");
    expect(localized("es", "Hello", "Hola")).toBe("Hola");
    expect(localized("es", "Hello", "")).toBe("Hello");
    expect(localized("en", "Hello", "Hola")).toBe("Hello");
  });
});
