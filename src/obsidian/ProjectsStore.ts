/**
 * Live list of strategic-project notes for the Scoreboard view (ticket 08).
 * Kept separate from ScoreboardStore: the notes are the source of truth, so
 * nothing here is persisted. No `obsidian` imports (the reader is injected),
 * so it is unit-tested with fakes; `projectNotes.ts` supplies the vault reader
 * and the change events that call `scheduleReload()`.
 */
import type { ProjectNote } from "../core/projects";

export interface ProjectsState {
  /** Null until the first read finishes. */
  notes: readonly ProjectNote[] | null;
  /** The notes couldn't be read; human-readable. */
  error: string | null;
}

export interface ProjectsStoreDeps {
  /** Reads every strategic-project note in the projects folder. */
  readNotes: () => Promise<ProjectNote[]>;
  /** Delay that batches bursts of change events into one read. Default 250 ms. */
  debounceMs?: number;
}

export type ProjectsListener = (state: ProjectsState) => void;

export class ProjectsStore {
  private state: ProjectsState = { notes: null, error: null };
  private readonly listeners = new Set<ProjectsListener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(private readonly deps: ProjectsStoreDeps) {}

  getState(): ProjectsState {
    return this.state;
  }

  /** Calls `listener` on every state change. Returns an unsubscribe function. */
  subscribe(listener: ProjectsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Re-reads the notes now. Never throws; a newer read wins over an older one. */
  async reload(): Promise<void> {
    this.cancelScheduled();
    const generation = ++this.generation;
    let next: ProjectsState;
    try {
      next = { notes: await this.deps.readNotes(), error: null };
    } catch (e) {
      next = { notes: this.state.notes, error: `Could not read project notes: ${(e as Error).message}` };
    }
    if (generation !== this.generation) return;
    if (JSON.stringify(next) === JSON.stringify(this.state)) return;
    this.state = next;
    for (const l of this.listeners) l(this.state);
  }

  /** Re-reads after a short quiet period (for vault / metadata change events). */
  scheduleReload(): void {
    this.cancelScheduled();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.reload();
    }, this.deps.debounceMs ?? 250);
  }

  /** Stops any pending read and ignores reads still in flight. */
  dispose(): void {
    this.cancelScheduled();
    this.generation++;
    this.listeners.clear();
  }

  private cancelScheduled(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
