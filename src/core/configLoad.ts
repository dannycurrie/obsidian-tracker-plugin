/**
 * Config file text -> ScoreboardConfig. Pure: no Obsidian imports.
 *
 * Two stages, so ticket 06 (config validation) can wrap or replace the second:
 *
 * 1. `parseYamlSource(text)` parses YAML with line positions (the `yaml`
 *    package, not Obsidian's parseYaml) and reports YAML syntax errors.
 * 2. `readConfig(source)` turns the parsed value into a typed config.
 *    It is deliberately lenient (ticket 02): it reports a problem and skips
 *    whatever it cannot use, but never throws. Full validation is ticket 06.
 *
 * `loadConfigFromYaml(text)` runs both and is what the store calls.
 */
import { isNode, LineCounter, parseDocument } from "yaml";
import {
  DEFAULT_PACE_TOLERANCE,
  DEFAULT_TIMEZONE,
  type GoalConfig,
  type MetricConfig,
  type MetricKind,
  type MilestoneStep,
  type PlanCurveConfig,
  type ScoreboardConfig,
  type SourceConfig,
} from "./config";

/** A path into the YAML document, e.g. ["goals", 0, "metrics", 2, "target"]. */
export type ConfigPath = readonly (string | number)[];

/** One problem with the config file. `line` is 1-based when known. */
export interface ConfigProblem {
  message: string;
  line?: number;
  path?: ConfigPath;
}

export interface YamlSource {
  /** The parsed document as plain JS (undefined if the document is empty). */
  value: unknown;
  /** YAML syntax errors, with line numbers. */
  problems: ConfigProblem[];
  /**
   * 1-based line of the node at `path`, or of the nearest ancestor that
   * exists. Undefined only if nothing on the path exists.
   */
  lineOf(path: ConfigPath): number | undefined;
}

export interface ConfigLoadResult {
  /**
   * Best-effort config: null only if the file is unusable (YAML error, or the
   * top level is not a mapping). Present even when `problems` is non-empty.
   */
  config: ScoreboardConfig | null;
  /** Every problem found. Empty means the config is valid. */
  problems: ConfigProblem[];
}

/** Stage 1: parse YAML text, keeping line positions. */
export function parseYamlSource(text: string): YamlSource {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter, prettyErrors: false });
  const problems: ConfigProblem[] = doc.errors.map((e) => ({
    message: `YAML error: ${e.message.split("\n")[0]}`,
    line: lineCounter.linePos(e.pos[0]).line,
  }));
  const lineOf = (path: ConfigPath): number | undefined => {
    for (let n = path.length; n >= 0; n--) {
      const node: unknown = n === 0 ? doc.contents : doc.getIn(path.slice(0, n), true);
      if (isNode(node) && node.range) return lineCounter.linePos(node.range[0]).line;
    }
    return undefined;
  };
  const value: unknown = problems.length > 0 ? undefined : doc.toJS();
  return { value, problems, lineOf };
}

/** Stage 2: read a parsed YAML value into a typed config (lenient; see module doc). */
export function readConfig(source: YamlSource): ConfigLoadResult {
  if (source.problems.length > 0) return { config: null, problems: [...source.problems] };
  const problems: ConfigProblem[] = [];
  const report = (path: ConfigPath, message: string) =>
    problems.push({ message, line: source.lineOf(path), path });

  const root = source.value;
  if (!isRecord(root)) {
    report([], "The config file must be a YAML mapping with `year`, `goals` and so on.");
    return { config: null, problems };
  }

  const year = typeof root.year === "number" && Number.isInteger(root.year) ? root.year : undefined;
  if (year === undefined) report(["year"], "`year` must be a whole number, e.g. 2027.");

  const timezone = typeof root.timezone === "string" && root.timezone ? root.timezone : DEFAULT_TIMEZONE;
  const paceTolerance = optionalNumber(root.paceTolerance) ?? DEFAULT_PACE_TOLERANCE;
  if (root.paceTolerance !== undefined && optionalNumber(root.paceTolerance) === undefined) {
    report(["paceTolerance"], "`paceTolerance` must be a number, e.g. 0.95.");
  }

  const goals: GoalConfig[] = [];
  const seenMetricIds = new Set<string>();
  const seenGoalIds = new Set<string>();
  if (!Array.isArray(root.goals)) {
    report(["goals"], "`goals` must be a list of goals.");
  } else {
    root.goals.forEach((rawGoal, gi) => {
      const gPath = ["goals", gi];
      if (!isRecord(rawGoal) || !nonEmptyString(rawGoal.id)) {
        report(gPath, "Each goal needs an `id`.");
        return;
      }
      if (seenGoalIds.has(rawGoal.id)) {
        report([...gPath, "id"], `Duplicate goal id "${rawGoal.id}".`);
        return;
      }
      seenGoalIds.add(rawGoal.id);
      const goal: GoalConfig = {
        id: rawGoal.id,
        name: nonEmptyString(rawGoal.name) ? rawGoal.name : rawGoal.id,
        statement: typeof rawGoal.statement === "string" ? rawGoal.statement : "",
        metrics: [],
      };
      const rawMetrics = rawGoal.metrics ?? [];
      if (!Array.isArray(rawMetrics)) {
        report([...gPath, "metrics"], "`metrics` must be a list.");
      } else {
        rawMetrics.forEach((rawMetric, mi) => {
          const metric = readMetric(rawMetric, goal.id, [...gPath, "metrics", mi], report);
          if (!metric) return;
          if (seenMetricIds.has(metric.id)) {
            report([...gPath, "metrics", mi, "id"], `Duplicate metric id "${metric.id}".`);
            return;
          }
          seenMetricIds.add(metric.id);
          goal.metrics.push(metric);
        });
      }
      goals.push(goal);
    });
  }

  return {
    config: { year: year ?? 0, weekStart: "monday", timezone, paceTolerance, goals },
    problems,
  };
}

