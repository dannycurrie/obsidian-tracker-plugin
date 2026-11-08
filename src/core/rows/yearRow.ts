import type { YearMetricConfig } from "../config";
import { planValueOn } from "../planCurve";
import { metricLatestValue } from "../values";
import { manualValueWeeksOld, paceToleranceFor, yearStatus } from "../yearScoring";
import type { RowContext, YearRowModel } from "./types";

function fraction(n: number, of: number): number {
  if (of <= 0) return n > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, n / of));
}

/** A year metric's row: its value against the plan curve today. */
export function buildYearRow(metric: YearMetricConfig, ctx: RowContext): YearRowModel {
  const value = metricLatestValue(metric, ctx.data);
  const planValue = planValueOn(metric.plan, metric.target, ctx.config.year, ctx.today);
  const paceTolerance = paceToleranceFor(metric, ctx.config);
  return {
    kind: "year",
    metric,
    value,
    planValue,
    paceTolerance,
    status: yearStatus(value?.value ?? null, planValue, paceTolerance),
    progress: fraction(value?.value ?? 0, metric.target),
    planTick: fraction(planValue, metric.target),
    updatedWeeksAgo:
      value && value.source === "manual" ? manualValueWeeksOld(value.at, ctx.today, ctx.config.timezone) : null,
  };
}
