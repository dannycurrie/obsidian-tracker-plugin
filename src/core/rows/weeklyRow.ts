import type { WeeklyMetricConfig } from "../config";
import { weeklyHistory, weeklyStreak } from "../history";
import { metricWeekValue } from "../values";
import { weeklyStatus } from "../weeklyScoring";
import type { RowContext, WeeklyRowModel } from "./types";

/** A weekly metric's row for the current week, with its history strip and streak. */
export function buildWeeklyRow(metric: WeeklyMetricConfig, ctx: RowContext): WeeklyRowModel {
  const value = metricWeekValue(metric, ctx.data, ctx.weekKey);
  // The current week is by definition still running.
  const status = weeklyStatus(value?.value ?? null, metric.target, false);
  const history = weeklyHistory(metric, ctx.data, ctx.week);
  const streak = weeklyStreak(metric, ctx.data, ctx.week, status.state === "hit");
  return { kind: "weekly", metric, value, status, history, streak };
}
