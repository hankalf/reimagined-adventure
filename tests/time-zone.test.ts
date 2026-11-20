import { describe, expect, it } from "vitest";
import { campaignAcceptsPicks } from "@/lib/selection-rules";
import { closesAtInstant, endOfDayIn, excelEastern, formatCalendarDate, opensAtInstant, startOfDayIn } from "@/lib/time-zone";
import { fmtDate } from "@/lib/utils";
import { formatDateTime } from "@/i18n";

// What the date picker stores: the calendar date at midnight UTC.
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("campaign dates in Eastern Time", () => {
  it("close date runs until 11:59 PM Eastern (EST in winter, EDT in summer)", () => {
    expect(endOfDayIn(day("2026-12-20")).toISOString()).toBe("2026-12-21T04:59:59.999Z"); // EST, UTC-5
    expect(endOfDayIn(day("2026-07-04")).toISOString()).toBe("2026-07-05T03:59:59.999Z"); // EDT, UTC-4
    expect(startOfDayIn(day("2026-11-20")).toISOString()).toBe("2026-11-20T05:00:00.000Z");
    // Daylight-saving switch days.
    expect(startOfDayIn(day("2026-03-08")).toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(endOfDayIn(day("2026-03-08")).toISOString()).toBe("2026-03-09T03:59:59.999Z");
    expect(endOfDayIn(day("2026-11-01")).toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });

  it("employees can still pick on the evening of the last day (the old bug closed at 7 PM the day before)", () => {
    const c = { status: "OPEN" as const, opensAt: day("2026-11-20"), closesAt: day("2026-12-20") };
    expect(campaignAcceptsPicks(c, new Date("2026-12-20T00:30:00Z")).ok).toBe(true); // Dec 19, 7:30 PM ET
    expect(campaignAcceptsPicks(c, new Date("2026-12-21T04:30:00Z")).ok).toBe(true); // Dec 20, 11:30 PM ET
    expect(campaignAcceptsPicks(c, new Date("2026-12-21T05:00:00Z"))).toEqual({ ok: false, reason: "expired" }); // Dec 21, 12:00 AM ET
  });

  it("open date starts at 12:00 AM Eastern, not the evening before", () => {
    const c = { status: "OPEN" as const, opensAt: day("2026-11-20"), closesAt: null };
    expect(campaignAcceptsPicks(c, new Date("2026-11-20T03:00:00Z"))).toEqual({ ok: false, reason: "not_yet_open" }); // Nov 19, 10 PM ET
    expect(campaignAcceptsPicks(c, new Date("2026-11-20T05:00:00Z")).ok).toBe(true);
    expect(opensAtInstant({ opensAt: null })).toBeNull();
    expect(closesAtInstant({ closesAt: null })).toBeNull();
  });

  it("shows the picked calendar date and Eastern clock times", () => {
    expect(formatCalendarDate(day("2026-12-20"))).toBe("December 20, 2026");
    expect(formatCalendarDate(day("2026-12-20"), "es-US")).toBe("20 de diciembre de 2026");
    expect(fmtDate(new Date("2026-11-20T21:34:00Z"), true)).toBe("Nov 20, 2026, 4:34 PM EST");
    expect(fmtDate(new Date("2026-11-21T02:00:00Z"))).toBe("Nov 20, 2026"); // 9 PM ET is still the 20th
    expect(formatDateTime(new Date("2026-11-20T21:34:00Z"), "en")).toBe("Nov 20, 4:34 PM EST");
    expect(formatDateTime(new Date("2026-07-01T16:00:00Z"), "en")).toBe("Jul 1, 12:00 PM EDT");
  });

  it("Excel cells read as Eastern wall-clock time", () => {
    expect(excelEastern(new Date("2026-11-20T21:34:00Z"))?.toISOString()).toBe("2026-11-20T16:34:00.000Z");
    expect(excelEastern(null)).toBeNull();
  });
});
