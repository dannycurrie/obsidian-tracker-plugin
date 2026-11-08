import { describe, expect, it } from "vitest";
import { exampleConfigText, sampleConfig, sampleConfigText } from "../../tests/fixtures/sampleConfig";
import { allMetrics, isEnteredPerWeek, manualMetrics } from "./config";
import { loadConfigFromYaml, parseYamlSource } from "./configLoad";

describe("loadConfigFromYaml", () => {
  it("reads the sample config without problems", () => {
    const { config, problems } = loadConfigFromYaml(sampleConfigText);
    expect(problems).toEqual([]);
    expect(config?.year).toBe(2027);
    expect(config?.timezone).toBe("Europe/London");
    expect(config?.paceTolerance).toBe(0.95);
    expect(config?.goals.map((g) => g.id)).toEqual(["career", "self", "creative"]);
  });

  it("reads the full example config: 5 goals, 5 weekly and 6 year metrics", () => {
    const { config, problems } = loadConfigFromYaml(exampleConfigText);
    expect(problems).toEqual([]);
    const metrics = allMetrics(config!);
    expect(config!.goals).toHaveLength(5);
    expect(metrics.filter((m) => m.kind === "weekly")).toHaveLength(5);
    expect(metrics.filter((m) => m.kind === "year")).toHaveLength(6);
    expect(manualMetrics(config!)).toHaveLength(8);
  });

  it("types every metric field", () => {
    const config = sampleConfig();
    const byId = Object.fromEntries(allMetrics(config).map((m) => [m.id, m]));
    expect(byId["tengu-wau"]).toMatchObject({
      kind: "weekly",
      level: true,
      target: 25,
      unit: "",
      goalId: "career",
      source: { type: "manual", cadence: "weekly" },
    });
    expect(byId["meditation"]).toMatchObject({
      kind: "weekly",
      level: false,
      unit: "min",
      source: { type: "tracker", metric: "00000000-0000-0000-0000-000000000001", aggregate: "sum" },
    });
    expect(byId["asl"]).toMatchObject({
      kind: "year",
      plan: { type: "quarterly", baseline: 0, quarters: [10, 50, 80, 100] },
      source: { type: "manual", cadence: "ad-hoc" },
    });
    expect(byId["eps"]).toMatchObject({ kind: "year", paceTolerance: 0.9, plan: { type: "linear", baseline: 0 } });
    expect(byId["gigs"]).toMatchObject({ kind: "untargeted", source: { type: "manual", cadence: "weekly" } });
    expect(byId["gigs"]).not.toHaveProperty("target");
  });

  it("decides per-week vs latest-value entry from kind and cadence", () => {
    const byId = Object.fromEntries(allMetrics(sampleConfig()).map((m) => [m.id, m]));
    expect(isEnteredPerWeek(byId["music-practice"]!)).toBe(true);
    expect(isEnteredPerWeek(byId["eps"]!)).toBe(false);
    expect(isEnteredPerWeek(byId["gigs"]!)).toBe(true);
  });

  it("reads milestones plans, sorted by date", () => {
    const { config, problems } = loadConfigFromYaml(`
year: 2027
goals:
  - id: creative
    metrics:
      - id: eps
        kind: year
        target: 5
        source: { type: manual }
        plan:
          type: milestones
          steps:
            - { date: "2027-09-30", value: 3 }
            - { date: 2027-03-31, value: 1 }
`);
    expect(problems).toEqual([]);
    expect(allMetrics(config!)[0]).toMatchObject({
      plan: {
        type: "milestones",
        baseline: 0,
        steps: [
          { date: "2027-03-31", value: 1 },
          { date: "2027-09-30", value: 3 },
        ],
      },
    });
  });

  it("reports YAML syntax errors with a line number and returns no config", () => {
    const { config, problems } = loadConfigFromYaml("year: 2027\ngoals:\n  - id: a\n    name: [oops\n");
    expect(config).toBeNull();
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]!.message).toMatch(/^YAML error/);
    expect(problems[0]!.line).toBeGreaterThanOrEqual(4);
  });

  it("reports a duplicate key with its line", () => {
    const { config, problems } = loadConfigFromYaml("year: 2027\nyear: 2028\n");
    expect(config).toBeNull();
    expect(problems[0]!.line).toBe(2);
  });

  it("skips a metric with a missing target, reporting the line, and keeps the rest", () => {
    const { config, problems } = loadConfigFromYaml(`year: 2027
goals:
  - id: self
    name: Self
    metrics:
      - id: meditation
        kind: weekly
        source: { type: manual }
      - id: feedback
        kind: weekly
        target: 10
        source: { type: manual }
`);
    expect(allMetrics(config!).map((m) => m.id)).toEqual(["feedback"]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ line: 6, path: ["goals", 0, "metrics", 0, "target"] });
    expect(problems[0]!.message).toContain("meditation");
  });

  it("reports unknown kind, source type and plan type, and duplicate ids", () => {
    const { problems } = loadConfigFromYaml(`year: 2027
goals:
  - id: g
    metrics:
      - { id: a, kind: monthly, target: 1, source: { type: manual } }
      - { id: b, kind: weekly, target: 1, source: { type: sheets } }
      - { id: c, kind: year, target: 1, plan: { type: wobbly }, source: { type: manual } }
      - { id: d, kind: weekly, target: 1, source: { type: manual } }
      - { id: d, kind: weekly, target: 1, source: { type: manual } }
`);
    expect(problems.map((p) => p.line)).toEqual([5, 6, 7, 9]);
  });

  it("does not throw on non-mapping documents", () => {
    expect(loadConfigFromYaml("").config).toBeNull();
    expect(loadConfigFromYaml("- a\n- b\n").config).toBeNull();
    expect(loadConfigFromYaml("just text").problems).toHaveLength(1);
  });

  it("defaults timezone and pace tolerance", () => {
    const { config } = loadConfigFromYaml("year: 2027\ngoals: []\n");
    expect(config).toMatchObject({ timezone: "Europe/London", paceTolerance: 0.95, goals: [] });
  });
});

describe("parseYamlSource.lineOf", () => {
  it("finds a node's line, falling back to the nearest existing ancestor", () => {
    const src = parseYamlSource("year: 2027\ngoals:\n  - id: a\n    metrics:\n      - id: m\n");
    expect(src.lineOf(["goals", 0, "metrics", 0, "id"])).toBe(5);
    expect(src.lineOf(["goals", 0, "metrics", 0, "target"])).toBe(5);
    expect(src.lineOf(["goals"])).toBe(3);
  });
});
