/**
 * The review week report (brief › Scoring rules › Review week, Status labels
 * for export and coaching): everything Export to Obsidian (ticket 09) and
 * Start coaching chat (ticket 10) say about the review week, computed once
 * here so both outputs agree. Pure: no Obsidian imports, no clock (`today`
 * comes from the edge).
 *
 * Review week: the current ISO week; on a Monday, the just-finished week
 * instead (no week picker). The Monday review is the end-of-week ritual, so
 * the just-finished week is what gets exported and coached on.
 *
 * Verdicts as of the review week:
 * - Weekly metrics: that week's value against that week's target (the stored
 *   snapshot target once the week has ended, else the config's). While the
 *   week runs: "Hit" or "N to go"; once it has ended: "Hit" or
 *   "Missed (N short)". Streak as on the row, counted from the review week.
 * - Year metrics: the latest value (a Monday review usually enters the
 *   running totals that morning) against the plan curve's value on the
 *   review week's last day if that week has ended, else today. Labels are the
 *   pace labels ("X ahead of pace", "On pace (−X)", "X behind pace").
 * - Untargeted metrics: the review week's value (or the latest), "No target".
 * - Stale: a metric whose source failed on the last refresh (its value is the
 *   last good one).
 */
import type { GoalConfig, MetricConfig, ScoreboardConfig } from "./config";
import type { ExportRecord, ExportedMetricStatus, ScoreboardData } from "./data";
import { formatNumber, formatValue, NO_VALUE } from "./format";
import { metricTrackState, type MetricTrackState } from "./goalBadge";
import { weeklyStreak } from "./history";
import { buildScoreboardModel } from "./model";
import type { ActiveProject } from "./projects";
import type { Score } from "./score";
import { snapshotTarget } from "./snapshots";
import { modelWithSourceStatus, type SourceStatuses } from "./sources";
import type { MetricValue } from "./values";
import {
  addWeeks,
  isoWeekday,
  isoWeekEnd,
  isoWeekKey,
  isoWeekOf,
  isoWeekStart,
  type CalendarDate,
  type IsoWeek,
} from "./week";
import { thisWeekScore, weeklyStatus, type WeeklyStatus } from "./weeklyScoring";
import { yearStatusLabel, yearToDateScore, type YearStatus } from "./yearScoring";

/** The week Export and Start coaching chat cover. */
export interface ReviewWeek {
  week: IsoWeek;
  /** ISO week key, e.g. "2027-W18" (data file and entry marker key). */
  key: string;
  /** Monday. */
  start: CalendarDate;
  /** Sunday. */
  end: CalendarDate;
  /** True on a Monday: the review week is the just-finished one. */
  ended: boolean;
}

/** The review week for `today`: the current ISO week, or on a Monday the week that just ended. */
export function reviewWeekFor(today: CalendarDate): ReviewWeek {
  const current = isoWeekOf(today);
  const ended = isoWeekday(today) === 0;
  const week = ended ? addWeeks(current, -1) : current;
  return { week, key: isoWeekKey(week), start: isoWeekStart(week), end: isoWeekEnd(week), ended };
}

/** One metric's line in the report. */
export interface ReportMetric {
  goal: GoalConfig;
  metric: MetricConfig;
  /** The review week's value (weekly), latest value (year), or either (untargeted); null = no data. With `stale` set when its source failed. */
  value: MetricValue | null;
  /** The target the line is scored against; null for untargeted. */
  target: number | null;
  /** Verdict: on-track / behind / in-progress (weekly, week running, not hit) / unscored (untargeted). */
  state: MetricTrackState;
  /** Status copy: "Hit", "30 to go", "Missed (30 short)", "£150 ahead of pace", "No target", … */
  statusLabel: string;
  /** "70 min", "£4,300", or "–" with no data. */
  valueText: string;
  /** "100 min", "£12,000", or "–" for untargeted. */
  targetText: string;
  /** True when the source failed on the last refresh (value is the last good one). */
  stale: boolean;
  /** Weekly metrics: status and streak (counting the review week if hit). */
  weekly?: { status: WeeklyStatus; streak: number };
  /** Year metrics: pace status and the plan value on `planDate`. */
  year?: { status: YearStatus; planValue: number };
}

/** An active project as reported. */
export interface ReportProject {
  title: string;
  path: string;
  /** First open task under "Next actions"; null = "No next action". */
  nextAction: string | null;
}

export interface ReviewReport {
  /** Today in the config timezone. */
  today: CalendarDate;
  reviewWeek: ReviewWeek;
  /** The date year metrics are scored on: the review week's Sunday if it has ended, else today. */
  planDate: CalendarDate;
  /** Weekly targets hit / weekly metrics, for the review week. */
  thisWeek: Score;
  /** Year metrics on pace / year metrics, on `planDate`. */
  yearToDate: Score;
  /** Every metric, in config order (goal by goal). */
  metrics: ReportMetric[];
  /** Metrics whose source failed on the last refresh. */
  stale: ReportMetric[];
  /** Active strategic projects, in the order given (the dashboard's: by title). */
  projects: ReportProject[];
}

