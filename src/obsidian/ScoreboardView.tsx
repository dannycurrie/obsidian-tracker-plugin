import { ItemView, type WorkspaceLeaf } from "obsidian";
import { render } from "preact";
import { currentIsoWeek } from "../core/week";
import { ScoreboardApp } from "../ui/ScoreboardApp";
import { SCOREBOARD_ICON, VIEW_TYPE_SCOREBOARD } from "./constants";
import type ScoreboardPlugin from "./main";

/** How often the view re-renders so the week label rolls over at midnight (London). */
const CLOCK_TICK_MS = 60_000;

export class ScoreboardView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: ScoreboardPlugin) {
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
    this.renderApp();
    this.registerInterval(window.setInterval(() => this.renderApp(), CLOCK_TICK_MS));
  }

  async onClose(): Promise<void> {
    render(null, this.contentEl);
  }

  /** Re-renders the Preact tree with the current state. */
  renderApp(): void {
    const week = currentIsoWeek(new Date());
    render(<ScoreboardApp week={week} />, this.contentEl);
  }
}
