import { describe, expect, it } from "vitest";
import {
  campaignAcceptsPicks,
  canChangeSelection,
  employeeNumberCandidates,
  generateConfirmationCode,
  itemAvailability,
  lastNameMatches,
  normalizeName,
} from "@/lib/selection-rules";

describe("normalizeName", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeName("  García-López ")).toBe("garcia lopez");
    expect(normalizeName("O'Brien")).toBe("o brien");
    expect(normalizeName("NUÑEZ")).toBe("nunez");
  });
});

describe("lastNameMatches", () => {
  it("matches exact, case-insensitive and accent-insensitive", () => {
    expect(lastNameMatches("garcia", "García")).toBe(true);
    expect(lastNameMatches("GARCÍA", "Garcia")).toBe(true);
  });
  it("accepts a single part of a multi-part surname", () => {
    expect(lastNameMatches("cruz", "de la Cruz")).toBe(true);
    expect(lastNameMatches("Jones", "Smith-Jones")).toBe(true);
    expect(lastNameMatches("Hernandez", "Hernández López")).toBe(true);
  });
  it("rejects wrong names and empty input", () => {
    expect(lastNameMatches("smith", "García")).toBe(false);
    expect(lastNameMatches("", "García")).toBe(false);
    expect(lastNameMatches("de", "de la Cruz")).toBe(false);
  });
});

describe("employeeNumberCandidates", () => {
  it("normalises whitespace and case and offers a zero-stripped variant", () => {
    expect(employeeNumberCandidates(" 00123 ")).toEqual(["00123", "123"]);
    expect(employeeNumberCandidates("ab 12")).toEqual(["AB12"]);
    expect(employeeNumberCandidates("")).toEqual([]);
  });
});

describe("itemAvailability", () => {
  it("is available without a limit", () => {
    expect(itemAvailability({ status: "AVAILABLE", stockLimit: null, taken: 50, itemActive: true })).toMatchObject({ available: true, soldOut: false, remaining: null });
  });
  it("respects stock limits", () => {
    expect(itemAvailability({ status: "AVAILABLE", stockLimit: 2, taken: 1, itemActive: true })).toMatchObject({ available: true, remaining: 1 });
    expect(itemAvailability({ status: "AVAILABLE", stockLimit: 2, taken: 2, itemActive: true })).toMatchObject({ available: false, soldOut: true, remaining: 0 });
  });
  it("is sold out when marked out of stock or inactive", () => {
    expect(itemAvailability({ status: "OUT_OF_STOCK", stockLimit: null, taken: 0, itemActive: true }).available).toBe(false);
    expect(itemAvailability({ status: "AVAILABLE", stockLimit: null, taken: 0, itemActive: false }).available).toBe(false);
  });
});

describe("campaignAcceptsPicks", () => {
  const now = new Date("2026-12-01T12:00:00Z");
  it("requires OPEN status", () => {
    expect(campaignAcceptsPicks({ status: "DRAFT", opensAt: null, closesAt: null }, now)).toEqual({ ok: false, reason: "draft" });
    expect(campaignAcceptsPicks({ status: "CLOSED", opensAt: null, closesAt: null }, now)).toEqual({ ok: false, reason: "closed" });
    expect(campaignAcceptsPicks({ status: "OPEN", opensAt: null, closesAt: null }, now)).toEqual({ ok: true });
  });
  it("honours the open/close window", () => {
    expect(campaignAcceptsPicks({ status: "OPEN", opensAt: new Date("2026-12-02"), closesAt: null }, now).reason).toBe("not_yet_open");
    expect(campaignAcceptsPicks({ status: "OPEN", opensAt: null, closesAt: new Date("2026-11-30") }, now).reason).toBe("expired");
  });
});

describe("canChangeSelection", () => {
  it("allows re-pick always, change only while SELECTED and permitted", () => {
    expect(canChangeSelection("NEEDS_REPICK", false)).toBe(true);
    expect(canChangeSelection("SELECTED", true)).toBe(true);
    expect(canChangeSelection("SELECTED", false)).toBe(false);
    expect(canChangeSelection("ORDERED", true)).toBe(false);
  });
});

describe("generateConfirmationCode", () => {
  it("avoids ambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) expect(generateConfirmationCode(6)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
