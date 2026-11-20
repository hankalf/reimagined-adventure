/**
 * The company runs on Eastern Time (America/New_York: EST in winter, EDT in summer).
 *
 * Campaign open/close dates are calendar dates, stored as midnight UTC straight from a date picker. They mean
 * "from 12:00 AM Eastern on the open date" and "until 11:59 PM Eastern on the close date".
 * Pure helpers (no library) so the rules are unit-tested.
 */
export const APP_TIME_ZONE = "America/New_York";

/** How far the zone's wall clock is ahead of UTC at `instant`, in ms (negative in the Americas). */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** The instant when the wall clock in `timeZone` reads the given local date and time (DST-aware). */
export function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number, timeZone = APP_TIME_ZONE): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const guess = wall - zoneOffsetMs(wall, timeZone);
  return new Date(wall - zoneOffsetMs(guess, timeZone));
}

/** 12:00 AM Eastern on the calendar date. */
export function startOfDayIn(calendarDate: Date, timeZone = APP_TIME_ZONE): Date {
  return zonedInstant(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, calendarDate.getUTCDate(), 0, 0, 0, 0, timeZone);
}

/** 11:59:59.999 PM Eastern on the calendar date. */
export function endOfDayIn(calendarDate: Date, timeZone = APP_TIME_ZONE): Date {
  return zonedInstant(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, calendarDate.getUTCDate(), 23, 59, 59, 999, timeZone);
}

/** When picks open / close for a campaign, as real instants. */
export function opensAtInstant(c: { opensAt: Date | null }): Date | null {
  return c.opensAt ? startOfDayIn(c.opensAt) : null;
}
export function closesAtInstant(c: { closesAt: Date | null }): Date | null {
  return c.closesAt ? endOfDayIn(c.closesAt) : null;
}

/** A stored calendar date in words ("December 20, 2026"): exactly the date that was picked. */
export function formatCalendarDate(calendarDate: Date, locale = "en-US", dateStyle: "long" | "medium" = "long"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle, timeZone: "UTC" }).format(calendarDate);
}

/**
 * Excel has no time zones: it shows a date-time cell's wall clock as UTC. Shift instants so the sheet reads Eastern.
 */
export function excelEastern(instant: Date | null | undefined): Date | null {
  if (!instant) return null;
  return new Date(instant.getTime() + zoneOffsetMs(instant.getTime(), APP_TIME_ZONE));
}