export interface ReviewReportInput {
  config: ScoreboardConfig;
  data: ScoreboardData;
  /** Today in the config timezone. */
  today: CalendarDate;
  /** Source statuses of the last refresh (failed sources mark their metrics stale). */
  sources?: SourceStatuses;
  /** Active projects (`buildProjectsModel(...).active`). */
  projects: readonly ActiveProject[];
}

/** Builds the report for the review week of `today`. */
export function buildReviewReport(input: ReviewReportInput): ReviewReport {
  const { config, data, today } = input;
  const reviewWeek = reviewWeekFor(today);
  const planDate = reviewWeek.ended ? reviewWeek.end : today;
  // Building the model on `planDate` puts its week on the review week and scores year rows on that date.
  const model = modelWithSourceStatus(buildScoreboardModel(config, data, planDate), input.sources ?? {});
  const snapshot = data.snapshots[reviewWeek.key];

  const metrics = model.goals.flatMap(({ goal, rows }) =>
    rows.map((row): ReportMetric => {
      const unit = row.metric.unit;
      const base = { goal, value: row.value, valueText: valueText(row.value, unit), stale: row.value?.stale !== undefined };
      switch (row.kind) {
        case "weekly": {
          const target = snapshotTarget(snapshot, row.metric, reviewWeek.ended) ?? row.metric.target;
          const status = weeklyStatus(row.value?.value ?? null, target, reviewWeek.ended);
          const streak = weeklyStreak(row.metric, data, reviewWeek.week, status.state === "hit");
          const state = metricTrackState({ ...row, status });
          return {
            ...base,
            metric: row.metric,
            target,
            targetText: formatValue(target, unit),
            state,
            statusLabel: reportWeeklyStatusLabel(status),
            weekly: { status, streak },
          };
        }
        case "year":
          return {
            ...base,
            metric: row.metric,
            target: row.metric.target,
            targetText: formatValue(row.metric.target, unit),
            state: metricTrackState(row),
            statusLabel: yearStatusLabel(row.status, unit),
            year: { status: row.status, planValue: row.planValue },
          };
        case "untargeted":
          return { ...base, metric: row.metric, target: null, targetText: NO_VALUE, state: "unscored", statusLabel: NO_TARGET_LABEL };
      }
    }),
  );

  return {
    today,
    reviewWeek,
    planDate,
    thisWeek: thisWeekScore(metrics.flatMap((m) => (m.weekly ? [m.weekly.status] : []))),
    yearToDate: yearToDateScore(metrics.flatMap((m) => (m.year ? [m.year.status] : []))),
    metrics,
    stale: metrics.filter((m) => m.stale),
    projects: input.projects.map((p) => ({ title: p.title, path: p.path, nextAction: p.nextAction })),
  };
}

/** Status of an untargeted metric in export and coaching. */
export const NO_TARGET_LABEL = "No target";

/** Export / coaching copy for a weekly status: "Hit", "30 to go", "Missed (30 short)". */
export function reportWeeklyStatusLabel(status: WeeklyStatus): string {
  switch (status.state) {
    case "hit":
      return "Hit";
    case "in-progress":
      return `${formatNumber(status.toGo)} to go`;
    case "missed":
      return `Missed (${formatNumber(status.short)} short)`;
  }
}

function valueText(value: MetricValue | null, unit: string): string {
  return value === null ? NO_VALUE : formatValue(value.value, unit);
}

/**
 * The record of an export kept in the data file (`exports[weekKey]`), for
 * ticket 10's "Changed since last export". One per week; a re-export
 * replaces it.
 */
export function exportRecordOf(report: ReviewReport, exportedAt: string): ExportRecord {
  const metrics: Record<string, ExportedMetricStatus> = {};
  for (const m of report.metrics) metrics[m.metric.id] = { state: m.state, label: m.statusLabel };
  return {
    exportedAt,
    week: report.reviewWeek.key,
    weekEnded: report.reviewWeek.ended,
    thisWeek: { ...report.thisWeek },
    yearToDate: { ...report.yearToDate },
    metrics,
  };
}

/** Header button copy: "Export to Obsidian", or "Export week 18" on a Monday, with a tooltip. */
export function exportButtonCopy(reviewWeek: ReviewWeek): { label: string; title: string } {
  const n = reviewWeek.week.week;
  return reviewWeek.ended
    ? { label: `Export week ${n}`, title: `Add the just-finished week ${n} to the 2027 Plan note (on Mondays the export covers last week)` }
    : { label: "Export to Obsidian", title: `Add week ${n} to the 2027 Plan note (replaces this week's entry if there is one)` };
}
