import { ItemView, type WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { createTrackerAdapter } from "../adapters/trackerAdapter";
import { DEFAULT_TIMEZONE } from "../core/config";
import { buildProjectsModel } from "../core/projects";
import { calendarDateIn } from "../core/week";
import { ScoreboardApp } from "../ui/ScoreboardApp";
import { SCOREBOARD_ICON, VIEW_TYPE_SCOREBOARD } from "./constants";
import { DataFileRepository } from "./DataFileRepository";
import { EnterValuesModal } from "./EnterValuesModal";
import { exportReviewWeek } from "./exportReviewWeek";
import { processPlanNote, showExportNotice } from "./planNote";
import { obsidianHttpGet } from "./http";
import type ScoreboardPlugin from "./main";
import { ScoreboardStore } from "./ScoreboardStore";
import { openProjectNote, readProjectNotes, watchProjectNotes } from "./projectNotes";
import { ProjectsStore } from "./ProjectsStore";
import { vaultTextIO } from "./vaultIO";

/** How often the view re-renders so the week label rolls over at midnight (London). */
const CLOCK_TICK_MS = 60_000;
/** Auto refresh (sources, config, data) while the view is open (brief › Data sources). */
const AUTO_REFRESH_MS = 15 * 60_000;

export class ScoreboardView extends ItemView {
  private store: ScoreboardStore | null = null;
  private unsubscribe: (() => void) | null = null;
  private projects: ProjectsStore | null = null;
  private exporting = false;

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
      adapters: [
        createTrackerAdapter({
          http: obsidianHttpGet,
          apiUrl: () => this.plugin.settings.trackerApiUrl,
          apiKey: () => this.plugin.trackerApiKey.get(),
        }),
      ],
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
    this.registerInterval(window.setInterval(() => void this.reload(), AUTO_REFRESH_MS));
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

  /**
   * Export to Obsidian: refreshes first (so the entry shows the latest
   * values), then writes the review week's entry and data (exportReviewWeek)
   * and shows the outcome. Clicks while an export runs are ignored.
   */
  async exportToNote(): Promise<void> {
    const store = this.store;
    const projects = this.projects;
    if (!store || !projects || this.exporting) return;
    this.exporting = true;
    try {
      await this.reload();
      const state = store.getState();
      const notes = projects.getState().notes;
      const outcome = await exportReviewWeek({
        state,
        projects: notes ? buildProjectsModel(notes, state.config?.goals ?? null).active : null,
        now: new Date(),
        planNotePath: this.plugin.settings.planNotePath,
        processNote: (path, fn) => processPlanNote(this.app, path, fn),
        updateData: (patch) => store.updateData(patch),
      });
      showExportNotice(this.app, outcome);
    } finally {
      this.exporting = false;
    }
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
        onExport={() => void this.exportToNote()}
        projectNotes={this.projects?.getState().notes ?? null}
        onOpenNote={(path, evt) => openProjectNote(this.app, path, evt)}
      />,
      this.contentEl,
    );
  }
}
