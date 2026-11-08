/**
 * The config validation state derived from the view state (ticket 06), and
 * the orphaned-history warning. Pure: no Obsidian imports.
 *
 * Features that must not run on a broken config ask here:
 *
 *   const v = configValidationState(store.getState());
 *   if (v.blocksActions) { new Notice(v.blockedReason); return; }   // e.g. Export (ticket 09)
 *
 * The state covers the config file as it is now (YAML and field problems)
 * plus problems reported at runtime by source adapters (unknown tracker id,
 * ticket 07), which the store merges into `configProblems`.
 */
import { allMetrics, type ScoreboardConfig } from "./config";
import type { ConfigPath, ConfigProblem, YamlSource } from "./configLoad";
import type { ScoreboardData } from "./data";
import type { ScoreboardState } from "./viewState";

export type ConfigValidationStatus =
  /** The first reload hasn't finished. */
  | "loading"
  /** The config file reads with no problems. */
  | "valid"
  /** The config file has problems (or a source adapter reported one). */
  | "invalid"
  /** The config file couldn't be read at all (e.g. missing). */
  | "unreadable";

export interface ConfigValidationState {
  status: ConfigValidationStatus;
  /** Problems to fix, with line numbers where known. */
  problems: readonly ConfigProblem[];
  /** Why the file couldn't be read, when status is "unreadable". */
  error: string | null;
  /** True when the view is showing an earlier valid config instead of the current file. */
  usingLastValid: boolean;
  /** True unless status is "valid": export and similar actions must refuse to run. */
  blocksActions: boolean;
  /** Human-readable reason to show when refusing; null when not blocked. */
  blockedReason: string | null;
  /** Warnings that don't block anything (history for ids no longer in the config). */
  orphanedHistory: readonly OrphanedHistory[];
}

/** Records in the data file for a metric id the config no longer has. */
export interface OrphanedHistory {
  metricId: string;
  /** Number of weeks with a manual weekly entry. */
  weeklyEntries: number;
  /** True if there is a latest manual value. */
  latestValue: boolean;
  /** Number of week snapshots that include the id. */
  snapshots: number;
}

/** Derives the validation state the banner shows and later features check. */
export function configValidationState(state: ScoreboardState): ConfigValidationState {
  const status: ConfigValidationStatus =
    state.status === "loading"
      ? "loading"
      : state.configError !== null
        ? "unreadable"
        : state.configProblems.length > 0 || state.config === null
          ? "invalid"
          : "valid";
  const blockedReason =
    status === "valid"
      ? null
      : status === "loading"
        ? "The scoreboard is still loading."
        : status === "unreadable"
          ? `The config file can't be read: ${state.configError}`
          : `The config file has ${countProblems(state.configProblems.length)}. Fix ${state.configProblems.length === 1 ? "it" : "them"} first (see the banner).`;
  return {
    status,
    problems: state.configProblems,
    error: state.configError,
    usingLastValid: state.usingLastValidConfig,
    blocksActions: status !== "valid",
    blockedReason,
    // Only against a valid config: a best-effort config has skipped metrics that would all look orphaned.
    orphanedHistory: state.config && state.configValid ? findOrphanedHistory(state.config, state.data) : [],
  };
}

/**
 * Metric ids with records in the data file (manual weekly entries, latest
 * manual values, week snapshots) that are not in the config. History is keyed
 * by id, so renaming an id orphans its history (no rename support in v1).
 * Sorted by id.
 */
export function findOrphanedHistory(config: ScoreboardConfig, data: ScoreboardData): OrphanedHistory[] {
  const known = new Set(allMetrics(config).map((m) => m.id));
  const found = new Map<string, OrphanedHistory>();
  const entry = (metricId: string): OrphanedHistory => {
    let e = found.get(metricId);
    if (!e) found.set(metricId, (e = { metricId, weeklyEntries: 0, latestValue: false, snapshots: 0 }));
    return e;
  };
  for (const [id, weeks] of Object.entries(data.manual.weekly)) {
    const n = Object.keys(weeks).length;
    if (!known.has(id) && n > 0) entry(id).weeklyEntries += n;
  }
  for (const id of Object.keys(data.manual.latest)) {
    if (!known.has(id)) entry(id).latestValue = true;
  }
  for (const snap of Object.values(data.snapshots)) {
    for (const id of Object.keys(snap.metrics)) {
      if (!known.has(id)) entry(id).snapshots += 1;
    }
  }
  return [...found.values()].sort((a, b) => a.metricId.localeCompare(b.metricId));
}

/** "a problem" / "3 problems". */
export function countProblems(n: number): string {
  return n === 1 ? "a problem" : `${n} problems`;
}

/**
 * A config problem a source adapter finds at runtime (ticket 07), e.g. a
 * tracker `metric` id the API doesn't know. The message can span several
 * lines (e.g. the list of available tracker metric names and ids); the
 * banner keeps the line breaks.
 */
export interface SourceProblem {
  /** The metric whose source is wrong. */
  metricId: string;
  /** Path inside the metric, e.g. ["source", "metric"]. Default ["source"]. */
  field?: ConfigPath;
  message: string;
}

/**
 * Turns source problems into config problems with the line of the metric's
 * field in the config file. Lines are left out if the metric isn't found.
 */
export function resolveSourceProblems(source: YamlSource | null, problems: readonly SourceProblem[]): ConfigProblem[] {
  return problems.map((p) => {
    const metric = source ? metricPath(source.value, p.metricId) : undefined;
    if (!metric || !source) return { message: p.message };
    const path = [...metric, ...(p.field ?? ["source"])];
    return { message: p.message, line: source.lineOf(path), path };
  });
}

/** Path of the metric with `metricId` in a parsed config document (first match). */
export function metricPath(value: unknown, metricId: string): ConfigPath | undefined {
  const goals = isRecord(value) && Array.isArray(value.goals) ? value.goals : [];
  for (const [gi, goal] of goals.entries()) {
    const metrics = isRecord(goal) && Array.isArray(goal.metrics) ? goal.metrics : [];
    const mi = metrics.findIndex((m) => isRecord(m) && m.id === metricId);
    if (mi >= 0) return ["goals", gi, "metrics", mi];
  }
  return undefined;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
