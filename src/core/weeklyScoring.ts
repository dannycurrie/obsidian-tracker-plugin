/**
 * Weekly metric scoring (brief › Scoring rules). Pure.
 *
 * Hit: the week's value is at or above that week's target. During the
 * current week a metric counts as hit as soon as the target is reached; it is
 * only missed once the week has ended (including a week with no data).
 */
import { formatNumber } from "./format";
import type { Score } from "./score";

export type WeeklyStatus =
  | { state: "hit" }
  /** Week still running, target not yet reached. */
  | { state: "in-progress"; toGo: number }
  /** Week ended without reaching the target (no data counts as 0). */
  | { state: "missed"; short: number };

/** The hit rule. No data is never a hit. */
export function isWeeklyHit(value: number | null, target: number): boolean {
  return value !== null && value >= target;
}

/** A weekly metric's status for one week. */
export function weeklyStatus(value: number | null, target: number, weekEnded: boolean): WeeklyStatus {
  if (isWeeklyHit(value, target)) return { state: "hit" };
  const remaining = target - (value ?? 0);
  return weekEnded ? { state: "missed", short: remaining } : { state: "in-progress", toGo: remaining };
}

/** This week score: weekly metrics hit so far / number of weekly metrics. */
export function thisWeekScore(statuses: readonly WeeklyStatus[]): Score {
  return { achieved: statuses.filter((s) => s.state === "hit").length, total: statuses.length };
}

/** Row copy: "Hit", "N to go this week" or "Missed (N short)". Ticket 04 adds the streak. */
export function weeklyStatusLabel(status: WeeklyStatus): string {
  switch (status.state) {
    case "hit":
      return "Hit";
    case "in-progress":
      return `${formatNumber(status.toGo)} to go this week`;
    case "missed":
      return `Missed (${formatNumber(status.short)} short)`;
  }
}
