import { ItemView, type WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { DEFAULT_TIMEZONE } from "../core/config";
import { calendarDateIn } from "../core/week";
import { ScoreboardApp } from "../ui/ScoreboardApp";
import { SCOREBOARD_ICON, VIEW_TYPE_SCOREBOARD } from "./constants";
import { DataFileRepository } from "./DataFileRepository";
import { EnterValuesModal } from "./EnterValuesModal";
import type ScoreboardPlugin from "./main";
import { ScoreboardStore } from "./ScoreboardStore";
import { openProjectNote, readProjectNotes, watchProjectNotes } from "./projectNotes";
import { ProjectsStore } from "./ProjectsStore";
import { vaultTextIO } from "./vaultIO";

/** How often the view re-renders so the week label rolls over at midnight (London). */
const CLOCK_TICK_MS = 60_000;

export class ScoreboardView extends ItemView {
  private store: ScoreboardStore | null = null;
  private unsubscribe: (() => void) | null = null;
  private projects: ProjectsStore | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ScoreboardPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_SCOREBOARD;
  }

  getDisplayText(): string {
    return "Scoreboard";
  }

  getIcon(): string {
    return SCOREBOARD_ICON;
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("scoreboard-view");
    const io = vaultTextIO(this.app.vault.adapter);
    const store = new ScoreboardStore({
      io,
      configPath: () => this.plugin.settings.configPath,
      data: new DataFileRepository(io, () => this.plugin.settings.dataFilePath),
      now: () => new Date(),
    });
    this.store = store;
    this.unsubscribe = store.subscribe(() => this.renderApp());
    const projects = new ProjectsStore({ readNotes: () => readProjectNotes(this.app, this.plugin.settings.projectsFolder) });
    this.projects = projects;
    projects.subscribe(() => this.renderApp());
    watchProjectNotes(this, this.app, () => this.plugin.settings.projectsFolder, projects);
    void projects.reload();
    this.renderApp();
    this.registerInterval(window.setInterval(() => this.renderApp(), CLOCK_TICK_MS));
    await store.reload();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.projects?.dispose();
    this.projects = null;
    render(null, this.contentEl);
  }

  /** Re-reads config and data (the Refresh button). */
  async reload(): Promise<void> {
    await Promise.all([this.store?.reload(), this.projects?.reload()]);
  }

  /** Re-renders the Preact tree with the current state. */
  renderApp(): void {
    const store = this.store;
    if (!store) return;
    const state = store.getState();
    // Edge: the view's only clock read.
    const today = calendarDateIn(new Date(), state.config?.timezone ?? DEFAULT_TIMEZONE);
    render(
      <ScoreboardApp
        today={today}
        state={state}
        onRefresh={() => void this.reload()}
        onEnterValues={() => new EnterValuesModal(this.app, store).open()}
        projectNotes={this.projects?.getState().notes ?? null}
        onOpenNote={(path, evt) => openProjectNote(this.app, path, evt)}
      />,
      this.contentEl,
    );
  }
}
