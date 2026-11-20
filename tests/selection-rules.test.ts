import { describe, expect, it } from "vitest";
import {
  campaignAcceptsPicks,
  canChangeSelection,
  changeDeadline,
  changeState,
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
    expect(lastNameMatches("de la", "de la Cruz")).toBe(false);
    expect(lastNameMatches("Garcia", "Hernández López")).toBe(false);
    expect(lastNameMatches("Hernandez Garcia", "Hernández López")).toBe(false);
  });
  it("accepts either surname, both, any order, hyphenated", () => {
    for (const typed of ["Hernandez", "lopez", "Hernández López", "LOPEZ HERNANDEZ", "Hernandez-Lopez", "hernández y lópez"]) {
      expect(lastNameMatches(typed, "Hernández López"), typed).toBe(true);
    }
  });
  it("accepts both surnames when the list only has one", () => {
    expect(lastNameMatches("García López", "García")).toBe(true);
    expect(lastNameMatches("Garcia-Lopez", "García")).toBe(true);
    expect(lastNameMatches("Lopez Torres", "García")).toBe(false);
  });
  it("accepts the full name when the first name is known", () => {
    expect(lastNameMatches("Luis Hernández López", "Hernández López", "Luis")).toBe(true);
    expect(lastNameMatches("Luis Hernandez", "Hernández López", "Luis")).toBe(true);
    expect(lastNameMatches("María José García", "García", "María José")).toBe(true);
    expect(lastNameMatches("Luis Garcia", "Hernández López", "Luis")).toBe(false);
    expect(lastNameMatches("Luis", "Hernández López", "Luis")).toBe(false);
  });
  it("handles a surname that is also a first-name word", () => {
    expect(lastNameMatches("Thomas", "Thomas", "Thomas")).toBe(true);
    expect(lastNameMatches("Martin Martin", "Martin", "Martin")).toBe(true);
  });
  it("handles two-letter surnames", () => {
    expect(lastNameMatches("Li", "Li")).toBe(true);
    expect(lastNameMatches("Li", "Li Wang")).toBe(true);
    expect(lastNameMatches("Ng", "Li Wang")).toBe(false);
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
  const first = new Date("2026-12-01T15:00:00Z");
  const at = (h: number) => new Date(first.getTime() + h * 3_600_000);
  const open = { allowChangeUntilOrdered: true, changeWindowHours: null };
  it("allows re-pick always, change only while SELECTED and permitted", () => {
    expect(canChangeSelection({ status: "NEEDS_REPICK", firstSelectedAt: first }, { allowChangeUntilOrdered: false, changeWindowHours: 4 }, at(100))).toBe(true);
    expect(canChangeSelection({ status: "SELECTED", firstSelectedAt: first }, open, at(100))).toBe(true);
    expect(canChangeSelection({ status: "SELECTED", firstSelectedAt: first }, { ...open, allowChangeUntilOrdered: false }, at(0))).toBe(false);
    expect(canChangeSelection({ status: "ORDERED", firstSelectedAt: first }, open, at(0))).toBe(false);
  });
  it("closes the change window N hours after the first pick", () => {
    const policy = { allowChangeUntilOrdered: true, changeWindowHours: 4 };
    const sel = { status: "SELECTED", firstSelectedAt: first };
    expect(changeState(sel, policy, at(0))).toEqual({ ok: true, deadline: at(4) });
    expect(changeState(sel, policy, at(3.99)).ok).toBe(true);
    expect(changeState(sel, policy, at(4))).toEqual({ ok: false, reason: "window_closed", deadline: at(4) });
    expect(changeState({ status: "ORDERED", firstSelectedAt: first }, policy, at(1))).toMatchObject({ ok: false, reason: "ordered" });
    expect(changeState(sel, { allowChangeUntilOrdered: false, changeWindowHours: 4 }, at(1))).toEqual({ ok: false, reason: "final", deadline: null });
  });
  it("treats a blank window as 'until HR orders'", () => {
    expect(changeDeadline(first, null)).toBeNull();
    expect(changeDeadline(first, 0)).toBeNull();
    expect(changeDeadline(first, 24)).toEqual(at(24));
  });
});

describe("generateConfirmationCode", () => {
  it("avoids ambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) expect(generateConfirmationCode(6)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
