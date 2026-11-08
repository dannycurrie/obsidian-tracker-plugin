/**
 * The tracker Metrics API, pure part (brief › Data sources › Tracker API):
 * the request window and URL, parsing and validating a response (or error
 * body), and summing day buckets into ISO weeks. No Obsidian imports, no
 * clock: callers pass `today`. The HTTP call itself is in
 * `src/adapters/trackerAdapter.ts`.
 *
 * API facts relied on (dannycurrie/tracker `server/README.md`, PRD 008):
 * - `GET /v1/metrics?from&to&granularity=day`, bearer key, window `[from, to)`.
 * - One call returns every metric: `{ granularity, metrics: [{ id, name, type, periods: [...] }] }`.
 * - With `granularity=day`, `cumulative` / `timed` / `average` metrics get one
 *   bucket per calendar day in `USER_TZ` (Europe/London): `start` and `end`
 *   are local midnights with their offset, so the clocks-forward Sunday is
 *   23 h and the clocks-back Sunday 25 h. Checklists keep their own
 *   timeframe (a weekly checklist bucket is a whole ISO week).
 * - Every bucket has `entryCount` and `value` (minutes for `timed`, sums for
 *   `cumulative`; `null` for an `average` with no entries).
 * - Errors: `{ error: { code, message } }` with a 4xx/5xx status.
 */
import { allMetrics, isEnteredPerWeek, type MetricConfig, type ScoreboardConfig, type TrackerAggregate } from "./config";
import type { SourceProblem } from "./configStatus";
import type { DataPatchOp, ScoreboardData } from "./data";
import { snapshotValuePatch } from "./snapshots";
import type { MetricValue } from "./values";
import {
  addDays,
  addWeeks,
  calendarDateIn,
  compareIsoWeeks,
  isoWeekKey,
  isoWeekOf,
  isoWeekStart,
  type CalendarDate,
  type IsoWeek,
} from "./week";

/** Completed weeks before the current one that each fetch covers (the history strip's 8). */
export const TRACKER_HISTORY_WEEKS = 8;

/** One bucket (a day, or a checklist's own period). */
export interface TrackerBucket {
  start: string;
  end: string;
  entryCount: number;
  /** Null for an `average` metric with no entries. */
  value: number | null;
}

export interface TrackerMetric {
  id: string;
  name: string;
  type: string;
  periods: TrackerBucket[];
}

export interface TrackerResponse {
  granularity: string;
  metrics: TrackerMetric[];
}

/** The request window: Monday of 8 weeks before the current ISO week to the Monday after it. */
export interface TrackerWindow {
  /** ISO weeks covered, oldest first (8 completed weeks, then the current week). */
  weeks: IsoWeek[];
  /** `from`: local midnight starting the first week, with its offset. */
  from: string;
  /** `to` (exclusive): local midnight after the current week ends. */
  to: string;
}

export function trackerWindow(today: CalendarDate, timeZone: string): TrackerWindow {
  const current = isoWeekOf(today);
  const weeks: IsoWeek[] = [];
  for (let i = TRACKER_HISTORY_WEEKS; i >= 0; i--) weeks.push(addWeeks(current, -i));
  const first = isoWeekStart(weeks[0]!);
  const end = addDays(isoWeekStart(current), 7);
  return { weeks, from: localMidnightIso(first, timeZone), to: localMidnightIso(end, timeZone) };
}

/** The request URL. `encodeURIComponent` writes the `+` of an offset as `%2B`. */
export function trackerRequestUrl(baseUrl: string, window: Pick<TrackerWindow, "from" | "to">): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const q = `from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}&granularity=day`;
  return `${base}/v1/metrics?${q}`;
}

/** A tracker request that failed: HTTP error, error body, or a body this build can't read. */
export class TrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackerError";
  }
}

