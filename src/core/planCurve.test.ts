import { describe, expect, it } from "vitest";
import { calendarDateKey, dayOfYearIndex, daysInYear, planValueOn, quarterEndDays } from "./planCurve";

const d = (month: number, day: number, year = 2027) => ({ year, month, day });

describe("day helpers", () => {
  it("indexes days from 1 January", () => {
    expect(dayOfYearIndex(d(1, 1), 2027)).toBe(0);
    expect(dayOfYearIndex(d(12, 31), 2027)).toBe(364);
    expect(dayOfYearIndex(d(12, 31, 2026), 2027)).toBe(-1);
    expect(daysInYear(2027)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(quarterEndDays(2027)).toEqual([89, 180, 272, 364]);
    expect(calendarDateKey(d(3, 5))).toBe("2027-03-05");
  });
});

describe("linear plan", () => {
  const plan = { type: "linear" as const, baseline: 0 };

  it("starts at the baseline on 1 Jan and reaches the target on 31 Dec", () => {
    expect(planValueOn(plan, 12000, 2027, d(1, 1))).toBe(0);
    expect(planValueOn(plan, 12000, 2027, d(12, 31))).toBe(12000);
    expect(planValueOn({ type: "linear", baseline: 2 }, 12, 2027, d(1, 1))).toBe(2);
  });

  it("rises evenly through the year", () => {
    // 2 Jul 2027 is day 182 of 0..364: exactly half way.
    expect(planValueOn(plan, 364, 2027, d(7, 2))).toBe(182);
    expect(planValueOn({ type: "linear", baseline: 4 }, 368, 2027, d(7, 2))).toBe(186);
  });

  it("clamps outside the year (1–3 Jan in 2026-W53 still count as 2027)", () => {
    expect(planValueOn(plan, 100, 2027, d(11, 8, 2026))).toBe(0);
    expect(planValueOn(plan, 100, 2027, d(1, 5, 2028))).toBe(100);
    expect(planValueOn(plan, 364, 2027, d(1, 3))).toBe(2);
  });
});

describe("quarterly plan", () => {
  const plan = { type: "quarterly" as const, baseline: 0, quarters: [10, 50, 80, 100] as [number, number, number, number] };

  it("starts from the baseline on 1 Jan", () => {
    expect(planValueOn(plan, 100, 2027, d(1, 1))).toBe(0);
  });

  it("hits each quarter's value on the quarter end", () => {
    expect(planValueOn(plan, 100, 2027, d(3, 31))).toBe(10);
    expect(planValueOn(plan, 100, 2027, d(6, 30))).toBe(50);
    expect(planValueOn(plan, 100, 2027, d(9, 30))).toBe(80);
    expect(planValueOn(plan, 100, 2027, d(12, 31))).toBe(100);
  });

  it("interpolates between quarter ends", () => {
    // Q1: 10 over 89 days.
    expect(planValueOn(plan, 100, 2027, d(2, 14))).toBeCloseTo((10 * 44) / 89, 10);
    // Q2: 31 Mar (day 89) → 30 Jun (day 180), 10 → 50.
    expect(planValueOn(plan, 100, 2027, d(5, 5))).toBeCloseTo(10 + (40 * (124 - 89)) / 91, 10);
    // Just after a quarter end it keeps rising from that quarter's value.
    expect(planValueOn(plan, 100, 2027, d(4, 1))).toBeCloseTo(10 + 40 / 91, 10);
  });

  it("uses the baseline before the year and the Q4 value after it", () => {
    expect(planValueOn({ ...plan, baseline: 5 }, 100, 2027, d(12, 1, 2026))).toBe(5);
    expect(planValueOn(plan, 100, 2027, d(2, 1, 2028))).toBe(100);
  });
});

describe("milestones plan", () => {
  const plan = {
    type: "milestones" as const,
    baseline: 0,
    steps: [
      { date: "2027-03-15", value: 1 },
      { date: "2027-06-30", value: 2 },
      { date: "2027-11-01", value: 5 },
    ],
  };

  it("uses the baseline before the first step", () => {
    expect(planValueOn(plan, 5, 2027, d(1, 1))).toBe(0);
    expect(planValueOn(plan, 5, 2027, d(3, 14))).toBe(0);
  });

  it("steps up on each step's date and stays flat between steps", () => {
    expect(planValueOn(plan, 5, 2027, d(3, 15))).toBe(1);
    expect(planValueOn(plan, 5, 2027, d(5, 1))).toBe(1);
    expect(planValueOn(plan, 5, 2027, d(6, 29))).toBe(1);
    expect(planValueOn(plan, 5, 2027, d(6, 30))).toBe(2);
    expect(planValueOn(plan, 5, 2027, d(10, 31))).toBe(2);
    expect(planValueOn(plan, 5, 2027, d(12, 31))).toBe(5);
  });

  it("does not depend on step order", () => {
    const shuffled = { ...plan, steps: [plan.steps[2]!, plan.steps[0]!, plan.steps[1]!] };
    expect(planValueOn(shuffled, 5, 2027, d(7, 1))).toBe(2);
  });

  it("is the baseline with no steps", () => {
    expect(planValueOn({ type: "milestones", baseline: 3, steps: [] }, 5, 2027, d(7, 1))).toBe(3);
  });
});
