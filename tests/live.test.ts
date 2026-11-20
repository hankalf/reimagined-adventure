import { describe, expect, it } from "vitest";
import { liveStats } from "@/lib/live";

const now = new Date("2026-11-20T19:20:00Z"); // 2:20 PM ET
const at = (iso: string) => new Date(iso);
const sel = (employeeId: string, status: string, first: string, last = first, itemName = "Mug", department: string | null = "Ops") => ({
  employeeId,
  status,
  firstSelectedAt: at(first),
  selectedAt: at(last),
  itemName,
  firstName: `F${employeeId}`,
  lastName: `L${employeeId}`,
  department,
});

describe("live launch-day stats", () => {
  const eligible = [
    { employeeId: "1", department: "Ops" },
    { employeeId: "2", department: "Ops" },
    { employeeId: "3", department: "Finance" },
    { employeeId: "4", department: null },
  ];
  const selections = [
    sel("1", "SELECTED", "2026-11-20T19:05:00Z"), // 2:05 PM, this hour
    sel("2", "ORDERED", "2026-11-20T15:30:00Z", "2026-11-20T18:59:00Z", "Hoodie"), // 10:30 AM, changed later
    sel("3", "NEEDS_REPICK", "2026-11-20T04:30:00Z", "2026-11-20T04:30:00Z", "Mug", "Finance"), // 11:30 PM the night before
    sel("9", "SELECTED", "2026-11-20T19:00:00Z"), // not eligible: ignored
  ];
  const s = liveStats({ eligible, selections, now });

  it("counts picks, the share picked and re-picks among eligible employees", () => {
    expect([s.eligible, s.picked, s.notPicked, s.repick, s.pct]).toEqual([4, 2, 2, 1, 50]);
  });
  it("counts first picks in the last hour and today in Eastern Time", () => {
    expect(s.lastHour).toBe(1);
    expect(s.today).toBe(2); // 11:30 PM on the 19th (ET) is not today, even though it is the 20th in UTC
  });
  it("buckets first picks per Eastern hour over the last 12 hours", () => {
    expect(s.byHour).toHaveLength(12);
    expect(s.byHour.at(-1)).toMatchObject({ label: "2 PM", count: 1, current: true });
    expect(s.byHour.find((h) => h.label === "10 AM")?.count).toBe(1);
    expect(s.byHour[0].label).toBe("3 AM");
    expect(s.byHour.reduce((n, h) => n + h.count, 0)).toBe(2);
  });
  it("lists departments lowest completion first", () => {
    expect(s.byDepartment.map((d) => [d.department, d.picked, d.eligible, d.pct])).toEqual([
      ["Finance", 0, 1, 0],
      ["No department", 0, 1, 0],
      ["Ops", 2, 2, 100],
    ]);
  });
  it("ranks gifts and shows the latest activity first", () => {
    expect(s.topGifts).toEqual([
      { name: "Hoodie", count: 1 },
      { name: "Mug", count: 1 },
    ]);
    expect(s.recent.map((r) => [r.name, r.changed, r.repick])).toEqual([
      ["F1 L.", false, false],
      ["F2 L.", true, false],
      ["F3 L.", false, true],
    ]);
  });
  it("handles a campaign with nobody eligible yet", () => {
    const empty = liveStats({ eligible: [], selections: [], now });
    expect([empty.pct, empty.picked, empty.byDepartment.length, empty.topGifts.length]).toEqual([0, 0, 0, 0]);
  });
});
