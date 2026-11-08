/**
 * Week snapshots (brief › Rules; GLOSSARY "Week snapshot"): the recorded
 * values and verdicts of every metric for one ISO week, kept in the data
 * file so history survives restarts and syncs across devices. Pure: no
 * Obsidian imports, no clock (callers pass `today` and `nowIso`).
 *
 * Lifecycle:
 * - While a week runs, its snapshot is updated on every refresh from the
 *   metrics' sources and the config's current targets.
 * - At the first refresh after the week ends it is frozen. A frozen snapshot
 *   keeps the target that applied that week (the one stored while it ran, or
 *   the config's at freeze time if it never had one) and is scored against it.
 * - Values of per-week metrics in frozen weeks still follow their source
 *   (a manual entry edited later; tracker values rewritten from the API,
 *   ticket 07, via `snapshotValuePatch`), but the target and `frozen` never
 *   change again.
 *
 * Writes are fine-grained (one op per metric line) so a concurrent change to
 * another line or week survives, and an op is only emitted when a value,
 * target or verdict actually changed: a refresh that changes nothing writes
 * nothing. A source with no value never wipes a recorded value here.
 */
import { allMetrics, isEnteredPerWeek, type MetricConfig, type ScoreboardConfig } from "./config";
import {
  setWeekSnapshot,
  type DataPatch,
  type DataPatchOp,
  type ScoreboardData,
  type WeekSnapshot,
  type WeekSnapshotMetric,
} from "./data";
import { metricLatestValue, metricWeekValue, type MetricValue } from "./values";
import { compareIsoWeeks, isoWeekKey, isoWeekOf, parseIsoWeekKey, type CalendarDate, type IsoWeek } from "./week";
import { weeklyStatus } from "./weeklyScoring";

/** Sets (or replaces) one metric's line in a week snapshot. */
export function setWeekSnapshotMetric(weekKey: string, metricId: string, line: WeekSnapshotMetric): DataPatchOp {
  return { path: ["snapshots", weekKey, "metrics", metricId], value: line };
}

/** Marks a week snapshot frozen. */
export function freezeWeekSnapshot(weekKey: string): DataPatchOp {
  return { path: ["snapshots", weekKey, "frozen"], value: true };
}

/** Sets a week snapshot's last-update instant. */
export function setWeekSnapshotUpdatedAt(weekKey: string, at: string): DataPatchOp {
  return { path: ["snapshots", weekKey, "updatedAt"], value: at };
}

/** A metric's target from the config: weekly and year targets; null for untargeted. */
function configTarget(metric: MetricConfig): number | null {
  return metric.kind === "untargeted" ? null : metric.target;
}

/**
 * The target a week's line is scored against. A running week uses the
 * config as it stands; a frozen or ended week keeps its stored target, or
 * takes the config's if it never stored one.
 */
export function snapshotTarget(snapshot: WeekSnapshot | undefined, metric: MetricConfig, weekEnded: boolean): number | null {
  if (!weekEnded && !snapshot?.frozen) return configTarget(metric);
  const stored = snapshot?.metrics[metric.id]?.target;
  return stored !== undefined && stored !== null ? stored : configTarget(metric);
}

/**
 * Builds one snapshot line. Weekly lines carry a verdict scored against
 * `target`; `weekEnded` decides between "missed" and "in-progress".
 */
export function snapshotLine(
  metric: MetricConfig,
  value: MetricValue | null,
  target: number | null,
  weekEnded: boolean,
): WeekSnapshotMetric {
  const line: WeekSnapshotMetric = { value: value?.value ?? null, target };
  if (metric.kind === "weekly" && target !== null) line.verdict = weeklyStatus(line.value, target, weekEnded).state;
  if (value) {
    line.source = value.source;
    line.fetchedAt = value.at;
  }
  return line;
}

/** A stored line re-scored against `target` (value and provenance kept). */
function rescored(metric: MetricConfig, stored: WeekSnapshotMetric, target: number | null, weekEnded: boolean): WeekSnapshotMetric {
  const line: WeekSnapshotMetric = { ...stored, target };
  delete line.verdict;
  if (metric.kind === "weekly" && target !== null) line.verdict = weeklyStatus(line.value, target, weekEnded).state;
  return line;
}

/** Whether a line differs in value, target or verdict (source or fetch time alone never cause a write). */
function lineChanged(before: WeekSnapshotMetric | undefined, after: WeekSnapshotMetric): boolean {
  return !before || before.value !== after.value || before.target !== after.target || before.verdict !== after.verdict;
}

/**
 * Ops that record `value` (null = no data) for one metric in one week,
 * keeping the week's stored target and frozen state: for a frozen week only
 * the value, and its verdict against the stored target, change. A missing
 * snapshot for an ended week is created frozen. Empty if nothing changed.
 *
 * Ticket 07: call with the tracker week values for every week in the fetch
 * window (frozen weeks included).
 */
