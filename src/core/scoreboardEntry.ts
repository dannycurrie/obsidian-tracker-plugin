/**
 * Scoreboard entries in the 2027 Plan note (brief › Export to Obsidian;
 * GLOSSARY "Scoreboard entry"): rendering one week's entry as Markdown and
 * putting it into the note text. Pure: no Obsidian imports, no clock.
 *
 * An entry sits between `<!-- scoreboard:YYYY-Www -->` and
 * `<!-- /scoreboard:YYYY-Www -->`. Upserting replaces that week's block in
 * place, or appends a new block at the end of the note; nothing outside the
 * block is ever changed (an append only adds the blank line before it).
 * Markers that don't pair up cleanly make the upsert refuse rather than guess.
 */
import { formatScore } from "./score";
import type { ReportProject, ReviewReport } from "./report";
import type { CalendarDate } from "./week";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 May 2027". */
export function formatLongDate(d: CalendarDate): string {
  return `${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
}

/** An ISO instant as "2027-05-09 18:40" in `timeZone`; throws if unparseable. */
export function formatExportTime(iso: string, timeZone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid export time: ${iso}`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function openingMarker(weekKey: string): string {
  return `<!-- scoreboard:${weekKey} -->`;
}

export function closingMarker(weekKey: string): string {
  return `<!-- /scoreboard:${weekKey} -->`;
}

/** The entry's heading text (no "## "): "Scoreboard — Week 18 (3 May 2027)". Also the link target of the success notice. */
export function entryHeading(report: Pick<ReviewReport, "reviewWeek">): string {
  return `Scoreboard — Week ${report.reviewWeek.week.week} (${formatLongDate(report.reviewWeek.start)})`;
}

/** Escapes text for a Markdown table cell: `|` and line breaks. */
export function escapeTableCell(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

export interface RenderEntryOptions {
  /** ISO instant of the export. */
  exportedAt: string;
  /** Timezone for the exported time (the config's). */
  timeZone: string;
  /** Wikilink text for a project note; default its title. */
  linkText?: (project: ReportProject) => string;
}

/**
 * The scoreboard entry for a report, markers included, without a trailing
 * newline. Stale values carry " (stale)" in the Value column.
 */
export function renderScoreboardEntry(report: ReviewReport, options: RenderEntryOptions): string {
  const key = report.reviewWeek.key;
  const linkText = options.linkText ?? ((p: ReportProject) => p.title);
  const summary =
    `This week: ${formatScore(report.thisWeek)} weekly targets hit · ` +
    `Year to date: ${formatScore(report.yearToDate)} on pace · ` +
    `Exported ${formatExportTime(options.exportedAt, options.timeZone)}`;
  const rows = report.metrics.map((m) => {
    const cells = [m.goal.name, m.metric.label, m.stale ? `${m.valueText} (stale)` : m.valueText, m.targetText, m.statusLabel];
    return `| ${cells.map(escapeTableCell).join(" | ")} |`;
  });
  const projects =
    report.projects.length === 0
      ? ["- No active projects"]
      : report.projects.map(
          (p) => `- [[${linkText(p)}]] — ${p.nextAction === null ? "No next action" : `Next: ${p.nextAction}`}`,
        );
  return [
    openingMarker(key),
    `## ${entryHeading(report)}`,
    "",
    summary,
    "",
    "| Goal | Metric | Value | Target | Status |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "**Active projects**",
    ...projects,
    closingMarker(key),
  ].join("\n");
}

/** The note's scoreboard markers don't pair up; the note is left unchanged. */
export class ScoreboardMarkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoreboardMarkerError";
  }
}

/** Any scoreboard marker, opening or closing, for any week (whitespace inside the comment tolerated). */
const ANY_MARKER = /<!--\s*(\/?)scoreboard:([^\s>]+)\s*-->/g;

interface FoundMarker {
  closing: boolean;
  weekKey: string;
  start: number;
  end: number;
}

function findMarkers(text: string): FoundMarker[] {
  return [...text.matchAll(ANY_MARKER)].map((m) => ({
    closing: m[1] === "/",
    weekKey: m[2]!,
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}

export interface UpsertResult {
  text: string;
  /** "replaced" the week's existing block, or "appended" a new one. */
  action: "replaced" | "appended";
}

/**
 * Puts `entry` (a rendered entry for `weekKey`, markers included) into the
 * note text: replaces that week's block if there is one, else appends it at
 * the end separated by one blank line. Line endings follow the note's.
 *
 * Throws ScoreboardMarkerError (note unchanged) if the week's markers don't
 * pair up: an opening marker with no closing one, a closing one with no
 * opening one, more than one of either, or another week's marker inside the
 * block.
 */
export function upsertScoreboardEntry(noteText: string, weekKey: string, entry: string): UpsertResult {
  const eol = noteText.includes("\r\n") ? "\r\n" : "\n";
  const block = entry.replace(/\r?\n/g, eol);
  const markers = findMarkers(noteText);
  const opens = markers.filter((m) => !m.closing && m.weekKey === weekKey);
  const closes = markers.filter((m) => m.closing && m.weekKey === weekKey);
  const where = `the 2027 Plan note's ${weekKey} scoreboard entry`;

  if (opens.length === 0 && closes.length === 0) {
    const sep = noteText === "" || noteText.endsWith(eol + eol) ? "" : noteText.endsWith(eol) ? eol : eol + eol;
    return { text: noteText + sep + block + eol, action: "appended" };
  }
  if (opens.length > 1 || closes.length > 1) {
    throw new ScoreboardMarkerError(`Found more than one ${opens.length > 1 ? "opening" : "closing"} marker for ${where}. Remove the duplicate, then export again.`);
  }
  if (opens.length === 0) {
    throw new ScoreboardMarkerError(`Found "${closingMarker(weekKey)}" with no "${openingMarker(weekKey)}" before it in ${where}. Fix or remove the marker, then export again.`);
  }
  if (closes.length === 0) {
    throw new ScoreboardMarkerError(`Found "${openingMarker(weekKey)}" with no "${closingMarker(weekKey)}" after it in ${where}. Fix or remove the marker, then export again.`);
  }
  const open = opens[0]!;
  const close = closes[0]!;
  if (close.start < open.start) {
    throw new ScoreboardMarkerError(`The closing marker comes before the opening marker in ${where}. Fix the markers, then export again.`);
  }
  const inside = markers.filter((m) => m.start > open.start && m.start < close.start);
  if (inside.length > 0) {
    throw new ScoreboardMarkerError(`Another scoreboard marker (${inside[0]!.weekKey}) sits inside ${where}. Fix the markers, then export again.`);
  }
  return { text: noteText.slice(0, open.start) + block + noteText.slice(close.end), action: "replaced" };
}
