/** Launch-day progress numbers for the Live tab. Pure, so it is unit-tested. */
import { NO_DEPARTMENT } from "./not-picked";
import { APP_TIME_ZONE, easternCalendarDate, startOfDayIn } from "./time-zone";

const COMMITTED = new Set(["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"]);
const HOUR = 3_600_000;

export type LiveInput = {
  eligible: Array<{ employeeId: string; department: string | null }>;
  selections: Array<{
    employeeId: string;
    status: string;
    firstSelectedAt: Date;
    selectedAt: Date;
    itemName: string;
    firstName: string;
    lastName: string;
    department: string | null;
  }>;
  now: Date;
  hours?: number;
};

export type LiveStats = {
  eligible: number;
  picked: number;
  notPicked: number;
  repick: number;
  pct: number;
  lastHour: number;
  today: number;
  byHour: Array<{ start: Date; label: string; count: number; current: boolean }>;
  byDepartment: Array<{ department: string; eligible: number; picked: number; pct: number }>;
  topGifts: Array<{ name: string; count: number }>;
  moreGifts: number;
  recent: Array<{ at: Date; name: string; department: string | null; gift: string; changed: boolean; repick: boolean }>;
};

const deptLabel = (d: string | null) => d?.trim().replace(/\s+/g, " ") || NO_DEPARTMENT;
const hourLabel = (d: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: APP_TIME_ZONE }).format(d);

export function liveStats({ eligible, selections, now, hours = 12 }: LiveInput): LiveStats {
  const eligibleIds = new Set(eligible.map((e) => e.employeeId));
  const mine = selections.filter((s) => eligibleIds.has(s.employeeId));
  const pickedIds = new Set(mine.filter((s) => COMMITTED.has(s.status)).map((s) => s.employeeId));
  const repick = mine.filter((s) => s.status === "NEEDS_REPICK").length;
  const picked = pickedIds.size;
  const pct = eligible.length > 0 ? Math.round((picked / eligible.length) * 1000) / 10 : 0;

  // First picks (not changes) by Eastern hour. Eastern offsets are whole hours, so UTC hour boundaries line up.
  const currentHour = Math.floor(now.getTime() / HOUR) * HOUR;
  const firstHour = currentHour - (hours - 1) * HOUR;
  const byHour = Array.from({ length: hours }, (_, i) => {
    const start = new Date(firstHour + i * HOUR);
    return { start, label: hourLabel(start), count: 0, current: i === hours - 1 };
  });
  for (const s of mine) {
    const t = s.firstSelectedAt.getTime();
    if (t >= firstHour && t < currentHour + HOUR) byHour[Math.floor((t - firstHour) / HOUR)].count += 1;
  }
  const startOfToday = startOfDayIn(easternCalendarDate(now)).getTime();
  const lastHour = mine.filter((s) => s.firstSelectedAt.getTime() > now.getTime() - HOUR).length;
  const today = mine.filter((s) => s.firstSelectedAt.getTime() >= startOfToday).length;

  // Departments, lowest completion first (who needs a reminder).
  const depts = new Map<string, { department: string; eligible: number; picked: number }>();
  for (const e of eligible) {
    const label = deptLabel(e.department);
    const d = depts.get(label.toLowerCase()) ?? { department: label, eligible: 0, picked: 0 };
    d.eligible += 1;
    if (pickedIds.has(e.employeeId)) d.picked += 1;
    depts.set(label.toLowerCase(), d);
  }
  const byDepartment = [...depts.values()]
    .map((d) => ({ ...d, pct: Math.round((d.picked / d.eligible) * 1000) / 10 }))
    .sort((a, b) => a.pct - b.pct || a.department.localeCompare(b.department));

  const giftCounts = new Map<string, number>();
  for (const s of mine) if (COMMITTED.has(s.status)) giftCounts.set(s.itemName, (giftCounts.get(s.itemName) ?? 0) + 1);
  const ranked = [...giftCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));

  const recent = [...mine]
    .sort((a, b) => b.selectedAt.getTime() - a.selectedAt.getTime())
    .slice(0, 10)
    .map((s) => ({
      at: s.selectedAt,
      name: `${s.firstName} ${s.lastName.charAt(0)}.`,
      department: s.department,
      gift: s.itemName,
      changed: s.selectedAt.getTime() - s.firstSelectedAt.getTime() > 1000,
      repick: s.status === "NEEDS_REPICK",
    }));

  return {
    eligible: eligible.length,
    picked,
    notPicked: eligible.length - picked,
    repick,
    pct,
    lastHour,
    today,
    byHour,
    byDepartment,
    topGifts: ranked.slice(0, 8),
    moreGifts: Math.max(0, ranked.length - 8),
    recent,
  };
}
