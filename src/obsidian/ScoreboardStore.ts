/**
 * View state for the Scoreboard: loads the config and data file and hands
 * them to the UI. No `obsidian` imports (IO through TextFileIO; clock
 * injected), so it is unit-tested with fakes.
 *
 * Extension points:
 * - `reload()` is what Refresh calls. Ticket 04 (snapshots) and 07 (tracker)
 *   hook in after config + data are loaded; add steps there.
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
import { resolveSourceProblems, type SourceProblem } from "../core/configStatus";
import { validateConfigText } from "../core/configValidation";
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
  /** Problems in the config file as last read, and its text (for source-problem lines). */
  private fileProblems: ConfigProblem[] = [];
  private configText: string | null = null;
  /** adapterId -> problems it reported (ticket 07). */
  private readonly sourceProblems = new Map<string, readonly SourceProblem[]>();

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

  /** Re-reads the config and data files. Never throws; errors land in state. */
  async reload(): Promise<void> {
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
    const configValid = next.configValid ?? this.state.configValid;
    const fileBroken = this.fileProblems.length > 0 || (next.configError ?? this.state.configError) !== null;
    Object.assign(next, { configProblems: this.mergedProblems(), usingLastValidConfig: fileBroken && configValid });
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
