/**
 * Full config validation (ticket 06). Pure: no Obsidian imports, no clock.
 *
 * `validateConfigText(text)` is the loader the store uses: it runs the
 * lenient reader in `configLoad.ts` (YAML errors, missing ids, unknown kind /
 * source type / curve type, missing target, quarterly needs 4 values,
 * malformed milestone steps, duplicate goal and metric ids…) and then
 * `checkConfigRules(source)`, the stricter rules below that the reader does
 * not check. The two sets of rules are disjoint, so no problem is reported
 * twice. Every problem carries a 1-based line number where the node exists.
 *
 * A config is valid when the result has no problems. Problems found at
 * runtime by source adapters (e.g. unknown tracker id, ticket 07) are not
 * found here: adapters hand them to `ScoreboardStore.setSourceProblems`.
 *
 * Adding a config field? Add it to the matching `*_KEYS` list below,
 * otherwise it is reported as an unknown field.
 */
import { readConfig, parseYamlSource, type ConfigLoadResult, type ConfigPath, type ConfigProblem, type YamlSource } from "./configLoad";

const TOP_KEYS = ["year", "weekStart", "timezone", "paceTolerance", "goals"];
const GOAL_KEYS = ["id", "name", "statement", "metrics"];
const METRIC_KEYS = ["id", "label", "kind", "level", "unit", "target", "plan", "paceTolerance", "source"];
const PLAN_KEYS: Record<string, string[]> = {
  linear: ["type", "baseline"],
  quarterly: ["type", "baseline", "quarters"],
  milestones: ["type", "baseline", "steps"],
};
const STEP_KEYS = ["date", "value"];
const SOURCE_KEYS: Record<string, string[]> = {
  manual: ["type", "cadence"],
  tracker: ["type", "metric", "aggregate"],
};

/** Reads and fully validates config file text. The config is valid when `problems` is empty. */
export function validateConfigText(text: string): ConfigLoadResult {
  const source = parseYamlSource(text);
  const result = readConfig(source);
  if (source.problems.length > 0 || result.config === null) return result;
  return { config: result.config, problems: sortProblems([...result.problems, ...checkConfigRules(source)]) };
}

/**
 * The validation rules `readConfig` does not check: unknown fields, value
 * ranges, fields that don't apply to a metric's kind, and milestone dates.
 * Returns [] for a document that isn't a mapping (the reader reports that).
 */
export function checkConfigRules(source: YamlSource): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const report = (path: ConfigPath, message: string) => problems.push({ message, line: source.lineOf(path), path });
  const root = source.value;
  if (!isRecord(root)) return problems;

  unknownKeys(root, TOP_KEYS, [], "", report);
  if (root.weekStart !== undefined && root.weekStart !== "monday") {
    report(["weekStart"], "`weekStart` must be monday (weeks are ISO weeks, Monday to Sunday).");
  }
  if (root.timezone !== undefined && !isTimeZone(root.timezone)) {
    report(["timezone"], `\`timezone\` must be an IANA time zone such as Europe/London; got ${show(root.timezone)}.`);
  }
  checkTolerance(root.paceTolerance, ["paceTolerance"], "", report);
  const year = typeof root.year === "number" && Number.isInteger(root.year) ? root.year : undefined;

  if (!Array.isArray(root.goals)) return problems;
  root.goals.forEach((goal, gi) => {
    if (!isRecord(goal)) return;
    const gPath = ["goals", gi];
    const gName = typeof goal.id === "string" ? `Goal "${goal.id}": ` : "";
    unknownKeys(goal, GOAL_KEYS, gPath, gName, report);
    for (const key of ["name", "statement"]) {
      if (goal[key] !== undefined && typeof goal[key] !== "string") report([...gPath, key], `${gName}\`${key}\` must be text.`);
    }
    if (!Array.isArray(goal.metrics)) return;
    goal.metrics.forEach((metric, mi) => {
      if (isRecord(metric)) checkMetric(metric, [...gPath, "metrics", mi], year, report);
    });
  });
  return problems;
}

type Report = (path: ConfigPath, message: string) => void;

