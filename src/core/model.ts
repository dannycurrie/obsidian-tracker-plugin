/**
 * The Scoreboard view model: everything the UI renders, computed from config,
 * data and today's date. Pure; `today` comes from the edge.
 */
import type { GoalConfig, MetricConfig, ScoreboardConfig } from "./config";
import type { ScoreboardData } from "./data";
import { buildUntargetedRow } from "./rows/untargetedRow";
import { buildWeeklyRow } from "./rows/weeklyRow";
import { buildYearRow } from "./rows/yearRow";
import type { MetricRowModel, RowContext, WeeklyRowModel, YearRowModel } from "./rows/types";
import type { Score } from "./score";
import { isoWeekKey, isoWeekOf, type CalendarDate, type IsoWeek } from "./week";
import { thisWeekScore } from "./weeklyScoring";
import { yearToDateScore } from "./yearScoring";

export type { MetricRowModel, RowContext, UntargetedRowModel, WeeklyRowModel, YearRowModel } from "./rows/types";

export interface GoalCardModel {
  goal: GoalConfig;
  rows: MetricRowModel[];
  // Ticket 05: "x / y on track" badge and colour go here.
}

export interface ScoreboardModel {
  today: CalendarDate;
  week: IsoWeek;
  goals: GoalCardModel[];
  /** Header "This week" tile. */
  thisWeek: Score;
  /** Header "Year to date" tile. */
  yearToDate: Score;
}

/** Builds one metric's row, by kind. */
export function buildMetricRow(metric: MetricConfig, ctx: RowContext): MetricRowModel {
  switch (metric.kind) {
    case "weekly":
      return buildWeeklyRow(metric, ctx);
    case "year":
      return buildYearRow(metric, ctx);
    case "untargeted":
      return buildUntargetedRow(metric, ctx);
  }
}

export function buildScoreboardModel(
  config: ScoreboardConfig,
  data: ScoreboardData,
  today: CalendarDate,
): ScoreboardModel {
  const week = isoWeekOf(today);
  const ctx: RowContext = { config, data, today, week, weekKey: isoWeekKey(week) };
  const goals = config.goals.map((goal) => ({ goal, rows: goal.metrics.map((m) => buildMetricRow(m, ctx)) }));
  const weeklyRows = goals.flatMap((g) => g.rows).filter((r): r is WeeklyRowModel => r.kind === "weekly");
  const yearRows = goals.flatMap((g) => g.rows).filter((r): r is YearRowModel => r.kind === "year");
  return {
    today,
    week,
    goals,
    thisWeek: thisWeekScore(weeklyRows.map((r) => r.status)),
    yearToDate: yearToDateScore(yearRows.map((r) => r.status)),
  };
}
