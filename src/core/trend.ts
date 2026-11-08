/**
 * Untargeted metric trend (brief › Screen layout): the 8-week strip with no
 * hit/miss verdict, and the change against 4 weeks ago. Pure.
 *
 * A past week's value is its week snapshot's stored value, falling back to
 * the source for per-week metrics (weekly-cadence manual, tracker) not yet
 * snapshotted. Ad-hoc metrics have only a latest value, so their past weeks
 * come from snapshots alone (each refresh records the latest value into the
 * running week's snapshot). As for weekly history, weeks before the first
 * week with any data are not shown; a later week with no data shows as such.
 */
import { isEnteredPerWeek, type MetricConfig } from "./config";
import type { ScoreboardData } from "./data";
import { formatValue } from "./format";
import { firstDataWeek, HISTORY_WEEKS } from "./history";
import { metricWeekValue } from "./values";
import { addWeeks, compareIsoWeeks, isoWeekKey, type IsoWeek } from "./week";

/** One completed week on an untargeted metric's strip. */
export interface TrendWeek {
  week: IsoWeek;
  weekKey: string;
  /** Null = no data that week. */
  value: number | null;
}

/** Weeks back the change is measured against. */
export const TREND_CHANGE_WEEKS = 4;

export type TrendDirection = "up" | "down" | "flat";

export interface TrendChange {
  /** Current value minus the value 4 weeks ago. */
  delta: number;
  direction: TrendDirection;
}

/** A metric's recorded value for one week, or null. */
export function trendWeekValue(metric: MetricConfig, data: ScoreboardData, week: IsoWeek): number | null {
  const weekKey = isoWeekKey(week);
  const stored = data.snapshots[weekKey]?.metrics[metric.id]?.value;
  if (stored !== undefined && stored !== null) return stored;
  return isEnteredPerWeek(metric) ? (metricWeekValue(metric, data, weekKey)?.value ?? null) : null;
}

/** The last 8 completed weeks before `current`, oldest first, none before the first data week. */
export function trendHistory(metric: MetricConfig, data: ScoreboardData, current: IsoWeek): TrendWeek[] {
  const first = firstDataWeek(metric.id, data);
  if (!first) return [];
  const out: TrendWeek[] = [];
  for (let i = HISTORY_WEEKS; i >= 1; i--) {
    const week = addWeeks(current, -i);
    if (compareIsoWeeks(week, first) >= 0) {
      out.push({ week, weekKey: isoWeekKey(week), value: trendWeekValue(metric, data, week) });
    }
  }
  return out;
}

/** Change from `past` to `now`; null when either is missing. */
export function trendChange(now: number | null, past: number | null): TrendChange | null {
  if (now === null || past === null) return null;
  const delta = now - past;
  return { delta, direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat" };
}

/** The current value's change against the week 4 weeks before `current`. */
export function changeAgainstWeeksAgo(
  metric: MetricConfig,
  data: ScoreboardData,
  current: IsoWeek,
  currentValue: number | null,
): TrendChange | null {
  return trendChange(currentValue, trendWeekValue(metric, data, addWeeks(current, -TREND_CHANGE_WEEKS)));
}

const ARROWS: Record<TrendDirection, string> = { up: "↑", down: "↓", flat: "→" };

/** Row copy: "↑ 2 vs 4 wks ago", "↓ £150 vs 4 wks ago", "→ 0 vs 4 wks ago". */
export function trendChangeLabel(change: TrendChange, unit: string): string {
  const amount = formatValue(Math.round(Math.abs(change.delta) * 100) / 100, unit);
  return `${ARROWS[change.direction]} ${amount} vs ${TREND_CHANGE_WEEKS} wks ago`;
}