function checkMetric(m: Record<string, unknown>, path: ConfigPath, year: number | undefined, report: Report): void {
  const name = typeof m.id === "string" ? `Metric "${m.id}": ` : "";
  unknownKeys(m, METRIC_KEYS, path, name, report);
  if (m.label !== undefined && typeof m.label !== "string") report([...path, "label"], `${name}\`label\` must be text.`);
  if (m.unit !== undefined && typeof m.unit !== "string") report([...path, "unit"], `${name}\`unit\` must be text, e.g. "min" or "£".`);
  if (m.level !== undefined && typeof m.level !== "boolean") report([...path, "level"], `${name}\`level\` must be true or false.`);

  const kind = m.kind;
  if (kind === "untargeted") {
    for (const key of ["target", "plan", "paceTolerance"]) {
      if (m[key] !== undefined) report([...path, key], `${name}an untargeted metric has no \`${key}\`; remove it or change the kind.`);
    }
  }
  if (kind === "weekly") {
    for (const key of ["plan", "paceTolerance"]) {
      if (m[key] !== undefined) report([...path, key], `${name}\`${key}\` only applies to year metrics.`);
    }
  }
  if ((kind === "weekly" || kind === "year") && typeof m.target === "number" && Number.isFinite(m.target) && m.target <= 0) {
    report([...path, "target"], `${name}\`target\` must be greater than 0.`);
  }
  if (kind === "year") {
    checkTolerance(m.paceTolerance, [...path, "paceTolerance"], name, report);
    if (isRecord(m.plan)) checkPlan(m.plan, [...path, "plan"], year, name, report);
  }
  if (isRecord(m.source)) checkSource(m.source, [...path, "source"], name, report);
}

function checkPlan(
  plan: Record<string, unknown>,
  path: ConfigPath,
  year: number | undefined,
  name: string,
  report: Report,
): void {
  const keys = typeof plan.type === "string" ? PLAN_KEYS[plan.type] : undefined;
  if (!keys) return; // unknown curve type: reported by readConfig
  unknownKeys(plan, keys, path, name, report, `a ${String(plan.type)} plan`);
  if (plan.baseline !== undefined && !isFiniteNumber(plan.baseline)) {
    report([...path, "baseline"], `${name}plan \`baseline\` must be a number.`);
  }
  if (plan.type !== "milestones" || !Array.isArray(plan.steps)) return;
  if (plan.steps.length === 0) {
    report([...path, "steps"], `${name}a milestones plan needs at least one step { date, value }.`);
    return;
  }
  let previous: string | undefined;
  plan.steps.forEach((step, i) => {
    if (!isRecord(step)) return;
    const sPath = [...path, "steps", i];
    unknownKeys(step, STEP_KEYS, sPath, name, report, "a milestone step");
    const date = dateString(step.date);
    if (date === undefined) return; // missing / malformed date: reported by readConfig
    if (!isCalendarDate(date)) {
      report([...sPath, "date"], `${name}milestone date ${date} is not a real date.`);
      return;
    }
    if (year !== undefined && !date.startsWith(`${year}-`)) {
      report([...sPath, "date"], `${name}milestone date ${date} is outside ${year}.`);
    }
    if (previous !== undefined && date <= previous) {
      report(
        [...sPath, "date"],
        `${name}milestone dates must be in order, each after the one before (${date} comes after ${previous}).`,
      );
    }
    previous = date;
  });
}

function checkSource(source: Record<string, unknown>, path: ConfigPath, name: string, report: Report): void {
  const keys = typeof source.type === "string" ? SOURCE_KEYS[source.type] : undefined;
  if (!keys) return; // unknown source type: reported by readConfig
  unknownKeys(source, keys, path, name, report, `a ${String(source.type)} source`);
  if (source.type === "manual" && source.cadence !== undefined && source.cadence !== "weekly" && source.cadence !== "ad-hoc") {
    report([...path, "cadence"], `${name}manual \`cadence\` must be weekly or ad-hoc.`);
  }
  if (source.type === "tracker" && source.aggregate !== undefined && source.aggregate !== "sum" && source.aggregate !== "count") {
    report([...path, "aggregate"], `${name}tracker \`aggregate\` must be sum or count.`);
  }
}

function checkTolerance(v: unknown, path: ConfigPath, name: string, report: Report): void {
  // Non-numbers are reported by readConfig.
  if (isFiniteNumber(v) && (v <= 0 || v > 1)) {
    report(path, `${name}\`paceTolerance\` must be greater than 0 and at most 1, e.g. 0.95.`);
  }
}

function unknownKeys(
  obj: Record<string, unknown>,
  allowed: readonly string[],
  path: ConfigPath,
  name: string,
  report: Report,
  where?: string,
): void {
  for (const key of Object.keys(obj)) {
    if (allowed.includes(key)) continue;
    report(
      [...path, key],
      `${name}unknown field \`${key}\`${where ? ` in ${where}` : ""}. Expected one of: ${allowed.join(", ")}.`,
    );
  }
}

/** Sorts by line (problems without a line last), keeping order within a line. */
function sortProblems(problems: ConfigProblem[]): ConfigProblem[] {
  return problems
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.line ?? Infinity) - (b.p.line ?? Infinity) || a.i - b.i)
    .map(({ p }) => p);
}

function isTimeZone(v: unknown): boolean {
  if (typeof v !== "string" || v.trim() === "") return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

function isCalendarDate(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Same reading as configLoad: YAML may give an unquoted date as a string or a Date. */
function dateString(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return undefined;
}

function show(v: unknown): string {
  return typeof v === "string" ? `"${v}"` : JSON.stringify(v) ?? String(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
