/**
 * Config schema: the goals, metrics and targets read from the vault's
 * scoreboard.yaml. Pure types and helpers; no Obsidian imports.
 *
 * Parsing YAML text into this shape lives in `configLoad.ts`.
 */

/** Kinds of metric (see GLOSSARY.md). */
export type MetricKind = "weekly" | "year" | "untargeted";

/** Where a metric's values come from. */
export type SourceConfig = ManualSourceConfig | TrackerSourceConfig;

/** Manual cadence: entered once per ISO week, or whenever it changes. */
export type ManualCadence = "weekly" | "ad-hoc";

/** Values typed into the Enter values form. */
export interface ManualSourceConfig {
  type: "manual";
  /**
   * Weekly metrics are always entered per week and year metrics always as the
   * latest running total / reading; for untargeted metrics the cadence picks
   * which. Defaults: weekly for weekly metrics, ad-hoc for year metrics,
   * weekly for untargeted metrics.
   */
  cadence: ManualCadence;
}

/** Tracker aggregate: `sum` uses the bucket `value`, `count` uses `entryCount`. */
export type TrackerAggregate = "sum" | "count";

/** Values read from the tracker Metrics API (ticket 07). */
export interface TrackerSourceConfig {
  type: "tracker";
  /** Tracker metric id (uuid). */
  metric: string;
  aggregate: TrackerAggregate;
}

/** Plan curve of a year metric over calendar `year` (ticket 03 evaluates them). */
export type PlanCurveConfig = LinearPlanConfig | QuarterlyPlanConfig | MilestonesPlanConfig;

/** Baseline on 1 Jan rising linearly to the metric's target on 31 Dec. */
export interface LinearPlanConfig {
  type: "linear";
  /** Value planned on 1 January. Default 0. */
  baseline: number;
}

/** A value per quarter end, interpolated between them, from the baseline on 1 Jan. */
export interface QuarterlyPlanConfig {
  type: "quarterly";
  baseline: number;
  /** Planned values at the end of Q1, Q2, Q3 and Q4, in that order. */
  quarters: [number, number, number, number];
}

/** One step of a milestones plan: from `date` on, the plan is `value`. */
export interface MilestoneStep {
  /** Calendar date as YYYY-MM-DD. */
  date: string;
  value: number;
}

/** Date/value steps, flat between steps; `baseline` applies before the first step. */
export interface MilestonesPlanConfig {
  type: "milestones";
  baseline: number;
  /** Sorted by date ascending. */
  steps: MilestoneStep[];
}

interface MetricConfigBase {
  /** Stable id; history in the data file is keyed by it. */
  id: string;
  /** Display label. Safe to change. */
  label: string;
  /** Id of the goal this metric belongs to. */
  goalId: string;
  /** Unit shown with values, e.g. "min", "£", "%". Empty for plain counts. */
  unit: string;
  /** A level metric's value is a reading of a current state, not an accumulated amount. */
  level: boolean;
  source: SourceConfig;
}

/** Scored once per ISO week against `target`. */
export interface WeeklyMetricConfig extends MetricConfigBase {
  kind: "weekly";
  /** Target per ISO week. */
  target: number;
}

/** Scored against a plan curve towards `target` by 31 December. */
export interface YearMetricConfig extends MetricConfigBase {
  kind: "year";
  /** Target by 31 December. */
  target: number;
  plan: PlanCurveConfig;
  /** Per-metric override of the global pace tolerance. */
  paceTolerance?: number;
}

/** Shown with its trend; excluded from every score. */
export interface UntargetedMetricConfig extends MetricConfigBase {
  kind: "untargeted";
}

export type MetricConfig = WeeklyMetricConfig | YearMetricConfig | UntargetedMetricConfig;

export interface GoalConfig {
  id: string;
  name: string;
  /** One-line statement shown under the goal name. */
  statement: string;
  metrics: MetricConfig[];
}

export interface ScoreboardConfig {
  /** The scoreboard's calendar year, e.g. 2027. */
  year: number;
  /** Always "monday" (ISO weeks); kept so the config file can state it. */
  weekStart: "monday";
  /** IANA timezone used to decide "today", e.g. Europe/London. */
  timezone: string;
  /** Global pace tolerance (default 0.95); year metrics may override it. */
  paceTolerance: number;
  goals: GoalConfig[];
}

export const DEFAULT_PACE_TOLERANCE = 0.95;
export const DEFAULT_TIMEZONE = "Europe/London";

/** Every metric in config order (goal by goal). */
export function allMetrics(config: ScoreboardConfig): MetricConfig[] {
  return config.goals.flatMap((g) => g.metrics);
}

/** Looks up a metric by id. */
export function findMetric(config: ScoreboardConfig, id: string): MetricConfig | undefined {
  return allMetrics(config).find((m) => m.id === id);
}

/** Metrics whose source is manual entry (the ones listed in the Enter values form). */
export function manualMetrics(config: ScoreboardConfig): MetricConfig[] {
  return allMetrics(config).filter((m) => m.source.type === "manual");
}

/**
 * Whether a manual metric's values are entered per ISO week (true) or as a
 * single latest value that replaces the previous one (false).
 */
export function isEnteredPerWeek(metric: MetricConfig): boolean {
  if (metric.kind === "weekly") return true;
  if (metric.kind === "year") return false;
  return metric.source.type === "manual" ? metric.source.cadence === "weekly" : true;
}