/**
 * Parses a response (status + body text). Throws TrackerError for a 4xx/5xx
 * (with the API's error code and message when the body has them), for a body
 * that isn't the documented shape, and for a server that didn't apply
 * `granularity=day`.
 */
export function parseTrackerResponse(status: number, text: string): TrackerResponse {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  if (status >= 400 || (isRecord(body) && isRecord(body.error))) {
    const err = isRecord(body) && isRecord(body.error) ? body.error : null;
    const code = err && typeof err.code === "string" ? err.code : null;
    const message = err && typeof err.message === "string" ? err.message : null;
    const detail = code ? `${code}${message ? `: ${message}` : ""}` : message ?? "no error details";
    throw new TrackerError(`Tracker API error (HTTP ${status}): ${detail}`);
  }
  if (body === undefined) throw new TrackerError("Tracker API returned a body that isn't JSON.");
  if (!isRecord(body) || !Array.isArray(body.metrics)) {
    throw new TrackerError("Tracker API response has no `metrics` list.");
  }
  if (body.granularity !== "day") {
    throw new TrackerError(
      `Tracker API returned granularity ${JSON.stringify(body.granularity)}, not "day"; the server may be out of date.`,
    );
  }
  const metrics = body.metrics.map((m, i): TrackerMetric => {
    if (!isRecord(m) || typeof m.id !== "string" || !Array.isArray(m.periods)) {
      throw new TrackerError(`Tracker API response: metric ${i + 1} has no id or periods.`);
    }
    const name = typeof m.name === "string" ? m.name : m.id;
    const periods = m.periods.map((p, j): TrackerBucket => {
      const ok =
        isRecord(p) &&
        typeof p.start === "string" &&
        !Number.isNaN(Date.parse(p.start)) &&
        typeof p.end === "string" &&
        !Number.isNaN(Date.parse(p.end)) &&
        isFiniteNumber(p.entryCount) &&
        (p.value === null || isFiniteNumber(p.value));
      if (!ok) throw new TrackerError(`Tracker API response: bucket ${j + 1} of "${name}" is malformed.`);
      return { start: p.start as string, end: p.end as string, entryCount: p.entryCount as number, value: p.value as number | null };
    });
    return { id: m.id, name, type: typeof m.type === "string" ? m.type : "", periods };
  });
  return { granularity: "day", metrics };
}

/** One ISO week's totals for one tracker metric. */
export interface TrackerWeekTotal {
  /** Sum of bucket values (null values count as 0). */
  value: number;
  /** Sum of entry counts. */
  entryCount: number;
}

const HOUR_MS = 3_600_000;

/**
 * Sums a metric's buckets into ISO weeks (key → totals). Each bucket is
 * placed by the calendar date of its midpoint in `timeZone`, so a 23 h or
 * 25 h DST day lands on its own date. Buckets longer than a day (a
 * checklist's own period) are only used if they span exactly one ISO week;
 * others (e.g. monthly) can't be split and are skipped.
 */
export function weekTotals(metric: TrackerMetric, timeZone: string): Map<string, TrackerWeekTotal> {
  const out = new Map<string, TrackerWeekTotal>();
  for (const b of metric.periods) {
    const startMs = Date.parse(b.start);
    const endMs = Date.parse(b.end);
    const hours = (endMs - startMs) / HOUR_MS;
    let weekKey: string;
    if (hours > 0 && hours <= 25) {
      weekKey = isoWeekKey(isoWeekOf(calendarDateIn(new Date((startMs + endMs) / 2), timeZone)));
    } else if (hours >= 167 && hours <= 169) {
      const startWeek = isoWeekOf(calendarDateIn(new Date(startMs + HOUR_MS), timeZone));
      const endWeek = isoWeekOf(calendarDateIn(new Date(endMs - HOUR_MS), timeZone));
      if (isoWeekKey(startWeek) !== isoWeekKey(endWeek)) continue;
      weekKey = isoWeekKey(startWeek);
    } else {
      continue;
    }
    const t = out.get(weekKey) ?? { value: 0, entryCount: 0 };
    t.value += b.value ?? 0;
    t.entryCount += b.entryCount;
    out.set(weekKey, t);
  }
  return out;
}

