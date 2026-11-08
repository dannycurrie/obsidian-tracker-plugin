import type { UntargetedMetricConfig } from "../config";
import { changeAgainstWeeksAgo, trendHistory } from "../trend";
import { metricCurrentValue } from "../values";
import type { RowContext, UntargetedRowModel } from "./types";

/** An untargeted metric's row: its value, change against 4 weeks ago and an uncoloured 8-week strip. */
export function buildUntargetedRow(metric: UntargetedMetricConfig, ctx: RowContext): UntargetedRowModel {
  const value = metricCurrentValue(metric, ctx.data, ctx.weekKey);
  return {
    kind: "untargeted",
    metric,
    value,
    change: changeAgainstWeeksAgo(metric, ctx.data, ctx.week, value?.value ?? null),
    history: trendHistory(metric, ctx.data, ctx.week),
  };
}
