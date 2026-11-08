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
import { vaultTextIO } from "./vaultIO";

/** How often the view re-renders so the week label rolls over at midnight (London). */
const CLOCK_TICK_MS = 60_000;

export class ScoreboardView extends ItemView {
  private store: ScoreboardStore | null = null;
  private unsubscribe: (() => void) | null = null;

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
    this.renderApp();
    this.registerInterval(window.setInterval(() => this.renderApp(), CLOCK_TICK_MS));
    await store.reload();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    render(null, this.contentEl);
  }

  /** Re-reads config and data (the Refresh button). */
  async reload(): Promise<void> {
    await this.store?.reload();
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
        onRefresh={() => void store.reload()}
        onEnterValues={() => new EnterValuesModal(this.app, store).open()}
      />,
      this.contentEl,
    );
  }
}
