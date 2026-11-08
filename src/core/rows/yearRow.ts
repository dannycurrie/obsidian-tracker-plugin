import type { YearMetricConfig } from "../config";
import { metricLatestValue } from "../values";
import type { RowContext, YearRowModel } from "./types";

/** A year metric's row. PLACEHOLDER: ticket 03 adds plan value, pace and labels. */
export function buildYearRow(metric: YearMetricConfig, ctx: RowContext): YearRowModel {
  return { kind: "year", metric, value: metricLatestValue(metric, ctx.data) };
}
