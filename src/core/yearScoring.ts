/**
 * Year metric scoring (brief › Scoring rules). Pure.
 *
 * On pace: the current value is at least paceTolerance × the plan value today.
 * Pace delta: current value minus plan value, in the metric's own unit.
 * Labels: delta ≥ 0 → "X ahead of pace"; delta < 0 but on pace →
 * "On pace (−X)"; not on pace → "X behind pace".
 * No value yet counts as 0 (like a weekly week with no data).
 */
import type { ScoreboardConfig, YearMetricConfig } from "./config";
import { formatValue } from "./format";
import type { Score } from "./score";
import { calendarDateIn, type CalendarDate } from "./week";
import { dayOfYearIndex } from "./planCurve";

export type YearPaceState = "ahead" | "on-pace" | "behind";

export interface YearStatus {
  state: YearPaceState;
  /** Value minus plan value today (negative when below plan). */
  delta: number;
  onPace: boolean;
}

/** The pace tolerance for a metric: its override, else the global one. */
export function paceToleranceFor(metric: YearMetricConfig, config: Pick<ScoreboardConfig, "paceTolerance">): number {
  return metric.paceTolerance ?? config.paceTolerance;
}

/** The on-pace rule. */
export function isOnPace(value: number | null, planValue: number, tolerance: number): boolean {
  return (value ?? 0) >= tolerance * planValue;
}

/** A year metric's status against its plan value today. */
export function yearStatus(value: number | null, planValue: number, tolerance: number): YearStatus {
  const delta = (value ?? 0) - planValue;
  const onPace = isOnPace(value, planValue, tolerance);
  const state: YearPaceState = delta >= 0 ? "ahead" : onPace ? "on-pace" : "behind";
  return { state, delta, onPace };
}

/** Rounds a pace delta for display: whole numbers from 10 up, else one decimal. */
export function roundPaceDelta(n: number): number {
  const abs = Math.abs(n);
  return abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10;
}

/** Row copy: "£150 ahead of pace", "On pace (−£40)" or "2 behind pace". */
export function yearStatusLabel(status: YearStatus, unit: string): string {
  const x = formatValue(roundPaceDelta(status.delta), unit);
  switch (status.state) {
    case "ahead":
      return `${x} ahead of pace`;
    case "on-pace":
      return `On pace (−${x})`;
    case "behind":
      return `${x} behind pace`;
  }
}

/** Year to date score: year metrics on pace / number of year metrics. */
export function yearToDateScore(statuses: readonly YearStatus[]): Score {
  return { achieved: statuses.filter((s) => s.onPace).length, total: statuses.length };
}

/** A manual year value older than this many days shows "updated N wks ago". */
export const OLD_MANUAL_VALUE_DAYS = 28;

/**
 * Whole weeks since a manual value was entered, if it is more than 4 weeks
 * old; null otherwise (or if `enteredAt` is unreadable). `today` and the
 * entry's date are both calendar dates in `timeZone`.
 */
export function manualValueWeeksOld(enteredAt: string, today: CalendarDate, timeZone: string): number | null {
  const ms = Date.parse(enteredAt);
  if (Number.isNaN(ms)) return null;
  const entered = calendarDateIn(new Date(ms), timeZone);
  const days = dayOfYearIndex(today, entered.year) - dayOfYearIndex(entered, entered.year);
  return days > OLD_MANUAL_VALUE_DAYS ? Math.floor(days / 7) : null;
}

/** "updated 5 wks ago" */
export function updatedWeeksAgoLabel(weeks: number): string {
  return `updated ${weeks} wk${weeks === 1 ? "" : "s"} ago`;
}