export function snapshotValuePatch(
  data: ScoreboardData,
  metric: MetricConfig,
  weekKey: string,
  value: MetricValue | null,
  weekEnded: boolean,
  nowIso: string,
): DataPatchOp[] {
  const snapshot = data.snapshots[weekKey];
  const line = snapshotLine(metric, value, snapshotTarget(snapshot, metric, weekEnded), weekEnded);
  if (!lineChanged(snapshot?.metrics[metric.id], line)) return [];
  const ops = [setWeekSnapshotMetric(weekKey, metric.id, line), setWeekSnapshotUpdatedAt(weekKey, nowIso)];
  if (!snapshot && weekEnded) ops.push(freezeWeekSnapshot(weekKey));
  return ops;
}

/**
 * The snapshot step of a refresh: updates the current week's snapshot (every
 * metric, config targets), freezes snapshots of weeks that have ended,
 * creates frozen snapshots for ended weeks that have entries but no
 * snapshot, and brings per-week values in frozen weeks up to date with their
 * source. Never creates a snapshot with no values at all.
 */
export function snapshotRefreshPatch(
  config: ScoreboardConfig,
  data: ScoreboardData,
  today: CalendarDate,
  nowIso: string,
): DataPatch {
  const current = isoWeekOf(today);
  const currentKey = isoWeekKey(current);
  const metrics = allMetrics(config);
  const perWeek = metrics.filter(isEnteredPerWeek);
  const ops: DataPatchOp[] = [];

  ops.push(...weekOps(data, currentKey, metrics, false, nowIso, (m) => currentValue(m, data, currentKey)));

  for (const weekKey of endedWeekKeys(data, perWeek, current)) {
    const snapshot = data.snapshots[weekKey];
    // Only per-week metrics: a year metric's line keeps its value from when the week ran.
    ops.push(...weekOps(data, weekKey, perWeek, true, nowIso, (m) => metricWeekValue(m, data, weekKey)));
    if (snapshot && !snapshot.frozen) ops.push(freezeWeekSnapshot(weekKey), setWeekSnapshotUpdatedAt(weekKey, nowIso));
  }
  return ops;
}

/** Ops for the given metrics' lines in one week. */
function weekOps(
  data: ScoreboardData,
  weekKey: string,
  metrics: readonly MetricConfig[],
  weekEnded: boolean,
  nowIso: string,
  valueOf: (m: MetricConfig) => MetricValue | null,
): DataPatchOp[] {
  const snapshot = data.snapshots[weekKey];
  const lines = metrics.map((m): [MetricConfig, WeekSnapshotMetric] => {
    const target = snapshotTarget(snapshot, m, weekEnded);
    const value = valueOf(m);
    const stored = snapshot?.metrics[m.id];
    // A source with nothing (yet) never wipes a recorded value.
    if (!value && stored && stored.value !== null) return [m, rescored(m, stored, target, weekEnded)];
    return [m, snapshotLine(m, value, target, weekEnded)];
  });
  if (!snapshot) {
    if (!lines.some(([, l]) => l.value !== null)) return [];
    const out = Object.fromEntries(lines.map(([m, l]) => [m.id, l]));
    return [setWeekSnapshot(weekKey, { frozen: weekEnded, updatedAt: nowIso, metrics: out })];
  }
  const ops = lines
    .filter(([m, l]) => lineChanged(snapshot.metrics[m.id], l))
    .map(([m, l]) => setWeekSnapshotMetric(weekKey, m.id, l));
  if (ops.length > 0) ops.push(setWeekSnapshotUpdatedAt(weekKey, nowIso));
  return ops;
}

/** The value recorded for the current week: the week value for per-week metrics, else the latest. */
function currentValue(metric: MetricConfig, data: ScoreboardData, currentKey: string): MetricValue | null {
  return isEnteredPerWeek(metric) ? metricWeekValue(metric, data, currentKey) : metricLatestValue(metric, data);
}

/** Keys of weeks before `current` with a snapshot or a manual entry for a per-week metric, oldest first. */
function endedWeekKeys(data: ScoreboardData, perWeek: readonly MetricConfig[], current: IsoWeek): string[] {
  const keys = new Set(Object.keys(data.snapshots));
  for (const m of perWeek) for (const k of Object.keys(data.manual.weekly[m.id] ?? {})) keys.add(k);
  const weeks: { key: string; week: IsoWeek }[] = [];
  for (const key of keys) {
    const week = parseIsoWeekKey(key);
    if (week && compareIsoWeeks(week, current) < 0) weeks.push({ key, week });
  }
  return weeks.sort((a, b) => compareIsoWeeks(a.week, b.week)).map((w) => w.key);
}
