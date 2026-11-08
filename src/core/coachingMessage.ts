/**
 * The Start coaching chat context message (brief › Start coaching chat;
 * ticket 10): the review week's scoreboard as plain text to paste into the
 * ongoing coaching chat. Pure: no Obsidian imports, no clock. Everything it
 * says about the review week comes from the review report (report.ts), so it
 * agrees with Export to Obsidian.
 *
 * Format (each section is a heading line, then one "- " line per item; an
 * empty section reads "Heading: none" on one line):
 *
 *   Weekly scoreboard check-in — Week 18 of 52 (3–9 May 2027)
 *
 *   Scores: this week 2/5 weekly targets hit; year 3/6 on pace.
 *
 *   Behind or missed:            weekly not hit (in progress or missed), year behind pace
 *   On track:                    weekly hit, year on pace
 *   No target:                   untargeted metrics; omitted when there are none
 *   Changed since last export (week 17):
 *   Active projects:
 *   Stale data:                  "none" when every source refreshed fine
 *
 *   <prompt template>
 *
 * Changed since last export: each metric's status now against the most
 * recent export of an EARLIER week (re-exports of the review week are
 * ignored). The baseline for a weekly metric is the final verdict in that
 * week's frozen snapshot when there is one (an export made mid-week may have
 * recorded "in progress"), else the export record's state. Weekly metrics
 * still in progress now are left out (only a hit counts as a status yet);
 * untargeted metrics have no status and are never listed.
 */
import type { MetricConfig } from "./config";
import type { ExportRecord, ScoreboardData } from "./data";
import { formatNumber, formatValue, formatValueOverTarget } from "./format";
import type { MetricTrackState } from "./goalBadge";
import { formatScore } from "./score";
import type { ReportMetric, ReviewReport, ReviewWeek } from "./report";
import { formatLongDate } from "./scoreboardEntry";
import { compareIsoWeeks, parseIsoWeekKey, weekOfYearLabel, type CalendarDate, type IsoWeek } from "./week";
import { roundPaceDelta } from "./yearScoring";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A weekly streak this long or longer is worth mentioning when it is at risk or broken. */
export const STREAK_MENTION_WEEKS = 2;

/**
 * A Monday–Sunday range: "3–9 May 2027", "28 Jun – 4 Jul 2027",
 * "28 Dec 2026 – 3 Jan 2027".
 */
export function formatDateRange(start: CalendarDate, end: CalendarDate): string {
  if (start.year !== end.year) return `${formatLongDate(start)} – ${formatLongDate(end)}`;
  if (start.month !== end.month) return `${start.day} ${MONTHS[start.month - 1]} – ${formatLongDate(end)}`;
  return `${start.day}–${formatLongDate(end)}`;
}

/** "Weekly scoreboard check-in — Week 18 of 52 (3–9 May 2027)". */
export function coachingTitle(reviewWeek: ReviewWeek): string {
  return `Weekly scoreboard check-in — ${weekOfYearLabel(reviewWeek.week)} (${formatDateRange(reviewWeek.start, reviewWeek.end)})`;
}

/** A plan value or delta rounded like the pace labels, keeping its sign. */
function roundSigned(n: number): number {
  return Math.sign(n) * roundPaceDelta(n);
}

/** "+£150", "−£560", "+0". */
function signedValue(n: number, unit: string): string {
  const rounded = roundSigned(n);
  return `${rounded < 0 ? "−" : "+"}${formatValue(Math.abs(rounded), unit)}`;
}

function metricName(m: ReportMetric): string {
  return `${m.goal.name} · ${m.metric.label}`;
}

/** What the line says after "Goal · Label: ", by kind and state. */
function metricDetail(m: ReportMetric): string {
  const unit = m.metric.unit;
  if (m.weekly && m.target !== null) {
    const valueOverTarget = formatValueOverTarget(m.value?.value ?? null, m.target, unit);
    const { status, streak } = m.weekly;
    switch (status.state) {
      case "hit":
        return `${valueOverTarget} (hit; streak ${streak})`;
      case "in-progress": {
        const risk = streak >= STREAK_MENTION_WEEKS ? `; streak at risk after ${streak} weeks` : "";
        return `${valueOverTarget} (${formatNumber(status.toGo)} to go${risk})`;
      }
      case "missed": {
        const broken = streak >= STREAK_MENTION_WEEKS ? `; streak broken after ${streak} weeks` : "";
        return `${valueOverTarget} (missed by ${formatNumber(status.short)}${broken})`;
      }
    }
  }
  if (m.year) {
    const { status, planValue } = m.year;
    const planned = formatValue(roundSigned(planValue), unit);
    const within = status.state === "on-pace" ? ", within tolerance" : "";
    return `${m.valueText} vs ${planned} planned (${signedValue(status.delta, unit)}${within})`;
  }
  return `${m.valueText} (no target set)`;
}

function metricLine(m: ReportMetric): string {
  return `- ${metricName(m)}: ${metricDetail(m)}${m.stale ? " (stale)" : ""}`;
}

/** A section: "Heading:" then its lines, or "Heading: none". */
function section(heading: string, lines: readonly string[], empty = "none"): string {
  return lines.length === 0 ? `${heading}: ${empty}` : [`${heading}:`, ...lines].join("\n");
}

