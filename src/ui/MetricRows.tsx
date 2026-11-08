/**
 * One row component per metric kind. Tickets 03 (year), 04 (weekly history
 * strip and streak) and 05 (untargeted) each own their row component.
 */
import { formatValue, formatValueOverTarget, NO_VALUE, valueSourceTitle } from "../core/format";
import type { MetricRowModel, UntargetedRowModel, WeeklyRowModel, YearRowModel } from "../core/model";
import { weeklyStatusLabel } from "../core/weeklyScoring";
import { HistoryStrip } from "./HistoryStrip";

export function MetricRow({ row, timeZone }: { row: MetricRowModel; timeZone: string }) {
  switch (row.kind) {
    case "weekly":
      return <WeeklyMetricRow row={row} timeZone={timeZone} />;
    case "year":
      return <YearMetricRow row={row} timeZone={timeZone} />;
    case "untargeted":
      return <UntargetedMetricRow row={row} timeZone={timeZone} />;
  }
}

interface RowProps<R> {
  row: R;
  timeZone: string;
}

/** Status colour class: blue for hit / on track, grey for neutral, orange for behind / missed. */
function statusClass(row: WeeklyRowModel): string {
  switch (row.status.state) {
    case "hit":
      return "is-on-track";
    case "in-progress":
      return "is-neutral";
    case "missed":
      return "is-behind";
  }
}

export function WeeklyMetricRow({ row, timeZone }: RowProps<WeeklyRowModel>) {
  const { metric, value, status } = row;
  return (
    <li class={`scoreboard-metric scoreboard-metric--weekly ${statusClass(row)}`} data-metric-id={metric.id}>
      <div class="scoreboard-metric__label">{metric.label}</div>
      <div class="scoreboard-metric__value" title={value ? valueSourceTitle(value, timeZone) : "No value this week"}>
        {formatValueOverTarget(value?.value ?? null, metric.target, metric.unit)}
      </div>
      <HistoryStrip weeks={row.history} unit={metric.unit} />
      <div class="scoreboard-metric__status">{weeklyStatusLabel(status, row.streak)}</div>
    </li>
  );
}

/** PLACEHOLDER for ticket 03: value / target only. */
export function YearMetricRow({ row, timeZone }: RowProps<YearRowModel>) {
  const { metric, value } = row;
  return (
    <li class="scoreboard-metric scoreboard-metric--year is-neutral" data-metric-id={metric.id}>
      <div class="scoreboard-metric__label">{metric.label}</div>
      <div class="scoreboard-metric__value" title={value ? valueSourceTitle(value, timeZone) : "No value yet"}>
        {formatValueOverTarget(value?.value ?? null, metric.target, metric.unit)}
      </div>
    </li>
  );
}

/** PLACEHOLDER for ticket 05: value and "no target set". */
export function UntargetedMetricRow({ row, timeZone }: RowProps<UntargetedRowModel>) {
  const { metric, value } = row;
  return (
    <li class="scoreboard-metric scoreboard-metric--untargeted is-neutral" data-metric-id={metric.id}>
      <div class="scoreboard-metric__label">{metric.label}</div>
      <div class="scoreboard-metric__value" title={value ? valueSourceTitle(value, timeZone) : "No value yet"}>
        {value ? formatValue(value.value, metric.unit) : NO_VALUE}
      </div>
      <div class="scoreboard-metric__status">no target set</div>
    </li>
  );
}
