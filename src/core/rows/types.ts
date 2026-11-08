/**
 * View-model rows, one per metric kind. Each kind has its own builder file
 * (weeklyRow.ts, yearRow.ts, untargetedRow.ts) so tickets 03/04/05 can grow
 * their kind without touching the others. Pure.
 */
import type { ScoreboardConfig, UntargetedMetricConfig, WeeklyMetricConfig, YearMetricConfig } from "../config";
import type { ScoreboardData } from "../data";
import type { HistoryWeek } from "../history";
import type { MetricValue } from "../values";
import type { CalendarDate, IsoWeek } from "../week";
import type { WeeklyStatus } from "../weeklyScoring";

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

/** PLACEHOLDER for ticket 03 (plan curve, pace delta, pace label, staleness). */
export interface YearRowModel {
  kind: "year";
  metric: YearMetricConfig;
  /** Latest value (2027 running total or reading); null = no data yet. */
  value: MetricValue | null;
}

/** PLACEHOLDER for ticket 05 (4-week change, uncoloured strip). */
export interface UntargetedRowModel {
  kind: "untargeted";
  metric: UntargetedMetricConfig;
  value: MetricValue | null;
}

export type MetricRowModel = WeeklyRowModel | YearRowModel | UntargetedRowModel;
