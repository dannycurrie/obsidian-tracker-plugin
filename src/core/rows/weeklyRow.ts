import type { WeeklyMetricConfig } from "../config";
import { metricWeekValue } from "../values";
import { weeklyStatus } from "../weeklyScoring";
import type { RowContext, WeeklyRowModel } from "./types";

/** A weekly metric's row for the current week. */
export function buildWeeklyRow(metric: WeeklyMetricConfig, ctx: RowContext): WeeklyRowModel {
  const value = metricWeekValue(metric, ctx.data, ctx.weekKey);
  // The current week is by definition still running.
  return { kind: "weekly", metric, value, status: weeklyStatus(value?.value ?? null, metric.target, false) };
}
