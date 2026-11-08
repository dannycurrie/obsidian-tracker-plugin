/**
 * View state for the Scoreboard: loads the config and data file and hands
 * them to the UI. No `obsidian` imports (IO through TextFileIO; clock
 * injected), so it is unit-tested with fakes.
 *
 * Extension points:
 * - `reload()` is what Refresh (and the view's open and 15-minute timer)
 *   calls. After config + data are loaded it runs the source adapters
 *   (`sourcesStep`, ticket 07: e.g. the tracker fetch writes week values into
 *   snapshots), then the week snapshot step (ticket 04, `snapshotStep`).
 *   Overlapping calls share the reload in flight.
 * - `updateData(patch)` is the only way to write the data file.
 * - `loadConfig` is injectable; it defaults to full validation
 *   (`validateConfigText`, core/configValidation.ts).
 *   Config rule: a config with no problems becomes the current config; one
 *   with problems is shown only if there is no earlier valid config
 *   (otherwise the last valid config is kept). `configProblems` always lists
 *   the current file's problems, then source-adapter problems.
 * - `setSourceProblems(adapterId, problems)` (ticket 07 hook): an adapter
 *   reports config problems it can only find at runtime, e.g. an unknown
 *   tracker metric id with the list of available ids. They are given line
 *   numbers from the current config file, merged into `configProblems` (so
 *   the banner lists them and `configValidationState` blocks export) and kept
 *   until the same adapter reports again; pass [] once the problem is gone.
 */
import { parseYamlSource, type ConfigLoadResult, type ConfigProblem } from "../core/configLoad";
import type { SourceAdapter, SourceRefreshResult } from "../adapters/types";
import { resolveSourceProblems, type SourceProblem } from "../core/configStatus";
import { validateConfigText } from "../core/configValidation";
import type { DataPatch } from "../core/data";
import { snapshotRefreshPatch } from "../core/snapshots";
import type { SourceStatus } from "../core/sources";
import { calendarDateIn } from "../core/week";
import { initialScoreboardState, type ScoreboardState } from "../core/viewState";
import type { DataFileRepository } from "./DataFileRepository";
import type { TextFileIO } from "./io";

export type { ScoreboardState } from "../core/viewState";

export interface ScoreboardStoreDeps {
  io: TextFileIO;
  configPath: () => string;
  data: DataFileRepository;
  now: () => Date;
  loadConfig?: (text: string) => ConfigLoadResult;
  /** Source adapters run on every reload (ticket 07). Default none. */
  adapters?: readonly SourceAdapter[];
}

export type Listener = (state: ScoreboardState) => void;

export class ScoreboardStore {
  private state: ScoreboardState = initialScoreboardState();
  private readonly listeners = new Set<Listener>();
  private readonly loadConfig: (text: string) => ConfigLoadResult;
  /** Problems in the config file as last read, and its text (for source-problem lines). */
  private fileProblems: ConfigProblem[] = [];
  private configText: string | null = null;
  /** adapterId -> problems it reported (ticket 07). */
  private readonly sourceProblems = new Map<string, readonly SourceProblem[]>();
  private inflight: Promise<void> | null = null;

  constructor(private readonly deps: ScoreboardStoreDeps) {
    this.loadConfig = deps.loadConfig ?? validateConfigText;
  }

  getState(): ScoreboardState {
    return this.state;
  }

