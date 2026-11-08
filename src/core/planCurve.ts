/**
 * Plan curves (brief › Data model, GLOSSARY "Plan curve"): the expected value
 * of a year metric on any date of calendar `year`. Pure; dates are passed in.
 *
 * The plan is evaluated per calendar day: 1 January is day 0 and has the
 * baseline value, 31 December is the last day and has the year-end value.
 * Dates before the year use the baseline; dates after it use the year-end value.
 *
 * - linear: baseline on 1 Jan to the metric's target on 31 Dec.
 * - quarterly: baseline on 1 Jan, then the Q1–Q4 values on 31 Mar, 30 Jun,
 *   30 Sep and 31 Dec, linearly interpolated between them.
 * - milestones: the baseline until the first step's date, then each step's
 *   value from its date on (flat between steps).
 */
import type { MilestonesPlanConfig, PlanCurveConfig, QuarterlyPlanConfig } from "./config";
import type { CalendarDate } from "./week";

const DAY_MS = 86_400_000;

function utcMs(d: CalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

/** Days from 1 January of `year` to `date` (negative before the year). */
export function dayOfYearIndex(date: CalendarDate, year: number): number {
  return Math.round((utcMs(date) - utcMs({ year, month: 1, day: 1 })) / DAY_MS);
}

/** Number of days in a calendar year (365 or 366). */
export function daysInYear(year: number): number {
  return dayOfYearIndex({ year: year + 1, month: 1, day: 1 }, year);
}

/** "YYYY-MM-DD", the format milestone dates use. */
export function calendarDateKey(d: CalendarDate): string {
  return `${String(d.year).padStart(4, "0")}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Piecewise-linear interpolation through (dayIndex, value) knots, clamped at both ends. */
function interpolate(knots: readonly [number, number][], day: number): number {
  const first = knots[0]!;
  const last = knots[knots.length - 1]!;
  if (day <= first[0]) return first[1];
  if (day >= last[0]) return last[1];
  for (let i = 1; i < knots.length; i++) {
    const [d1, v1] = knots[i]!;
    if (day <= d1) {
      const [d0, v0] = knots[i - 1]!;
      return v0 + ((v1 - v0) * (day - d0)) / (d1 - d0);
    }
  }
  return last[1];
}

/** Quarter-end days (31 Mar, 30 Jun, 30 Sep, 31 Dec) as day indexes of `year`. */
export function quarterEndDays(year: number): [number, number, number, number] {
  return [
    dayOfYearIndex({ year, month: 3, day: 31 }, year),
    dayOfYearIndex({ year, month: 6, day: 30 }, year),
    dayOfYearIndex({ year, month: 9, day: 30 }, year),
    dayOfYearIndex({ year, month: 12, day: 31 }, year),
  ];
}

function linearPlanValue(baseline: number, target: number, year: number, date: CalendarDate): number {
  return interpolate(
    [
      [0, baseline],
      [daysInYear(year) - 1, target],
    ],
    dayOfYearIndex(date, year),
  );
}

function quarterlyPlanValue(plan: QuarterlyPlanConfig, year: number, date: CalendarDate): number {
  const ends = quarterEndDays(year);
  return interpolate(
    [[0, plan.baseline], ...ends.map((d, i): [number, number] => [d, plan.quarters[i]!])],
    dayOfYearIndex(date, year),
  );
}

function milestonesPlanValue(plan: MilestonesPlanConfig, date: CalendarDate): number {
  const key = calendarDateKey(date);
  // The latest step on or before `date` (steps are sorted, but don't rely on it).
  let best: { date: string; value: number } | null = null;
  for (const step of plan.steps) if (step.date <= key && (!best || step.date >= best.date)) best = step;
  return best ? best.value : plan.baseline;
}

/**
 * The plan value of a year metric on `date`.
 * `target` is the metric's 31 December target (used by linear plans).
 */
export function planValueOn(plan: PlanCurveConfig, target: number, year: number, date: CalendarDate): number {
  switch (plan.type) {
    case "linear":
      return linearPlanValue(plan.baseline, target, year, date);
    case "quarterly":
      return quarterlyPlanValue(plan, year, date);
    case "milestones":
      return milestonesPlanValue(plan, date);
  }
}
