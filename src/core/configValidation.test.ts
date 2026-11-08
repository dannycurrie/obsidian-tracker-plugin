import { describe, expect, it } from "vitest";
import { exampleConfigText, sampleConfigText } from "../../tests/fixtures/sampleConfig";
import { validateConfigText } from "./configValidation";

/** A config with one goal whose metrics are the given YAML lines (indented 6). Metric lines start at line 6. */
function withMetrics(...metricLines: string[]): string {
  return `year: 2027
goals:
  - id: g
    name: G
    metrics:
${metricLines.map((l) => `      ${l}`).join("\n")}
`;
}

/** Problems as "line: message" for compact assertions. */
function problemsOf(text: string): string[] {
  return validateConfigText(text).problems.map((p) => `${p.line}: ${p.message}`);
}

function expectOneProblem(text: string, line: number, pattern: RegExp): void {
  const { problems } = validateConfigText(text);
  expect(problems, JSON.stringify(problems)).toHaveLength(1);
  expect(problems[0]!.line).toBe(line);
  expect(problems[0]!.message).toMatch(pattern);
}

const manual = "source: { type: manual }";

describe("validateConfigText", () => {
  it("accepts the sample and full example configs", () => {
    expect(validateConfigText(sampleConfigText).problems).toEqual([]);
    expect(validateConfigText(exampleConfigText).problems).toEqual([]);
  });

  it("accepts a valid milestones plan and a count tracker source", () => {
    const text = withMetrics(
      `- { id: eps, kind: year, target: 5, ${manual}, plan: { type: milestones, steps: [{ date: 2027-03-31, value: 1 }, { date: "2027-09-30", value: 3 }] } }`,
      `- { id: fb, kind: weekly, target: 10, source: { type: tracker, metric: abc, aggregate: count } }`,
    );
    expect(validateConfigText(text).problems).toEqual([]);
  });

  describe("errors the reader catches (each with a line)", () => {
    it("YAML syntax error: no config", () => {
      const { config, problems } = validateConfigText("year: 2027\ngoals:\n  - id: [oops\n");
      expect(config).toBeNull();
      expect(problems[0]!.message).toMatch(/^YAML error/);
      expect(problems[0]!.line).toBeGreaterThanOrEqual(3);
    });

    it("unknown metric kind", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: monthly, target: 1, ${manual} }`), 6, /`kind` must be weekly, year or untargeted/);
    });

    it("missing target", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: weekly, ${manual} }`), 6, /"a": `target` must be a number/);
    });

    it("invalid target", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: year, target: lots, plan: { type: linear }, ${manual} }`), 6, /`target` must be a number/);
    });

    it("unknown curve type", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: year, target: 1, plan: { type: wobbly }, ${manual} }`), 6, /plan `type` must be linear, quarterly or milestones/);
    });

    it("year metric without a plan", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: year, target: 1, ${manual} }`), 6, /needs a `plan`/);
    });

    it("quarterly plan needs 4 values", () => {
      expectOneProblem(
        withMetrics(`- { id: a, kind: year, target: 100, plan: { type: quarterly, quarters: [10, 50, 80] }, ${manual} }`),
        6,
        /`quarters` must list 4 numbers/,
      );
    });

    it("milestone step without a valid date", () => {
      expectOneProblem(
        withMetrics(`- { id: a, kind: year, target: 5, plan: { type: milestones, steps: [{ date: soon, value: 1 }] }, ${manual} }`),
        6,
        /each step needs a date/,
      );
    });

    it("duplicate metric ids, also across goals", () => {
      const text = `year: 2027
goals:
  - id: a
    metrics:
      - { id: m, kind: weekly, target: 1, ${manual} }
  - id: b
    metrics:
      - { id: m, kind: weekly, target: 1, ${manual} }
