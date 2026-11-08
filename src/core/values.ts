/**
 * Resolving a metric's value from its source. Pure.
 *
 * Every value carries its source and timestamp (brief › Rules: hovering a
 * value shows both). Ticket 07 adds the tracker branch; until then tracker
 * metrics have no value.
 */
import { isEnteredPerWeek, type MetricConfig } from "./config";
import type { ScoreboardData } from "./data";

export type ValueSource = "manual" | "tracker";

export interface MetricValue {
  value: number;
  source: ValueSource;
  /** ISO instant: when it was entered (manual) or fetched (tracker). */
  at: string;
}

/** A single timestamped reading within a week. */
export interface Reading {
  value: number;
  /** ISO instant. */
  at: string;
}

/**
 * A week's value from its readings: the total for an accumulating metric,
 * or the latest reading for a level metric. Null when there are none.
 */
export function combineWeekReadings(readings: readonly Reading[], level: boolean): number | null {
  if (readings.length === 0) return null;
  if (!level) return readings.reduce((sum, r) => sum + r.value, 0);
  let latest = readings[0]!;
  for (const r of readings) if (Date.parse(r.at) >= Date.parse(latest.at)) latest = r;
  return latest.value;
}

/** The manual entry for a metric in one ISO week (one entry per week; a new one replaces it). */
export function manualWeekValue(data: ScoreboardData, metricId: string, weekKey: string): MetricValue | null {
  const entry = data.manual.weekly[metricId]?.[weekKey];
  return entry ? { value: entry.value, source: "manual", at: entry.enteredAt } : null;
}

/** A metric's latest manual value (year running total, or ad-hoc reading). */
export function manualLatestValue(data: ScoreboardData, metricId: string): MetricValue | null {
  const entry = data.manual.latest[metricId];
  return entry ? { value: entry.value, source: "manual", at: entry.enteredAt } : null;
}

/** A per-week metric's value for an ISO week, from whichever source it has. */
export function metricWeekValue(metric: MetricConfig, data: ScoreboardData, weekKey: string): MetricValue | null {
  if (metric.source.type === "manual") return manualWeekValue(data, metric.id, weekKey);
  return null; // tracker: ticket 07
}

/** A latest-value metric's current value (year metrics, ad-hoc untargeted). */
export function metricLatestValue(metric: MetricConfig, data: ScoreboardData): MetricValue | null {
  if (metric.source.type === "manual") return manualLatestValue(data, metric.id);
  return null; // tracker: ticket 07
}

/** The value shown now: this week's for per-week metrics, else the latest. */
export function metricCurrentValue(
  metric: MetricConfig,
  data: ScoreboardData,
  currentWeekKey: string,
): MetricValue | null {
  return isEnteredPerWeek(metric) ? metricWeekValue(metric, data, currentWeekKey) : metricLatestValue(metric, data);
}
