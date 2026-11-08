/**
 * View-model rows, one per metric kind. Each kind has its own builder file
 * (weeklyRow.ts, yearRow.ts, untargetedRow.ts) so tickets 03/04/05 can grow
 * their kind without touching the others. Pure.
 */
import type { ScoreboardConfig, UntargetedMetricConfig, WeeklyMetricConfig, YearMetricConfig } from "../config";
import type { ScoreboardData } from "../data";
import type { HistoryWeek } from "../history";
import type { TrendChange, TrendWeek } from "../trend";
import type { MetricValue } from "../values";
import type { CalendarDate, IsoWeek } from "../week";
import type { WeeklyStatus } from "../weeklyScoring";
import type { YearStatus } from "../yearScoring";

/** Everything a row builder may read. `today` comes from the edge (calendarDateIn). */
export interface RowContext {
  config: ScoreboardConfig;
  data: ScoreboardData;
  /** Today in the config timezone. */
  today: CalendarDate;
  /** ISO week containing `today`. */
  week: IsoWeek;
  /** isoWeekKey(week). */
  weekKey: string;
}

export interface WeeklyRowModel {
  kind: "weekly";
  metric: WeeklyMetricConfig;
  /** This week's value; null = no data yet. */
  value: MetricValue | null;
  /** Status for the current week (never "missed": the week is still running). */
  status: WeeklyStatus;
  /** The last 8 completed weeks, oldest first; none before the first week with data. */
  history: HistoryWeek[];
  /** Consecutive weeks hit, counting back from last week, plus this week if already hit. */
  streak: number;
}

export interface YearRowModel {
  kind: "year";
  metric: YearMetricConfig;
  /** Latest value (2027 running total or reading); null = no data yet. */
  value: MetricValue | null;
  /** The plan curve's value today. */
  planValue: number;
  /** Pace tolerance applied (per-metric override or global). */
  paceTolerance: number;
  /** On pace / ahead / behind, with the pace delta. */
  status: YearStatus;
  /** Progress bar fill: value / target, clamped to 0–1. */
  progress: number;
  /** Plan tick position: plan value today / target, clamped to 0–1. */
  planTick: number;
  /** Weeks since a manual value was entered, when it is more than 4 weeks old; else null. */
  updatedWeeksAgo: number | null;
}

/** An untargeted metric: value and trend, no target, never scored. */
export interface UntargetedRowModel {
  kind: "untargeted";
  metric: UntargetedMetricConfig;
  /** This week's value (per-week metrics) or the latest (ad hoc); null = no data. */
  value: MetricValue | null;
  /** The value now minus the value 4 weeks ago; null when either is missing. */
  change: TrendChange | null;
  /** The last 8 completed weeks, oldest first, without verdicts; none before the first week with data. */
  history: TrendWeek[];
}

export type MetricRowModel = WeeklyRowModel | YearRowModel | UntargetedRowModel;
