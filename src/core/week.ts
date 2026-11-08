/**
 * ISO-8601 week helpers. Pure: no Obsidian imports, no global clock.
 *
 * Weeks run Monday to Sunday. "Today" is a calendar date in the scoreboard
 * timezone (Europe/London), obtained with `calendarDateIn` from an instant;
 * every other function works on calendar dates only, so it is timezone-free.
 */

export const SCOREBOARD_TIMEZONE = "Europe/London";

/** A calendar date with a 1-based month. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** An ISO week: the ISO week-numbering year and week number (1–53). */
export interface IsoWeek {
  year: number;
  week: number;
}

const DAY_MS = 86_400_000;

function toUtcMs(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

function fromUtcMs(ms: number): CalendarDate {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Day of week with Monday = 0 … Sunday = 6. */
export function isoWeekday(date: CalendarDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7;
}

/** Adds (or subtracts) whole days to a calendar date. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** The ISO week containing a calendar date. */
export function isoWeekOf(date: CalendarDate): IsoWeek {
  // The ISO week belongs to the year that contains its Thursday.
  const thursday = addDays(date, 3 - isoWeekday(date));
  const jan1 = toUtcMs({ year: thursday.year, month: 1, day: 1 });
  const week = 1 + Math.floor((toUtcMs(thursday) - jan1) / (7 * DAY_MS));
  return { year: thursday.year, week };
}

/** Number of ISO weeks (52 or 53) in an ISO week-numbering year. */
export function isoWeeksInYear(year: number): number {
  // 28 December is always in the last ISO week of its year.
  return isoWeekOf({ year, month: 12, day: 28 }).week;
}

/** The Monday that starts an ISO week. */
export function isoWeekStart(week: IsoWeek): CalendarDate {
  // 4 January is always in week 1.
  const jan4 = { year: week.year, month: 1, day: 4 };
  const week1Monday = addDays(jan4, -isoWeekday(jan4));
  return addDays(week1Monday, (week.week - 1) * 7);
}

/** The Sunday that ends an ISO week. */
export function isoWeekEnd(week: IsoWeek): CalendarDate {
  return addDays(isoWeekStart(week), 6);
}

/** Formats a week as its ISO key, e.g. "2027-W05". Used as data-file and marker keys. */
export function isoWeekKey(week: IsoWeek): string {
  return `${week.year}-W${String(week.week).padStart(2, "0")}`;
}

/** Parses an ISO week key such as "2027-W05"; returns null if malformed or out of range. */
export function parseIsoWeekKey(key: string): IsoWeek | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > isoWeeksInYear(year)) return null;
  return { year, week };
}

/** Compares two weeks chronologically (negative if a is earlier). */
export function compareIsoWeeks(a: IsoWeek, b: IsoWeek): number {
  return a.year !== b.year ? a.year - b.year : a.week - b.week;
}

/** The ISO week offset by a number of weeks (negative for earlier weeks). */
export function addWeeks(week: IsoWeek, weeks: number): IsoWeek {
  return isoWeekOf(addDays(isoWeekStart(week), weeks * 7));
}

/** The calendar date of an instant in a given IANA timezone (default Europe/London). */
export function calendarDateIn(instant: Date, timeZone: string = SCOREBOARD_TIMEZONE): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** The ISO week of an instant in the scoreboard timezone. */
export function currentIsoWeek(instant: Date, timeZone: string = SCOREBOARD_TIMEZONE): IsoWeek {
  return isoWeekOf(calendarDateIn(instant, timeZone));
}

/** Header copy: "Week N of 52" (or "of 53" in a 53-week year). */
export function weekOfYearLabel(week: IsoWeek): string {
  return `Week ${week.week} of ${isoWeeksInYear(week.year)}`;
}
