import type { UntargetedMetricConfig } from "../config";
import { metricCurrentValue } from "../values";
import type { RowContext, UntargetedRowModel } from "./types";

/** An untargeted metric's row. PLACEHOLDER: ticket 05 adds the trend and strip. */
export function buildUntargetedRow(metric: UntargetedMetricConfig, ctx: RowContext): UntargetedRowModel {
  return { kind: "untargeted", metric, value: metricCurrentValue(metric, ctx.data, ctx.weekKey) };
}
