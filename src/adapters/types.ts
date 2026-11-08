/**
 * Source adapter interface (brief › Data sources and auto-update). Each
 * metric's `source.type` in the config names one adapter; the store calls
 * every adapter's `refresh` on view open, on Refresh and every 15 minutes,
 * before the week snapshot step. No `obsidian` imports: anything
 * platform-specific (HTTP, vault reads) is injected, so adapters are
 * unit-tested with fakes.
 *
 * An adapter doesn't hand values to the UI directly. It writes what it read
 * into the data file (`patch`, e.g. tracker week values into week
 * snapshots), which `core/values.ts` reads, so values survive restarts and
 * a failed refresh leaves the last good value in place.
 *
 * Manual entry needs no refresh step (values are written by the Enter values
 * form and read by `core/values.ts`), so it has no adapter object. Later
 * adapters (daily notes, tag counts) implement this interface and add a
 * branch to `metricWeekValue` / `metricLatestValue` if their values live
 * somewhere new.
 */
import type { ScoreboardConfig } from "../core/config";
import type { SourceProblem } from "../core/configStatus";
import type { DataPatch, ScoreboardData } from "../core/data";
import type { SourceStatus } from "../core/sources";

export interface SourceRefreshContext {
  /** The config in use (the last valid one). */
  config: ScoreboardConfig;
  /** The data file as just loaded. */
  data: ScoreboardData;
  /** The refresh instant (the store's clock). */
  now: Date;
}

export interface SourceRefreshResult {
  /**
   * Outcome of this refresh; null when the adapter had nothing to do (no
   * metric in the config uses it), so no status is shown for it.
   */
  status: SourceStatus | null;
  /** Data-file changes; empty when nothing changed (then nothing is written). */
  patch: DataPatch;
  /**
   * Config problems found at runtime (e.g. unknown tracker id), replacing the
   * adapter's earlier ones; [] clears them. Null = couldn't tell this time
   * (e.g. the request failed): keep the earlier ones.
   */
  problems: readonly SourceProblem[] | null;
}

export interface SourceAdapter {
  /** The `source.type` it serves, e.g. "tracker". Also its key in `ScoreboardState.sources`. */
  readonly id: string;
  /** Reads the source. Must not throw: failures come back as a failed status. */
  refresh(ctx: SourceRefreshContext): Promise<SourceRefreshResult>;
}
