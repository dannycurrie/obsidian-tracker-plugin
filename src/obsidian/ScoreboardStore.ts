/**
 * View state for the Scoreboard: loads the config and data file and hands
 * them to the UI. No `obsidian` imports (IO through TextFileIO; clock
 * injected), so it is unit-tested with fakes.
 *
 * Extension points:
 * - `reload()` is what Refresh calls. Ticket 04 (snapshots) and 07 (tracker)
 *   hook in after config + data are loaded; add steps there.
 * - `updateData(patch)` is the only way to write the data file.
 * - `loadConfig` is injectable; ticket 06 can pass its validating loader.
 *   Config rule: a config with no problems becomes the current config; one
 *   with problems is shown only if there is no earlier valid config
 *   (otherwise the last valid config is kept). `configProblems` always lists
 *   the current file's problems.
 */
import { loadConfigFromYaml, type ConfigLoadResult } from "../core/configLoad";
import type { DataPatch } from "../core/data";
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
}

export type Listener = (state: ScoreboardState) => void;

export class ScoreboardStore {
  private state: ScoreboardState = initialScoreboardState();
  private readonly listeners = new Set<Listener>();
  private readonly loadConfig: (text: string) => ConfigLoadResult;

  constructor(private readonly deps: ScoreboardStoreDeps) {
    this.loadConfig = deps.loadConfig ?? loadConfigFromYaml;
  }

  getState(): ScoreboardState {
    return this.state;
  }

  /** Calls `listener` on every state change. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-reads the config and data files. Never throws; errors land in state. */
  async reload(): Promise<void> {
    const next: Partial<ScoreboardState> = {};
    const path = this.deps.configPath();
    try {
      const text = await this.deps.io.read(path);
      if (text === null) {
        Object.assign(next, { configError: `No config file at "${path}". Set the path in settings or create the file.`, configProblems: [] });
      } else {
        const result = this.loadConfig(text);
        const valid = result.config !== null && result.problems.length === 0;
        next.configError = null;
        next.configProblems = result.problems;
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
    this.set({ ...next, status: "ready", loadedAt: this.deps.now().toISOString() });
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
