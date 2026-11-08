/**
 * Weekly metric history: the 8-week strip and the streak (brief › Scoring
 * rules). Pure. Reads week snapshots from the data file (see snapshots.ts),
 * falling back to the metric's source for weeks not yet snapshotted.
 *
 * - A completed week is scored against its snapshot's stored target if it
 *   has one (always the case once frozen), else the config's target.
 * - A completed week with no value counts as missed.
 * - Weeks before the first week with any data for the metric are not shown
 *   and never counted.
 * - Streak: consecutive completed weeks hit, counting back from last week,
 *   plus the current week if already hit; never past the first data week.
 */
import type { WeeklyMetricConfig } from "./config";
import type { ScoreboardData } from "./data";
import { snapshotTarget } from "./snapshots";
import { metricWeekValue } from "./values";
import { addWeeks, compareIsoWeeks, isoWeekKey, parseIsoWeekKey, type IsoWeek } from "./week";
import { isWeeklyHit } from "./weeklyScoring";

/** Completed weeks shown in a weekly row's strip. */
export const HISTORY_WEEKS = 8;

/** One completed week in a weekly metric's history. */
export interface HistoryWeek {
  week: IsoWeek;
  /** ISO week key, e.g. "2027-W17". */
  weekKey: string;
  /** The week value; null = no data (missed). */
  value: number | null;
  /** The target the week is scored against (stored target once frozen). */
  target: number;
  hit: boolean;
}

/** A completed week's value and verdict. */
export function completedWeek(metric: WeeklyMetricConfig, data: ScoreboardData, week: IsoWeek): HistoryWeek {
  const weekKey = isoWeekKey(week);
  const snapshot = data.snapshots[weekKey];
  const stored = snapshot?.metrics[metric.id]?.value;
  const value = stored ?? metricWeekValue(metric, data, weekKey)?.value ?? null;
  const target = snapshotTarget(snapshot, metric, true) ?? metric.target;
  return { week, weekKey, value, target, hit: isWeeklyHit(value, target) };
}

/** The first week with any data for a metric (snapshot value or manual entry), or null. */
export function firstDataWeek(metricId: string, data: ScoreboardData): IsoWeek | null {
  const keys = Object.keys(data.manual.weekly[metricId] ?? {});
  for (const [key, snap] of Object.entries(data.snapshots)) {
    const v = snap.metrics[metricId]?.value;
    if (v !== undefined && v !== null) keys.push(key);
  }
  let first: IsoWeek | null = null;
  for (const key of keys) {
    const week = parseIsoWeekKey(key);
    if (week && (!first || compareIsoWeeks(week, first) < 0)) first = week;
  }
  return first;
}

/**
 * The last `HISTORY_WEEKS` completed weeks before `current`, oldest first,
 * leaving out weeks before the metric's first data week (so it may be shorter).
 */
export function weeklyHistory(metric: WeeklyMetricConfig, data: ScoreboardData, current: IsoWeek): HistoryWeek[] {
  const first = firstDataWeek(metric.id, data);
  if (!first) return [];
  const out: HistoryWeek[] = [];
  for (let i = HISTORY_WEEKS; i >= 1; i--) {
    const week = addWeeks(current, -i);
    if (compareIsoWeeks(week, first) >= 0) out.push(completedWeek(metric, data, week));
  }
  return out;
}

/** The streak: completed weeks hit counting back from last week, plus the current week if hit. */
export function weeklyStreak(
  metric: WeeklyMetricConfig,
  data: ScoreboardData,
  current: IsoWeek,
  currentWeekHit: boolean,
): number {
  let streak = currentWeekHit ? 1 : 0;
  const first = firstDataWeek(metric.id, data);
  if (!first) return streak;
  for (let week = addWeeks(current, -1); compareIsoWeeks(week, first) >= 0; week = addWeeks(week, -1)) {
    if (!completedWeek(metric, data, week).hit) break;
    streak++;
  }
  return streak;
}