/** The most recent export of a week earlier than `week`, with its week; null if none. */
export function lastEarlierExport(
  data: ScoreboardData,
  week: IsoWeek,
): { week: IsoWeek; key: string; record: ExportRecord } | null {
  let best: { week: IsoWeek; key: string; record: ExportRecord } | null = null;
  for (const [key, record] of Object.entries(data.exports)) {
    const w = parseIsoWeekKey(key);
    if (!w || compareIsoWeeks(w, week) >= 0) continue;
    if (!best || compareIsoWeeks(w, best.week) > 0) best = { week: w, key, record };
  }
  return best;
}

/** One metric whose status flipped since the last export. */
export interface StatusChange {
  metric: ReportMetric;
  from: MetricTrackState;
  to: MetricTrackState;
}

/** A frozen snapshot's weekly verdict as a track state; null if there isn't one. */
function frozenWeeklyState(data: ScoreboardData, weekKey: string, metricId: string): MetricTrackState | null {
  const snapshot = data.snapshots[weekKey];
  if (!snapshot?.frozen) return null;
  switch (snapshot.metrics[metricId]?.verdict) {
    case "hit":
      return "on-track";
    case "missed":
      return "behind";
    default:
      return null;
  }
}

export type ChangesSinceExport =
  | { kind: "no-earlier-export" }
  | { kind: "compared"; week: IsoWeek; changes: StatusChange[] };

/** Metrics whose status differs from the last export of an earlier week (see the module comment). */
export function changesSinceLastExport(report: ReviewReport, data: ScoreboardData): ChangesSinceExport {
  const last = lastEarlierExport(data, report.reviewWeek.week);
  if (!last) return { kind: "no-earlier-export" };
  const changes: StatusChange[] = [];
  for (const m of report.metrics) {
    if (m.state === "unscored" || m.state === "in-progress") continue;
    const recorded = last.record.metrics[m.metric.id]?.state;
    const from = (m.weekly ? frozenWeeklyState(data, last.key, m.metric.id) : null) ?? recorded;
    if (from === undefined || from === "unscored" || from === m.state) continue;
    changes.push({ metric: m, from, to: m.state });
  }
  return { kind: "compared", week: last.week, changes };
}

/** Status words for a change line: "hit" / "missed" (weekly), "on pace" / "behind pace" (year). */
function stateWord(metric: MetricConfig, state: MetricTrackState): string {
  switch (state) {
    case "on-track":
      return metric.kind === "weekly" ? "hit" : "on pace";
    case "behind":
      return metric.kind === "weekly" ? "missed" : "behind pace";
    case "in-progress":
      return "in progress";
    case "unscored":
      return "no target";
  }
}

function changesSection(changes: ChangesSinceExport, reviewYear: number): string {
  if (changes.kind === "no-earlier-export") return "Changed since last export: No earlier export";
  const w = changes.week;
  const heading = `Changed since last export (week ${w.week}${w.year !== reviewYear ? ` of ${w.year}` : ""})`;
  const lines = changes.changes.map(
    (c) => `- ${metricName(c.metric)}: ${stateWord(c.metric.metric, c.from)} → ${stateWord(c.metric.metric, c.to)}`,
  );
  return section(heading, lines);
}

function staleLine(m: ReportMetric): string {
  const error = m.value?.stale?.error;
  return `- ${metricName(m)}: source failed${error ? ` (${error})` : ""}; showing last good value ${m.valueText}`;
}

export interface CoachingMessageOptions {
  /** The final line(s): the coaching prompt template from settings. */
  promptTemplate: string;
  /**
   * False when the project notes couldn't be read (the report then has no
   * projects); the section says so instead of "none". Default true.
   */
  projectsRead?: boolean;
}

/** Renders the coaching context message for a review report. No trailing newline. */
export function renderCoachingMessage(report: ReviewReport, data: ScoreboardData, options: CoachingMessageOptions): string {
  const behind = report.metrics.filter((m) => m.state === "behind" || m.state === "in-progress");
  const onTrack = report.metrics.filter((m) => m.state === "on-track");
  const untargeted = report.metrics.filter((m) => m.state === "unscored");
  const projects = report.projects.map((p) => `- ${p.title} — ${p.nextAction ?? "No next action"}`);

  const parts = [
    coachingTitle(report.reviewWeek),
    `Scores: this week ${formatScore(report.thisWeek)} weekly targets hit; year ${formatScore(report.yearToDate)} on pace.`,
    [
      section("Behind or missed", behind.map(metricLine)),
      section("On track", onTrack.map(metricLine)),
      ...(untargeted.length > 0 ? [section("No target", untargeted.map(metricLine))] : []),
      changesSection(changesSinceLastExport(report, data), report.reviewWeek.week.year),
      section("Active projects", projects, options.projectsRead === false ? "couldn't read the project notes" : "none"),
      section("Stale data", report.stale.map(staleLine)),
    ].join("\n"),
  ];
  const prompt = options.promptTemplate.trim();
  if (prompt) parts.push(prompt);
  return parts.join("\n\n");
}

/** Header button tooltip: which week the coaching context covers. */
export function coachingButtonTitle(reviewWeek: ReviewWeek): string {
  const n = reviewWeek.week.week;
  return reviewWeek.ended
    ? `Copy the just-finished week ${n}'s scoreboard and open the coaching chat (on Mondays it covers last week)`
    : `Copy week ${n}'s scoreboard and open the coaching chat`;
}
