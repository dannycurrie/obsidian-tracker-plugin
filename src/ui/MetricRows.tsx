/**
 * One row component per metric kind. Tickets 03 (year), 04 (weekly history
 * strip and streak) and 05 (untargeted) each own their row component.
 */
import { formatValue, formatValueOverTarget, NO_VALUE, valueSourceTitle } from "../core/format";
import type { MetricRowModel, UntargetedRowModel, WeeklyRowModel, YearRowModel } from "../core/model";
import { weeklyStatusLabel } from "../core/weeklyScoring";
import { updatedWeeksAgoLabel, yearStatusLabel } from "../core/yearScoring";
import { HistoryStrip } from "./HistoryStrip";
import { StaleBadge } from "./StaleBadge";

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
        <StaleBadge value={value} />
      </div>
      <HistoryStrip weeks={row.history} unit={metric.unit} />
      <div class="scoreboard-metric__status">{weeklyStatusLabel(status, row.streak)}</div>
    </li>
  );
}

/** Status colour class for a year row: blue ahead / on pace, orange behind. */
function yearStatusClass(row: YearRowModel): string {
  return row.status.onPace ? "is-on-track" : "is-behind";
}

const percent = (f: number) => `${Math.round(f * 1000) / 10}%`;

export function YearMetricRow({ row, timeZone }: RowProps<YearRowModel>) {
  const { metric, value, status, planValue, progress, planTick, updatedWeeksAgo } = row;
  const planText = `Plan today: ${formatValue(Math.round(planValue * 10) / 10, metric.unit)}`;
  return (
    <li class={`scoreboard-metric scoreboard-metric--year ${yearStatusClass(row)}`} data-metric-id={metric.id}>
      <div class="scoreboard-metric__label">{metric.label}</div>
      <div class="scoreboard-metric__value" title={value ? valueSourceTitle(value, timeZone) : "No value yet"}>
        {formatValueOverTarget(value?.value ?? null, metric.target, metric.unit)}
        <StaleBadge value={value} />
      </div>
      <div
        class="scoreboard-progress"
        role="img"
        aria-label={`${percent(progress)} of target; ${planText}`}
        title={planText}
      >
        <div class="scoreboard-progress__fill" style={{ width: percent(progress) }} />
        <div class="scoreboard-progress__plan-tick" style={{ left: percent(planTick) }} />
      </div>
      <div class="scoreboard-metric__status">
        {yearStatusLabel(status, metric.unit)}
        {updatedWeeksAgo !== null && (
          <span class="scoreboard-metric__age"> · {updatedWeeksAgoLabel(updatedWeeksAgo)}</span>
        )}
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
        <StaleBadge value={value} />
      </div>
      <div class="scoreboard-metric__status">no target set</div>
    </li>
  );
}
