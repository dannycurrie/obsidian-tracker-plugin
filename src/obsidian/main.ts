import { Plugin, type WorkspaceLeaf } from "obsidian";
import { resolveSettings, type ScoreboardSettings } from "../core/settings";
import { SCOREBOARD_ICON, VIEW_TYPE_SCOREBOARD } from "./constants";
import { ScoreboardSettingTab } from "./SettingsTab";
import { ScoreboardView } from "./ScoreboardView";

export default class ScoreboardPlugin extends Plugin {
  settings!: ScoreboardSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_SCOREBOARD, (leaf) => new ScoreboardView(leaf, this));

    this.addRibbonIcon(SCOREBOARD_ICON, "Open scoreboard", () => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-scoreboard",
      name: "Open scoreboard",
      callback: () => {
        void this.activateView();
      },
    });

    this.addSettingTab(new ScoreboardSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = resolveSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Reveals the existing Scoreboard leaf, or opens one in a new tab. */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_SCOREBOARD)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE_SCOREBOARD, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
}
