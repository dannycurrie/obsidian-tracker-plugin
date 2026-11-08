import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allMetrics } from "./config";
import { validateConfigText } from "./configValidation";

const text = readFileSync(new URL("../../examples/scoreboard.yaml", import.meta.url), "utf8");

describe("examples/scoreboard.yaml (the real 2027 config)", () => {
  it("passes full validation with no problems", () => {
    expect(validateConfigText(text).problems).toEqual([]);
  });

  it("defines the brief's 11 metrics with their kinds, targets, plan curves and sources", () => {
    const { config } = validateConfigText(text);
    const linear = { type: "linear", baseline: 0 };
    const ramp = { type: "quarterly", baseline: 0, quarters: [10, 50, 80, 100] };
    const manual = { type: "manual" };
    const tracker = { type: "tracker", aggregate: "sum" };
    const rows = allMetrics(config!).map((m) => ({
      goal: m.goalId,
      id: m.id,
      kind: m.kind,
      level: m.level,
      target: m.kind === "untargeted" ? null : m.target,
      plan: m.kind === "year" ? m.plan : null,
      source: m.source.type,
    }));
    expect(rows).toEqual([
      { goal: "finances", id: "vanguard-saved", kind: "year", level: false, target: 12000, plan: linear, source: "manual" },
      { goal: "finances", id: "mortgage-overpayment", kind: "year", level: false, target: 10000, plan: linear, source: "manual" },
      { goal: "career", id: "tengu-wau", kind: "weekly", level: true, target: 25, plan: null, source: "manual" },
      { goal: "career", id: "asl-requests", kind: "year", level: true, target: 100, plan: ramp, source: "manual" },
      { goal: "career", id: "react-migration", kind: "year", level: true, target: 100, plan: ramp, source: "manual" },
      { goal: "family", id: "homework-n", kind: "weekly", level: false, target: 60, plan: null, source: "tracker" },
      { goal: "family", id: "time-with-s", kind: "year", level: false, target: 12, plan: linear, source: "manual" },
      { goal: "self", id: "meditation", kind: "weekly", level: false, target: 100, plan: null, source: "tracker" },
      { goal: "self", id: "feedback-given", kind: "weekly", level: false, target: 10, plan: null, source: "tracker" },
      { goal: "creative", id: "music-practice", kind: "weekly", level: false, target: 60, plan: null, source: "manual" },
      { goal: "creative", id: "eps", kind: "year", level: false, target: 5, plan: linear, source: "manual" },
    ]);
    for (const m of allMetrics(config!)) {
      expect(m.source).toMatchObject(m.source.type === "tracker" ? tracker : manual);
    }
    expect(config!.goals.every((g) => g.statement.length > 0)).toBe(true);
    expect(config!.paceTolerance).toBe(0.95);
  });
});
