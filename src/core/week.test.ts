import { describe, expect, it } from "vitest";
import {
  addDays,
  addWeeks,
  calendarDateIn,
  compareIsoWeeks,
  currentIsoWeek,
  isoWeekEnd,
  isoWeekKey,
  isoWeekOf,
  isoWeeksInYear,
  isoWeekStart,
  isoWeekday,
  parseIsoWeekKey,
  weekOfYearLabel,
} from "./week";

const d = (year: number, month: number, day: number) => ({ year, month, day });

describe("isoWeekOf", () => {
  it("puts 1–3 Jan 2027 in 2026-W53", () => {
    expect(isoWeekOf(d(2027, 1, 1))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(d(2027, 1, 2))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(d(2027, 1, 3))).toEqual({ year: 2026, week: 53 });
  });

  it("starts 2027-W01 on Monday 4 Jan 2027", () => {
    expect(isoWeekOf(d(2027, 1, 4))).toEqual({ year: 2027, week: 1 });
    expect(isoWeekOf(d(2027, 1, 10))).toEqual({ year: 2027, week: 1 });
    expect(isoWeekOf(d(2027, 1, 11))).toEqual({ year: 2027, week: 2 });
  });

  it("matches the brief's example week (3 May 2027 is W18)", () => {
    expect(isoWeekOf(d(2027, 5, 3))).toEqual({ year: 2027, week: 18 });
    expect(isoWeekOf(d(2027, 5, 9))).toEqual({ year: 2027, week: 18 });
  });

  it("ends 2027 in W52 and puts 2028's first days in 2027-W52 or 2028-W01 correctly", () => {
    // 31 Dec 2027 is a Friday; 3 Jan 2028 is a Monday.
    expect(isoWeekOf(d(2027, 12, 27))).toEqual({ year: 2027, week: 52 });
    expect(isoWeekOf(d(2027, 12, 31))).toEqual({ year: 2027, week: 52 });
    expect(isoWeekOf(d(2028, 1, 2))).toEqual({ year: 2027, week: 52 });
    expect(isoWeekOf(d(2028, 1, 3))).toEqual({ year: 2028, week: 1 });
  });

  it("assigns late-December days to week 1 of the next year when Thursday falls there", () => {
    // 29 Dec 2025 (Monday) is 2026-W01.
    expect(isoWeekOf(d(2025, 12, 29))).toEqual({ year: 2026, week: 1 });
    expect(isoWeekOf(d(2025, 12, 28))).toEqual({ year: 2025, week: 52 });
  });

  it("handles a 53-week year that starts on a Thursday (2026) and a leap year (2020)", () => {
    expect(isoWeekOf(d(2026, 12, 28))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(d(2020, 12, 31))).toEqual({ year: 2020, week: 53 });
    expect(isoWeekOf(d(2021, 1, 3))).toEqual({ year: 2020, week: 53 });
    expect(isoWeekOf(d(2021, 1, 4))).toEqual({ year: 2021, week: 1 });
  });
});

describe("isoWeeksInYear", () => {
  it("knows which years have 53 weeks", () => {
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2027)).toBe(52);
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2015)).toBe(53);
    expect(isoWeeksInYear(2032)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2028)).toBe(52);
  });
});

describe("week boundaries and keys", () => {
  it("returns Monday and Sunday of a week", () => {
    expect(isoWeekStart({ year: 2027, week: 1 })).toEqual(d(2027, 1, 4));
    expect(isoWeekEnd({ year: 2027, week: 1 })).toEqual(d(2027, 1, 10));
    expect(isoWeekStart({ year: 2026, week: 53 })).toEqual(d(2026, 12, 28));
    expect(isoWeekEnd({ year: 2026, week: 53 })).toEqual(d(2027, 1, 3));
    expect(isoWeekStart({ year: 2027, week: 18 })).toEqual(d(2027, 5, 3));
  });

  it("computes weekday with Monday = 0", () => {
    expect(isoWeekday(d(2027, 1, 4))).toBe(0);
    expect(isoWeekday(d(2027, 1, 3))).toBe(6);
  });

  it("adds days and weeks across year ends", () => {
    expect(addDays(d(2026, 12, 31), 1)).toEqual(d(2027, 1, 1));
    expect(addWeeks({ year: 2027, week: 1 }, -1)).toEqual({ year: 2026, week: 53 });
    expect(addWeeks({ year: 2027, week: 52 }, 1)).toEqual({ year: 2028, week: 1 });
    expect(addWeeks({ year: 2027, week: 3 }, -8)).toEqual({ year: 2026, week: 48 });
  });

  it("formats and parses week keys", () => {
    expect(isoWeekKey({ year: 2027, week: 5 })).toBe("2027-W05");
    expect(parseIsoWeekKey("2027-W18")).toEqual({ year: 2027, week: 18 });
    expect(parseIsoWeekKey("2026-W53")).toEqual({ year: 2026, week: 53 });
    expect(parseIsoWeekKey("2027-W53")).toBeNull();
    expect(parseIsoWeekKey("2027-W00")).toBeNull();
    expect(parseIsoWeekKey("2027W05")).toBeNull();
  });

  it("orders weeks chronologically", () => {
    expect(compareIsoWeeks({ year: 2026, week: 53 }, { year: 2027, week: 1 })).toBeLessThan(0);
    expect(compareIsoWeeks({ year: 2027, week: 2 }, { year: 2027, week: 2 })).toBe(0);
  });
});

describe("Europe/London current week", () => {
  it("uses the London date, not UTC, during British Summer Time", () => {
    // Sunday 9 May 2027 23:30 UTC is Monday 10 May 00:30 in London (BST).
    const instant = new Date("2027-05-09T23:30:00Z");
    expect(calendarDateIn(instant)).toEqual(d(2027, 5, 10));
    expect(currentIsoWeek(instant)).toEqual({ year: 2027, week: 19 });
  });

  it("uses GMT in winter (London date equals UTC date)", () => {
    expect(currentIsoWeek(new Date("2027-01-03T23:30:00Z"))).toEqual({ year: 2026, week: 53 });
    expect(currentIsoWeek(new Date("2027-01-04T00:00:00Z"))).toEqual({ year: 2027, week: 1 });
  });

  it("ignores the device timezone", () => {
    // 4 Jan 2027 00:30 in Tokyo is still Sunday 3 Jan in London.
    const instant = new Date("2027-01-03T15:30:00Z");
    expect(calendarDateIn(instant, "Asia/Tokyo")).toEqual(d(2027, 1, 4));
    expect(currentIsoWeek(instant)).toEqual({ year: 2026, week: 53 });
  });
});

describe("weekOfYearLabel", () => {
  it("reads 'Week N of 52' in 2027 and 'of 53' in a 53-week year", () => {
    expect(weekOfYearLabel({ year: 2027, week: 18 })).toBe("Week 18 of 52");
    expect(weekOfYearLabel({ year: 2026, week: 53 })).toBe("Week 53 of 53");
  });
});
