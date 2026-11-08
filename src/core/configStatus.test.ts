import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { parseYamlSource } from "./configLoad";
import { configValidationState, findOrphanedHistory, metricPath, resolveSourceProblems } from "./configStatus";
import { emptyScoreboardData } from "./data";
import { initialScoreboardState, type ScoreboardState } from "./viewState";

function ready(overrides: Partial<ScoreboardState> = {}): ScoreboardState {
  return { ...initialScoreboardState(), status: "ready", config: sampleConfig(), configValid: true, ...overrides };
}

describe("configValidationState", () => {
  it("is valid and blocks nothing when the config has no problems", () => {
    expect(configValidationState(ready())).toMatchObject({
      status: "valid",
      blocksActions: false,
      blockedReason: null,
      orphanedHistory: [],
    });
  });

  it("blocks while loading", () => {
    expect(configValidationState(initialScoreboardState())).toMatchObject({ status: "loading", blocksActions: true });
  });

  it("is invalid with problems, even while showing the last valid config", () => {
    const v = configValidationState(
      ready({ configProblems: [{ message: "x", line: 3 }, { message: "y" }], usingLastValidConfig: true }),
    );
    expect(v).toMatchObject({ status: "invalid", blocksActions: true, usingLastValid: true });
    expect(v.blockedReason).toBe("The config file has 2 problems. Fix them first (see the banner).");
  });

  it("is unreadable when the file can't be read", () => {
    const v = configValidationState(ready({ configError: "No config file." }));
    expect(v).toMatchObject({ status: "unreadable", blocksActions: true, error: "No config file." });
    expect(v.blockedReason).toContain("No config file.");
  });

  it("is invalid without any config", () => {
    expect(configValidationState(ready({ config: null, configValid: false })).status).toBe("invalid");
  });

  it("includes orphaned history only against a valid config", () => {
    const data = emptyScoreboardData();
    data.manual.latest["old-id"] = { value: 1, enteredAt: "x" };
    expect(configValidationState(ready({ data })).orphanedHistory.map((o) => o.metricId)).toEqual(["old-id"]);
    expect(configValidationState(ready({ data, configValid: false })).orphanedHistory).toEqual([]);
  });
});

describe("findOrphanedHistory", () => {
  it("finds ids in manual weekly entries, latest values and snapshots that the config lacks", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: "x" } };
    data.manual.weekly["practice"] = { "2027-W17": { value: 1, enteredAt: "x" }, "2027-W18": { value: 2, enteredAt: "x" } };
    data.manual.weekly["empty"] = {};
    data.manual.latest["eps"] = { value: 1, enteredAt: "x" };
    data.manual.latest["saved"] = { value: 1, enteredAt: "x" };
    data.snapshots["2027-W17"] = {
      frozen: true,
      updatedAt: "x",
      metrics: { meditation: { value: 1, target: 1 }, practice: { value: 1, target: 60 }, wau: { value: 3, target: 25 } },
    };
    expect(findOrphanedHistory(sampleConfig(), data)).toEqual([
      { metricId: "practice", weeklyEntries: 2, latestValue: false, snapshots: 1 },
      { metricId: "saved", weeklyEntries: 0, latestValue: true, snapshots: 0 },
      { metricId: "wau", weeklyEntries: 0, latestValue: false, snapshots: 1 },
    ]);
  });

  it("is empty when every id is in the config (labels may change freely)", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 1, enteredAt: "x" };
    expect(findOrphanedHistory(sampleConfig(), data)).toEqual([]);
  });
});

describe("resolveSourceProblems", () => {
  const text = "year: 2027\ngoals:\n  - id: self\n    metrics:\n      - id: meditation\n        kind: weekly\n        source:\n          type: tracker\n          metric: nope\n";

  it("finds the metric's path and line in the config text", () => {
    const source = parseYamlSource(text);
    expect(metricPath(source.value, "meditation")).toEqual(["goals", 0, "metrics", 0]);
    expect(
      resolveSourceProblems(source, [
        { metricId: "meditation", field: ["source", "metric"], message: "Unknown tracker metric id." },
        { metricId: "meditation", message: "Source failed." },
        { metricId: "gone", message: "Not in config." },
      ]),
    ).toEqual([
      { message: "Unknown tracker metric id.", line: 9, path: ["goals", 0, "metrics", 0, "source", "metric"] },
      { message: "Source failed.", line: 8, path: ["goals", 0, "metrics", 0, "source"] },
      { message: "Not in config." },
    ]);
  });

  it("leaves lines out without config text", () => {
    expect(resolveSourceProblems(null, [{ metricId: "m", message: "x" }])).toEqual([{ message: "x" }]);
  });
});
