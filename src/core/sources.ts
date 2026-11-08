/**
 * Source status at runtime and staleness (brief › Rules: "A failing adapter
 * shows that metric as stale with its last good value and its age. It never
 * shows zero."). Pure.
 *
 * Each source adapter (src/adapters) reports one status per refresh. A
 * metric whose adapter failed keeps showing its last good value (for the
 * tracker: the week snapshot values in the data file, which survive
 * restarts), marked stale with that value's age.
 */
import type { MetricConfig } from "./config";
import type { MetricRowModel } from "./rows/types";
import type { MetricValue } from "./values";

/** The outcome of an adapter's last refresh. */
export type SourceStatus =
  | {
      ok: true;
      /** ISO instant of the successful fetch. */
      fetchedAt: string;
    }
  | {
      ok: false;
      /** Human-readable reason, e.g. "Tracker API error (HTTP 401): unauthorized: …". */
      error: string;
      /** ISO instant of the failed attempt. */
      failedAt: string;
      /** ISO instant of the last successful fetch in this session, if any. */
      lastFetchedAt: string | null;
    };

/** adapterId -> status of its last refresh. Adapters that have nothing to fetch have no entry. */
export type SourceStatuses = Readonly<Record<string, SourceStatus>>;

/** The adapter id serving a metric's source: its source type ("tracker", "manual", …). */
export function adapterIdOf(metric: MetricConfig): string {
  return metric.source.type;
}

/**
 * A value as shown, given its adapter's last status:
 * - ok: the fetch time becomes the value's time (the stored time is when the
 *   value last changed; the fetch confirms it is current).
 * - failed: stale, aged from the last good fetch (this session) or, after a
 *   restart, from when the stored value was recorded.
 */
export function withSourceStatus(value: MetricValue | null, status: SourceStatus | undefined): MetricValue | null {
  if (!value || !status || value.source === "manual") return value;
  if (status.ok) return { ...value, at: status.fetchedAt };
  const at = status.lastFetchedAt ?? value.at;
  return { ...value, at, stale: { error: status.error, failedAt: status.failedAt } };
}

/** Applies source statuses to a row's value (rows of other shapes pass through). */
export function rowWithSourceStatus<R extends MetricRowModel>(row: R, statuses: SourceStatuses): R {
  const status = statuses[adapterIdOf(row.metric)];
  if (!status) return row;
  const value = withSourceStatus(row.value, status);
  return value === row.value ? row : { ...row, value };
}

/** Applies source statuses to every row of a model's goal cards (other fields are kept). */
export function modelWithSourceStatus<G extends { rows: MetricRowModel[] }, M extends { goals: G[] }>(
  model: M,
  statuses: SourceStatuses,
): M {
  if (Object.keys(statuses).length === 0) return model;
  return { ...model, goals: model.goals.map((g) => ({ ...g, rows: g.rows.map((r) => rowWithSourceStatus(r, statuses)) })) };
}

/** Display names of adapters, for header lines. */
const ADAPTER_NAMES: Record<string, string> = { tracker: "Tracker" };

/** One line per failing source, e.g. "Tracker: No tracker API key set. …". */
export function sourceErrorLines(statuses: SourceStatuses): string[] {
  return Object.entries(statuses)
    .filter(([, s]) => !s.ok)
    .map(([id, s]) => `${ADAPTER_NAMES[id] ?? id}: ${s.ok ? "" : s.error}`);
}

/** A stale value's age in whole hours/days, e.g. "3 h old", "2 days old", "under 1 h old". */
export function staleAgeLabel(value: MetricValue): string | null {
  if (!value.stale) return null;
  const ms = Date.parse(value.stale.failedAt) - Date.parse(value.at);
  if (Number.isNaN(ms)) return "age unknown";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "under 1 h old";
  if (hours < 48) return `${hours} h old`;
  return `${Math.floor(hours / 24)} days old`;
}
