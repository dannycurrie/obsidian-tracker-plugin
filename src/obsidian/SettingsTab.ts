import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS, type ScoreboardSettings } from "../core/settings";
import type ScoreboardPlugin from "./main";

type TextSettingKey = keyof ScoreboardSettings;

interface TextSettingSpec {
  key: TextSettingKey;
  name: string;
  desc: string;
  multiline?: boolean;
  secret?: boolean;
}

const SPECS: TextSettingSpec[] = [
  { key: "configPath", name: "Config file", desc: "Vault path of the YAML file that defines goals, metrics and targets." },
  { key: "dataFilePath", name: "Data file", desc: "Vault path of the JSON file holding manual entries and week snapshots." },
  { key: "planNotePath", name: "2027 Plan note", desc: "Vault path of the note that receives scoreboard entries on export." },
  { key: "projectsFolder", name: "Projects folder", desc: "Folder (subfolders included) scanned for strategic project notes." },
  { key: "trackerApiUrl", name: "Tracker API URL", desc: "Base URL of the tracker Metrics API." },
  {
    key: "trackerApiKey",
    name: "Tracker API key",
    desc: "Bearer key for the tracker Metrics API. Stored in this plugin's data.json, which sits in the vault folder and may sync.",
    secret: true,
  },
  { key: "coachingChatUrl", name: "Coaching chat URL", desc: "Full link (https://claude.ai/chat/…) to your ongoing coaching chat in the 2027 Planning project. Start coaching chat opens it; while empty it opens the claude.ai projects page instead." },
  {
    key: "coachingPromptTemplate",
    name: "Coaching prompt template",
    desc: "Last line of the coaching context message. Leave empty to use the default.",
    multiline: true,
  },
];

export class ScoreboardSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ScoreboardPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "Pace tolerance is set in the config file (paceTolerance), not here.",
      cls: "setting-item-description",
    });

    for (const spec of SPECS) {
      if (spec.key === "trackerApiKey") {
        this.addTrackerApiKey(containerEl, spec);
        continue;
      }
      const setting = new Setting(containerEl).setName(spec.name).setDesc(spec.desc);
      const onChange = async (value: string) => {
        this.plugin.settings[spec.key] = value;
        await this.plugin.saveSettings();
      };
      const placeholder = DEFAULT_SETTINGS[spec.key];
      if (spec.multiline) {
        setting.addTextArea((text) =>
          text.setPlaceholder(placeholder).setValue(this.plugin.settings[spec.key]).onChange(onChange),
        );
      } else {
        setting.addText((text) => {
          text.setPlaceholder(placeholder).setValue(this.plugin.settings[spec.key]).onChange(onChange);
          if (spec.secret) text.inputEl.type = "password";
        });
      }
    }
  }

  /** The API key: Obsidian's secret storage when this version has it, else this plugin's data.json. */
  private addTrackerApiKey(containerEl: HTMLElement, spec: TextSettingSpec): void {
    const key = this.plugin.trackerApiKey;
    const desc = key.usesSecretStorage
      ? "Bearer key for the tracker Metrics API. Stored in Obsidian's secret storage, not in the vault folder or any note; you may need to enter it on each device."
      : spec.desc;
    new Setting(containerEl)
      .setName(spec.name)
      .setDesc(desc)
      .addText((text) => {
        text.setPlaceholder("Paste the API key").setValue(key.get()).onChange(async (value) => {
          await key.set(value.trim());
        });
        text.inputEl.type = "password";
      });
  }
}
