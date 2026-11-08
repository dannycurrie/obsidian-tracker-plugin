/**
 * Plugin settings shape and defaults. Pure: no Obsidian imports.
 * Pace tolerance is deliberately NOT a setting; it lives in the config file.
 */

export interface ScoreboardSettings {
  /** Vault path of the YAML config that defines goals, metrics and targets. */
  configPath: string;
  /** Vault path of the JSON data file (manual entries and week snapshots). */
  dataFilePath: string;
  /** Vault path of the 2027 Plan note that receives scoreboard entries. */
  planNotePath: string;
  /** Vault folder scanned (with subfolders) for strategic project notes. */
  projectsFolder: string;
  /** Base URL of the tracker Metrics API. */
  trackerApiUrl: string;
  /** Tracker API key. Plain setting for now; ticket 07 moves it to secret storage when available. */
  trackerApiKey: string;
  /** URL of the ongoing coaching chat on claude.ai. Empty means not set yet. */
  coachingChatUrl: string;
  /** Last line of the coaching context message. */
  coachingPromptTemplate: string;
}

export const DEFAULT_SETTINGS: ScoreboardSettings = {
  configPath: "🗺️ Plans/🎯 2027 Plan/scoreboard.yaml",
  dataFilePath: "🗺️ Plans/🎯 2027 Plan/scoreboard-data.json",
  planNotePath: "🗺️ Plans/🎯 2027 Plan/2027 Plan.md",
  projectsFolder: "🚀 Projects/",
  trackerApiUrl: "https://tracker-metrics-api.vercel.app",
  trackerApiKey: "",
  coachingChatUrl: "",
  coachingPromptTemplate:
    "Coach me on this week: challenge where I'm drifting and help me pick next week's focus.",
};

/**
 * Merges stored settings over the defaults, ignoring unknown keys and
 * values of the wrong type, so an old or hand-edited data.json can't break the plugin.
 */
export function resolveSettings(stored: unknown): ScoreboardSettings {
  const result: ScoreboardSettings = { ...DEFAULT_SETTINGS };
  if (stored === null || typeof stored !== "object") return result;
  const record = stored as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ScoreboardSettings)[]) {
    const value = record[key];
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