/** Parses config file text into a config and its problems. */
export function loadConfigFromYaml(text: string): ConfigLoadResult {
  return readConfig(parseYamlSource(text));
}

type Report = (path: ConfigPath, message: string) => void;

const METRIC_KINDS: readonly MetricKind[] = ["weekly", "year", "untargeted"];

function readMetric(raw: unknown, goalId: string, path: ConfigPath, report: Report): MetricConfig | null {
  if (!isRecord(raw) || !nonEmptyString(raw.id)) {
    report(path, "Each metric needs an `id`.");
    return null;
  }
  const id = raw.id;
  const kind = raw.kind;
  if (typeof kind !== "string" || !(METRIC_KINDS as readonly string[]).includes(kind)) {
    report([...path, "kind"], `Metric "${id}": \`kind\` must be weekly, year or untargeted.`);
    return null;
  }
  const source = readSource(raw.source, kind as MetricKind, id, [...path, "source"], report);
  if (!source) return null;
  const base = {
    id,
    label: nonEmptyString(raw.label) ? raw.label : id,
    goalId,
    unit: typeof raw.unit === "string" ? raw.unit : "",
    level: raw.level === true,
    source,
  };
  if (kind === "untargeted") return { ...base, kind };

  const target = optionalNumber(raw.target);
  if (target === undefined) {
    report([...path, "target"], `Metric "${id}": \`target\` must be a number.`);
    return null;
  }
  if (kind === "weekly") return { ...base, kind, target };

  const plan = readPlan(raw.plan, id, [...path, "plan"], report);
  if (!plan) return null;
  const paceTolerance = optionalNumber(raw.paceTolerance);
  if (raw.paceTolerance !== undefined && paceTolerance === undefined) {
    report([...path, "paceTolerance"], `Metric "${id}": \`paceTolerance\` must be a number.`);
  }
  return { ...base, kind: "year", target, plan, ...(paceTolerance !== undefined ? { paceTolerance } : {}) };
}

function readSource(
  raw: unknown,
  kind: MetricKind,
  metricId: string,
  path: ConfigPath,
  report: Report,
): SourceConfig | null {
  if (!isRecord(raw)) {
    report(path, `Metric "${metricId}": \`source\` is required, e.g. { type: manual }.`);
    return null;
  }
  if (raw.type === "manual") {
    const cadence =
      raw.cadence === "weekly" || raw.cadence === "ad-hoc" ? raw.cadence : kind === "year" ? "ad-hoc" : "weekly";
    return { type: "manual", cadence };
  }
  if (raw.type === "tracker") {
    if (!nonEmptyString(raw.metric)) {
      report([...path, "metric"], `Metric "${metricId}": a tracker source needs a \`metric\` id.`);
      return null;
    }
    return { type: "tracker", metric: raw.metric, aggregate: raw.aggregate === "count" ? "count" : "sum" };
  }
  report([...path, "type"], `Metric "${metricId}": source \`type\` must be manual or tracker.`);
  return null;
}

function readPlan(raw: unknown, metricId: string, path: ConfigPath, report: Report): PlanCurveConfig | null {
  if (!isRecord(raw)) {
    report(path, `Metric "${metricId}": a year metric needs a \`plan\`, e.g. { type: linear }.`);
    return null;
  }
  const baseline = optionalNumber(raw.baseline) ?? 0;
  if (raw.type === "linear") return { type: "linear", baseline };
  if (raw.type === "quarterly") {
    const q = raw.quarters;
    if (!Array.isArray(q) || q.length !== 4 || !q.every((v) => typeof v === "number")) {
      report([...path, "quarters"], `Metric "${metricId}": \`quarters\` must list 4 numbers (Q1–Q4).`);
      return null;
    }
    return { type: "quarterly", baseline, quarters: [q[0], q[1], q[2], q[3]] as [number, number, number, number] };
  }
  if (raw.type === "milestones") {
    const steps: MilestoneStep[] = [];
    const rawSteps = raw.steps;
    if (!Array.isArray(rawSteps)) {
      report([...path, "steps"], `Metric "${metricId}": \`steps\` must be a list of { date, value }.`);
      return null;
    }
    for (const [i, s] of rawSteps.entries()) {
      const date = isRecord(s) ? dateString(s.date) : undefined;
      const value = isRecord(s) ? optionalNumber(s.value) : undefined;
      if (date === undefined || value === undefined) {
        report([...path, "steps", i], `Metric "${metricId}": each step needs a date (YYYY-MM-DD) and a value.`);
        return null;
      }
      steps.push({ date, value });
    }
    steps.sort((a, b) => a.date.localeCompare(b.date));
    return { type: "milestones", baseline, steps };
  }
  report([...path, "type"], `Metric "${metricId}": plan \`type\` must be linear, quarterly or milestones.`);
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function optionalNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** YAML may give an unquoted date as a string or (with some schemas) a Date. */
function dateString(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return undefined;
}
