import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, resolveSettings } from "./settings";

describe("settings", () => {
  it("defaults to the brief's emoji paths", () => {
    expect(DEFAULT_SETTINGS.configPath).toBe("🗺️ Plans/🎯 2027 Plan/scoreboard.yaml");
    expect(DEFAULT_SETTINGS.dataFilePath).toBe("🗺️ Plans/🎯 2027 Plan/scoreboard-data.json");
    expect(DEFAULT_SETTINGS.planNotePath).toBe("🗺️ Plans/🎯 2027 Plan/2027 Plan.md");
    expect(DEFAULT_SETTINGS.projectsFolder).toBe("🚀 Projects/");
    expect(DEFAULT_SETTINGS.trackerApiUrl).toBe("https://tracker-metrics-api.vercel.app");
  });

  it("has no pace tolerance setting", () => {
    expect(Object.keys(DEFAULT_SETTINGS).some((k) => /pace|tolerance/i.test(k))).toBe(false);
  });

  it("merges stored values over defaults and drops unknown or mistyped keys", () => {
    const resolved = resolveSettings({ configPath: "x.yaml", paceTolerance: 0.9, coachingChatUrl: 42 });
    expect(resolved.configPath).toBe("x.yaml");
    expect(resolved.coachingChatUrl).toBe("");
    expect(resolved).not.toHaveProperty("paceTolerance");
  });

  it("returns defaults for missing data", () => {
    expect(resolveSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