  /** Calls `listener` on every state change. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Re-reads the config and data files and refreshes the sources. Never
   * throws; errors land in state. A call while one is running shares it.
   */
  reload(): Promise<void> {
    if (!this.inflight) {
      this.inflight = this.doReload().finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private async doReload(): Promise<void> {
    const next: Partial<ScoreboardState> = {};
    const path = this.deps.configPath();
    try {
      const text = await this.deps.io.read(path);
      if (text === null) {
        Object.assign(next, { configError: `No config file at "${path}". Set the path in settings or create the file.` });
        this.fileProblems = [];
        this.configText = null;
      } else {
        const result = this.loadConfig(text);
        const valid = result.config !== null && result.problems.length === 0;
        next.configError = null;
        this.fileProblems = result.problems;
        this.configText = text;
        if (valid) Object.assign(next, { config: result.config, configValid: true });
        else if (!this.state.configValid) next.config = result.config ?? this.state.config;
      }
    } catch (e) {
      next.configError = `Could not read the config file: ${(e as Error).message}`;
    }
    try {
      next.data = await this.deps.data.load();
      next.dataError = null;
    } catch (e) {
      next.dataError = (e as Error).message;
    }
    await this.sourcesStep(next);
    const configValid = next.configValid ?? this.state.configValid;
    const fileBroken = this.fileProblems.length > 0 || (next.configError ?? this.state.configError) !== null;
    Object.assign(next, { configProblems: this.mergedProblems(), usingLastValidConfig: fileBroken && configValid });
    await this.snapshotStep(next);
    this.set({ ...next, status: "ready", loadedAt: this.deps.now().toISOString() });
  }

  /**
   * Ticket 07 hook: replaces the config problems `adapterId` found at
   * runtime (e.g. unknown tracker metric id). Pass [] when they are fixed.
   * See the module doc.
   */
  setSourceProblems(adapterId: string, problems: readonly SourceProblem[]): void {
    if (problems.length === 0) this.sourceProblems.delete(adapterId);
    else this.sourceProblems.set(adapterId, problems);
    this.set({ configProblems: this.mergedProblems() });
  }

  /** The current file's problems, then every adapter's (with lines from the current file). */
  private mergedProblems(): ConfigProblem[] {
    const fromSources = [...this.sourceProblems.values()].flat();
    if (fromSources.length === 0) return this.fileProblems;
    const source = this.configText === null ? null : parseYamlSource(this.configText);
    return [...this.fileProblems, ...resolveSourceProblems(source, fromSources)];
  }

  /**
   * Source adapters (ticket 07): each one reads its source and writes what
   * it read into the data file before the snapshot step. Records each
   * adapter's status (keeping the last successful fetch time when one fails)
   * and replaces its runtime config problems unless it couldn't tell.
   * Skipped without a valid config or a readable data file.
   */
  private async sourcesStep(next: Partial<ScoreboardState>): Promise<void> {
    const adapters = this.deps.adapters ?? [];
    const config = next.config ?? this.state.config;
    const valid = next.configValid ?? this.state.configValid;
    if (adapters.length === 0 || !config || !valid || !next.data || next.dataError) return;
    const sources: Record<string, SourceStatus> = { ...this.state.sources };
    for (const adapter of adapters) {
      const now = this.deps.now();
      const result: SourceRefreshResult = await adapter.refresh({ config, data: next.data, now }).catch((e: unknown) => ({
        status: { ok: false, error: e instanceof Error ? e.message : String(e), failedAt: now.toISOString(), lastFetchedAt: null },
        patch: [],
        problems: null,
      }));
      if (result.problems) {
        if (result.problems.length === 0) this.sourceProblems.delete(adapter.id);
        else this.sourceProblems.set(adapter.id, result.problems);
      }
      const status = result.status;
      if (!status) delete sources[adapter.id];
      else if (status.ok) sources[adapter.id] = status;
      else {
        const prev = sources[adapter.id];
        const lastFetchedAt = prev ? (prev.ok ? prev.fetchedAt : prev.lastFetchedAt) : null;
        sources[adapter.id] = { ...status, lastFetchedAt: status.lastFetchedAt ?? lastFetchedAt };
      }
      if (result.patch.length === 0) continue;
      try {
        next.data = (await this.deps.data.update(result.patch)).data;
      } catch (e) {
        next.dataError = (e as Error).message;
        break;
      }
    }
    next.sources = sources;
  }

  /**
   * Week snapshots (ticket 04): records the current week and freezes ended
   * weeks. Writes only if a value or verdict changed; skipped without a valid
   * config or a readable data file.
   */
  private async snapshotStep(next: Partial<ScoreboardState>): Promise<void> {
    const config = next.config ?? this.state.config;
    const valid = next.configValid ?? this.state.configValid;
    if (!config || !valid || !next.data || next.dataError) return;
    const now = this.deps.now();
    const patch = snapshotRefreshPatch(config, next.data, calendarDateIn(now, config.timezone), now.toISOString());
    if (patch.length === 0) return;
    try {
      next.data = (await this.deps.data.update(patch)).data;
    } catch (e) {
      next.dataError = (e as Error).message;
    }
  }

  /**
   * Writes a patch to the data file (re-read, patch, write if changed) and
   * updates state. Throws, writing nothing, if the data file is unreadable.
   */
  async updateData(patch: DataPatch): Promise<{ changed: boolean }> {
    try {
      const { data, changed } = await this.deps.data.update(patch);
      this.set({ data, dataError: null });
      return { changed };
    } catch (e) {
      this.set({ dataError: (e as Error).message });
      throw e;
    }
  }

  private set(partial: Partial<ScoreboardState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l(this.state);
  }
}
