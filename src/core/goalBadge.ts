/**
 * Goal badge (brief › Scoring rules, Screen layout): "x / y on track" per
 * goal card. Pure.
 *
 * - x = metrics on track (weekly hit, year on pace); y = scored metrics.
 *   Untargeted metrics are left out of both numbers.
 * - Tone: blue ("on-track") if every scored metric is on track; orange
 *   ("behind") only if none is on track AND at least one is actually behind
 *   (year) or missed (weekly, week ended); grey ("neutral") otherwise.
 * - A weekly metric still in progress counts as not on track in the numbers
 *   but never turns the badge orange. In the current week a weekly row is
 *   never "missed", so on a Monday morning a goal with only weekly metrics
 *   reads "0 / n on track" in grey.
 * - A goal with no scored metrics (none, or only untargeted) gets a grey
 *   "no targets set" badge rather than "0 / 0 on track".
 */
import type { MetricRowModel } from "./rows/types";

/** One metric's verdict for the badge and for export / coaching. */
export type MetricTrackState =
  /** Weekly hit, or year on pace (or ahead). */
  | "on-track"
  /** Year behind pace, or weekly missed (week ended). */
  | "behind"
  /** Weekly metric not yet hit while its week is still running. */
  | "in-progress"
  /** Untargeted: not scored. */
  | "unscored";

/** Badge colour: blue / orange / grey. */
export type BadgeTone = "on-track" | "behind" | "neutral";

export interface GoalBadge {
  /** Metrics on track. */
  onTrack: number;
  /** Scored metrics (weekly + year). */
  scored: number;
  tone: BadgeTone;
}

/** A row's verdict as the badge sees it. */
export function metricTrackState(row: MetricRowModel): MetricTrackState {
  switch (row.kind) {
    case "weekly":
      return row.status.state === "hit" ? "on-track" : row.status.state === "missed" ? "behind" : "in-progress";
    case "year":
      return row.status.onPace ? "on-track" : "behind";
    case "untargeted":
      return "unscored";
  }
}

/** The badge from per-metric verdicts. */
export function goalBadgeFromStates(states: readonly MetricTrackState[]): GoalBadge {
  const scored = states.filter((s) => s !== "unscored");
  const onTrack = scored.filter((s) => s === "on-track").length;
  const anyBehind = scored.includes("behind");
  const tone: BadgeTone =
    scored.length > 0 && onTrack === scored.length ? "on-track" : onTrack === 0 && anyBehind ? "behind" : "neutral";
  return { onTrack, scored: scored.length, tone };
}

/** The badge for a goal card's rows. */
export function goalBadge(rows: readonly MetricRowModel[]): GoalBadge {
  return goalBadgeFromStates(rows.map(metricTrackState));
}

/** Badge copy: "2 / 3 on track", or "no targets set" for a goal with nothing scored. */
export function goalBadgeLabel(badge: GoalBadge): string {
  return badge.scored === 0 ? "no targets set" : `${badge.onTrack} / ${badge.scored} on track`;
}