`;
      expectOneProblem(text, 8, /Duplicate metric id "m"/);
    });

    it("duplicate goal ids", () => {
      expectOneProblem("year: 2027\ngoals:\n  - id: a\n  - id: a\n", 4, /Duplicate goal id "a"/);
    });

    it("unknown source type", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: weekly, target: 1, source: { type: sheets } }`), 6, /source `type` must be manual or tracker/);
    });

    it("missing source", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: weekly, target: 1 }`), 6, /`source` is required/);
    });

    it("tracker source missing its metric id", () => {
      const text = withMetrics("- id: a", "  kind: weekly", "  target: 1", "  source:", "    type: tracker", "    aggregate: sum");
      expectOneProblem(text, 10, /tracker source needs a `metric` id/);
    });

    it("missing year and non-numeric pace tolerance", () => {
      expect(problemsOf("paceTolerance: high\ngoals: []\n")).toEqual([
        "1: `year` must be a whole number, e.g. 2027.",
        "1: `paceTolerance` must be a number, e.g. 0.95.",
      ]);
    });
  });

  describe("stricter rules", () => {
    it("global pace tolerance out of range", () => {
      expectOneProblem("year: 2027\npaceTolerance: 1.5\ngoals: []\n", 2, /`paceTolerance` must be greater than 0 and at most 1/);
      expectOneProblem("year: 2027\npaceTolerance: 0\ngoals: []\n", 2, /greater than 0/);
    });

    it("per-metric pace tolerance out of range", () => {
      const text = withMetrics("- id: a", "  kind: year", "  target: 1", "  plan: { type: linear }", "  paceTolerance: 95", `  ${manual}`);
      expectOneProblem(text, 10, /Metric "a": `paceTolerance` must be greater than 0 and at most 1/);
    });

    it("target must be greater than 0", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: weekly, target: 0, ${manual} }`), 6, /`target` must be greater than 0/);
    });

    it("milestone dates within the year", () => {
      const text = withMetrics(
        "- id: eps",
        "  kind: year",
        "  target: 5",
        `  ${manual}`,
        "  plan:",
        "    type: milestones",
        "    steps:",
        "      - { date: 2027-06-30, value: 1 }",
        "      - { date: 2028-01-15, value: 2 }",
      );
      expectOneProblem(text, 14, /milestone date 2028-01-15 is outside 2027/);
    });

    it("milestone dates in order", () => {
      const text = withMetrics(
        "- id: eps",
        "  kind: year",
        "  target: 5",
        `  ${manual}`,
        "  plan:",
        "    type: milestones",
        "    steps:",
        "      - { date: 2027-09-30, value: 3 }",
        "      - { date: 2027-03-31, value: 1 }",
        "      - { date: 2027-03-31, value: 2 }",
      );
      expect(problemsOf(text)).toEqual([
        "14: Metric \"eps\": milestone dates must be in order, each after the one before (2027-03-31 comes after 2027-09-30).",
        "15: Metric \"eps\": milestone dates must be in order, each after the one before (2027-03-31 comes after 2027-03-31).",
      ]);
    });

    it("milestone date that isn't a real date", () => {
      const text = withMetrics(`- { id: a, kind: year, target: 5, ${manual}, plan: { type: milestones, steps: [{ date: 2027-02-30, value: 1 }] } }`);
      expectOneProblem(text, 6, /2027-02-30 is not a real date/);
    });

    it("milestones plan with no steps", () => {
      expectOneProblem(
        withMetrics(`- { id: a, kind: year, target: 5, ${manual}, plan: { type: milestones, steps: [] } }`),
        6,
        /needs at least one step/,
      );
    });

    it("non-numeric plan baseline", () => {
      expectOneProblem(withMetrics(`- { id: a, kind: year, target: 5, ${manual}, plan: { type: linear, baseline: none } }`), 6, /`baseline` must be a number/);
    });

    it("unknown fields (typos) at every level", () => {
      const text = `year: 2027
paceTolerence: 0.9
goals:
  - id: g
    statment: x
    metrics:
      - id: a
        kind: weekly
        traget: 10
        target: 10
        source: { type: tracker, metric: abc, agregate: sum }
      - id: b
        kind: year
        target: 1
        plan: { type: linear, quarters: [1, 2, 3, 4] }
        source: { type: manual }
`;
      expect(problemsOf(text).map((p) => p.replace(/ Expected.*/, ""))).toEqual([
        "2: unknown field `paceTolerence`.",
        '5: Goal "g": unknown field `statment`.',
        '9: Metric "a": unknown field `traget`.',
        '11: Metric "a": unknown field `agregate` in a tracker source.',
        '15: Metric "b": unknown field `quarters` in a linear plan.',
      ]);
    });

    it("fields that don't apply to the metric's kind", () => {
      expect(
        problemsOf(
          withMetrics(
            `- { id: a, kind: weekly, target: 1, paceTolerance: 0.9, ${manual} }`,
            `- { id: b, kind: untargeted, target: 3, ${manual} }`,
          ),
        ),
      ).toEqual([
        '6: Metric "a": `paceTolerance` only applies to year metrics.',
        '7: Metric "b": an untargeted metric has no `target`; remove it or change the kind.',
      ]);
    });

    it("unknown manual cadence and tracker aggregate", () => {
      expect(
        problemsOf(
          withMetrics(
            `- { id: a, kind: weekly, target: 1, source: { type: manual, cadence: daily } }`,
            `- { id: b, kind: weekly, target: 1, source: { type: tracker, metric: x, aggregate: avg } }`,
          ),
        ),
      ).toEqual(['6: Metric "a": manual `cadence` must be weekly or ad-hoc.', '7: Metric "b": tracker `aggregate` must be sum or count.']);
    });

    it("weekStart other than monday, unknown timezone", () => {
      expect(problemsOf("year: 2027\nweekStart: sunday\ntimezone: Mars/Olympus\ngoals: []\n")).toEqual([
        "2: `weekStart` must be monday (weeks are ISO weeks, Monday to Sunday).",
        '3: `timezone` must be an IANA time zone such as Europe/London; got "Mars/Olympus".',
      ]);
    });

    it("label, unit and level of the wrong type", () => {
      expect(problemsOf(withMetrics(`- { id: a, kind: weekly, target: 1, label: [x], unit: 5, level: yes, ${manual} }`))).toEqual([
        '6: Metric "a": `label` must be text.',
        '6: Metric "a": `unit` must be text, e.g. "min" or "£".',
        '6: Metric "a": `level` must be true or false.',
      ]);
    });
  });

  it("reports every problem at once, sorted by line", () => {
    const text = `year: 2027
paceTolerance: 2
goals:
  - id: g
    metrics:
      - { id: a, kind: weekly, ${manual} }
      - { id: b, kind: weekly, target: 1, colour: red, ${manual} }
      - { id: c, kind: year, target: 1, plan: { type: wobbly }, ${manual} }
`;
    expect(validateConfigText(text).problems.map((p) => p.line)).toEqual([2, 6, 7, 8]);
  });

  it("keeps the best-effort config alongside the problems", () => {
    const { config, problems } = validateConfigText(withMetrics(`- { id: a, kind: weekly, target: 0, ${manual} }`));
    expect(problems).toHaveLength(1);
    expect(config?.goals[0]?.metrics.map((m) => m.id)).toEqual(["a"]);
  });
});