/** A week's value under an aggregate: `sum` → bucket values, `count` → entry counts. */
export function aggregateWeek(total: TrackerWeekTotal, aggregate: TrackerAggregate): number {
  return aggregate === "count" ? total.entryCount : total.value;
}

/**
 * The config problem for a tracker id the API doesn't know: lists every
 * available tracker metric's name and id so one can be copied in.
 */
export function unknownTrackerIdMessage(metricLabel: string, id: string, available: readonly TrackerMetric[]): string {
  const list = available.length > 0 ? available.map((m) => `- ${m.name}: ${m.id}`).join("\n") : "(none)";
  return `Metric "${metricLabel}": tracker metric id "${id}" isn't in the tracker. Available tracker metrics (name: id):\n${list}`;
}

/** Local midnight starting `date` in `timeZone`, as ISO-8601 with an offset, e.g. "2026-10-26T00:00:00+00:00". */
export function localMidnightIso(date: CalendarDate, timeZone: string): string {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  // Midnight is never inside a DST gap in Europe/London; re-check the offset at the found instant anyway.
  let offset = offsetMinutes(guess, timeZone);
  offset = offsetMinutes(guess - offset * 60_000, timeZone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
  return `${ymd}T00:00:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** The zone's UTC offset in minutes at an instant (e.g. +60 for BST). */
function offsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((local - Math.floor(ms / 1000) * 1000) / 60_000);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** What one successful fetch changes: snapshot ops, and config problems (unknown ids). */
export interface TrackerApplyResult {
  patch: DataPatchOp[];
  problems: SourceProblem[];
}

/**
 * Turns a fetched response into data-file ops: for every per-week tracker
 * metric and every week in the window, the week's value goes into that
 * week's snapshot (`snapshotValuePatch`), frozen weeks included: offline
 * entries can arrive late, so tracker values always follow the API, while a
 * frozen week's target never changes. Weeks with no buckets (before the
 * tracker metric existed) are left alone. Ops are only emitted for values
 * that changed. A config id the API doesn't list becomes a SourceProblem.
 */
export function trackerApply(
  config: ScoreboardConfig,
  data: ScoreboardData,
  response: TrackerResponse,
  window: TrackerWindow,
  nowIso: string,
): TrackerApplyResult {
  const byId = new Map(response.metrics.map((m) => [m.id, m]));
  const current = window.weeks[window.weeks.length - 1]!;
  const patch: DataPatchOp[] = [];
  const problems: SourceProblem[] = [];
  for (const metric of trackerMetrics(config)) {
    if (metric.source.type !== "tracker") continue;
    const source = metric.source;
    const tracked = byId.get(source.metric);
    if (!tracked) {
      problems.push({
        metricId: metric.id,
        field: ["source", "metric"],
        message: unknownTrackerIdMessage(metric.label, source.metric, response.metrics),
      });
      continue;
    }
    const totals = weekTotals(tracked, config.timezone);
    for (const week of window.weeks) {
      const weekKey = isoWeekKey(week);
      const total = totals.get(weekKey);
      if (!total) continue;
      const value: MetricValue = { value: aggregateWeek(total, source.aggregate), source: "tracker", at: nowIso };
      const ended = compareIsoWeeks(week, current) < 0;
      patch.push(...snapshotValuePatch(data, metric, weekKey, value, ended, nowIso));
    }
  }
  return { patch, problems };
}

/** Metrics the tracker adapter serves: tracker sources on per-week metrics (weekly, untargeted). */
export function trackerMetrics(config: ScoreboardConfig): MetricConfig[] {
  return allMetrics(config).filter((m) => m.source.type === "tracker" && isEnteredPerWeek(m));
}
