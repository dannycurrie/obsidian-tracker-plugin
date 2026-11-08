import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import {
  changesSinceLastExport,
  coachingButtonTitle,
  coachingTitle,
  formatDateRange,
  lastEarlierExport,
  renderCoachingMessage,
} from "./coachingMessage";
import { emptyScoreboardData, type ExportRecord, type ScoreboardData } from "./data";
import type { MetricTrackState } from "./goalBadge";
import { buildReviewReport, reviewWeekFor, type ReviewReport } from "./report";

const at = "2027-05-05T10:00:00Z";
// 2027-W18 runs Mon 3 May – Sun 9 May 2027.
const sunday = { year: 2027, month: 5, day: 9 };
const monday = { year: 2027, month: 5, day: 10 };
const PROMPT = "Coach me on this week: challenge where I'm drifting and help me pick next week's focus.";

function report(data: ScoreboardData, today = sunday, extra: Partial<Parameters<typeof buildReviewReport>[0]> = {}): ReviewReport {
  return buildReviewReport({ config: sampleConfig(), data, today, projects: [], ...extra });
}

function message(data: ScoreboardData, today = sunday, extra: Partial<Parameters<typeof buildReviewReport>[0]> = {}): string {
  return renderCoachingMessage(report(data, today, extra), data, { promptTemplate: PROMPT });
}

function exportRecord(week: string, states: Record<string, MetricTrackState>, weekEnded = false): ExportRecord {
  const metrics = Object.fromEntries(Object.entries(states).map(([id, state]) => [id, { state, label: "" }]));
  return { exportedAt: at, week, weekEnded, thisWeek: { achieved: 0, total: 3 }, yearToDate: { achieved: 0, total: 2 }, metrics };
}

/** The lines of one section (heading line included) of a rendered message. */
function sectionOf(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) return [];
  const out = [lines[start]!];
  for (const l of lines.slice(start + 1)) {
    if (!l.startsWith("- ")) break;
    out.push(l);
  }
  return out;
}

describe("formatDateRange / coachingTitle", () => {
  it("writes a week inside one month as '3–9 May 2027'", () => {
    expect(coachingTitle(reviewWeekFor(sunday))).toBe("Weekly scoreboard check-in — Week 18 of 52 (3–9 May 2027)");
  });

  it("spans two months or two years sensibly", () => {
    expect(formatDateRange({ year: 2027, month: 6, day: 28 }, { year: 2027, month: 7, day: 4 })).toBe("28 Jun – 4 Jul 2027");
    expect(formatDateRange({ year: 2026, month: 12, day: 28 }, { year: 2027, month: 1, day: 3 })).toBe("28 Dec 2026 – 3 Jan 2027");
    expect(coachingTitle(reviewWeekFor({ year: 2027, month: 1, day: 4 }))).toBe(
      "Weekly scoreboard check-in — Week 53 of 53 (28 Dec 2026 – 3 Jan 2027)",
    );
  });
});

describe("renderCoachingMessage", () => {
  it("renders the brief's format: title, scores, sections, then the prompt template as the last line", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 30, enteredAt: at } };
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
    data.manual.latest["eps"] = { value: 5, enteredAt: at };
    const projects = [
      { path: "🚀 Projects/A.md", title: "Tengu launch", goal: { goalId: "career", label: "Career", unknown: false }, nextAction: "Email the beta list" },
      { path: "🚀 Projects/B.md", title: "Album", goal: { goalId: "creative", label: "Creative", unknown: false }, nextAction: null },
    ];
    const text = message(data, sunday, { projects });
    const lines = text.split("\n");
    expect(lines[0]).toBe("Weekly scoreboard check-in — Week 18 of 52 (3–9 May 2027)");
    expect(lines[2]).toBe("Scores: this week 1/3 weekly targets hit; year 1/2 on pace.");
    expect(lines.at(-1)).toBe(PROMPT);
    expect(lines.at(-2)).toBe("");

    expect(sectionOf(text, "Behind or missed")).toEqual([
      "Behind or missed:",
      expect.stringMatching(/^- Career · Non-telephony inbound requests serviced by ASL: – vs \d+% planned \(−\d+%\)$/),
      "- Self · Meditation: – / 100 min (100 to go)",
      "- Creative · Music practice, playing, recording: 40 / 60 min (20 to go)",
    ]);
    expect(sectionOf(text, "On track")).toEqual([
      "On track:",
      "- Career · Tengu WAU: 30 / 25 (hit; streak 1)",
      expect.stringMatching(/^- Creative · EPs released: 5 vs [\d.]+ planned \(\+[\d.]+\)$/),
    ]);
    expect(sectionOf(text, "No target")).toEqual([
      "No target:",
      "- Self · Resting heart rate: – (no target set)",
      "- Creative · Gigs played: – (no target set)",
    ]);
    expect(sectionOf(text, "Changed since last export")).toEqual(["Changed since last export: No earlier export"]);
    expect(sectionOf(text, "Active projects")).toEqual([
      "Active projects:",
      "- Tengu launch — Email the beta list",
      "- Album — No next action",
    ]);
    expect(sectionOf(text, "Stale data")).toEqual(["Stale data: none"]);
  });

  it("writes year lines as 'value vs plan planned (±delta)', noting 'within tolerance' when below plan but on pace", () => {
    const data = emptyScoreboardData();
    // EPs plan on Sun 9 May ≈ 1.77 (linear to 5); 1.7 is below plan but within the 0.9 tolerance.
    data.manual.latest["eps"] = { value: 1.7, enteredAt: at };
    const text = message(data);
    expect(sectionOf(text, "On track")).toContainEqual(
      expect.stringMatching(/^- Creative · EPs released: 1\.7 vs 1\.8 planned \(−0\.1, within tolerance\)$/),
    );
  });

  it("mentions a streak at risk while the week runs, and broken once it has ended (streaks of 2+)", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = {
      "2027-W15": { value: 25, enteredAt: at },
      "2027-W16": { value: 25, enteredAt: at },
      "2027-W17": { value: 25, enteredAt: at },
      "2027-W18": { value: 20, enteredAt: at },
    };
    data.manual.weekly["music-practice"] = { "2027-W17": { value: 60, enteredAt: at }, "2027-W18": { value: 10, enteredAt: at } };
    expect(message(data, sunday)).toContain("- Career · Tengu WAU: 20 / 25 (5 to go; streak at risk after 3 weeks)");
    expect(message(data, sunday)).toContain("- Creative · Music practice, playing, recording: 10 / 60 min (50 to go)\n");
    expect(message(data, monday)).toContain("- Career · Tengu WAU: 20 / 25 (missed by 5; streak broken after 3 weeks)");
    expect(message(data, monday)).toContain("- Creative · Music practice, playing, recording: 10 / 60 min (missed by 50)\n");
  });

  it("lists stale metrics with the source error and marks their lines", () => {
    const data = emptyScoreboardData();
    data.snapshots["2027-W18"] = { frozen: false, updatedAt: at, metrics: { meditation: { value: 70, target: 100, source: "tracker", fetchedAt: at } } };
    const text = message(data, sunday, {
      sources: { tracker: { ok: false, error: "HTTP 500", failedAt: "2027-05-09T17:00:00Z", lastFetchedAt: null } },
    });
    expect(text).toContain("- Self · Meditation: 70 / 100 min (30 to go) (stale)");
    expect(sectionOf(text, "Stale data")).toEqual(["Stale data:", expect.stringMatching(/^- Self · Meditation: source failed \(.*HTTP 500.*\); showing last good value 70 min$/)]);
  });

  it("uses the prompt template as given (trimmed), and says when the project notes couldn't be read", () => {
    const r = report(emptyScoreboardData());
    const text = renderCoachingMessage(r, emptyScoreboardData(), { promptTemplate: "  What should I drop?\n", projectsRead: false });
    expect(text.endsWith("\n\nWhat should I drop?")).toBe(true);
    expect(text).toContain("Active projects: couldn't read the project notes");
    expect(renderCoachingMessage(r, emptyScoreboardData(), { promptTemplate: "" })).toMatch(/Stale data: none$/);
  });
});

describe("changed since last export", () => {
  it("compares with the most recent export of an earlier week, ignoring re-exports of the review week", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 30, enteredAt: at } };
    data.exports["2027-W16"] = exportRecord("2027-W16", { "tengu-wau": "on-track", eps: "on-track" });
    data.exports["2027-W17"] = exportRecord("2027-W17", { "tengu-wau": "behind", eps: "on-track", asl: "on-track" }, true);
    data.exports["2027-W18"] = exportRecord("2027-W18", { "tengu-wau": "in-progress", eps: "behind", asl: "behind" });
    expect(lastEarlierExport(data, { year: 2027, week: 18 })?.key).toBe("2027-W17");
    expect(sectionOf(message(data), "Changed since last export")).toEqual([
      "Changed since last export (week 17):",
      "- Career · Tengu WAU: missed → hit",
      "- Career · Non-telephony inbound requests serviced by ASL: on pace → behind pace",
      "- Creative · EPs released: on pace → behind pace",
    ]);
  });

  it("leaves out weekly metrics still in progress unless already hit, and untargeted metrics", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 10, enteredAt: at } };
    data.exports["2027-W17"] = exportRecord("2027-W17", { "music-practice": "on-track", meditation: "on-track", gigs: "unscored", eps: "behind", asl: "behind" });
    const changes = changesSinceLastExport(report(data), data);
    expect(changes).toEqual({ kind: "compared", week: { year: 2027, week: 17 }, changes: [] });
    expect(sectionOf(message(data), "Changed since last export")).toEqual(["Changed since last export (week 17): none"]);
    // The same week once it has ended: the misses are final and listed.
    expect(sectionOf(message(data, monday), "Changed since last export")).toEqual([
      "Changed since last export (week 17):",
      "- Self · Meditation: hit → missed",
      "- Creative · Music practice, playing, recording: hit → missed",
    ]);
  });

  it("prefers the earlier week's frozen snapshot verdict over a mid-week export's 'in progress'", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 30, enteredAt: at } };
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 60, enteredAt: at } };
    // Exported on Sunday of W17 while it ran; the week then finished hit (tengu) and missed (music).
    data.exports["2027-W17"] = exportRecord("2027-W17", { "tengu-wau": "in-progress", "music-practice": "in-progress", eps: "behind", asl: "behind" });
    data.snapshots["2027-W17"] = {
      frozen: true,
      updatedAt: at,
      metrics: { "tengu-wau": { value: 25, target: 25, verdict: "hit" }, "music-practice": { value: 10, target: 60, verdict: "missed" } },
    };
    expect(sectionOf(message(data), "Changed since last export")).toEqual([
      "Changed since last export (week 17):",
      "- Creative · Music practice, playing, recording: missed → hit",
    ]);
  });

  it("falls back to the export record when the snapshot isn't frozen, and names the year of a week in another year", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = { "2027-W01": { value: 30, enteredAt: at } };
    data.exports["2026-W53"] = exportRecord("2026-W53", { "tengu-wau": "in-progress" });
    data.snapshots["2026-W53"] = { frozen: false, updatedAt: at, metrics: { "tengu-wau": { value: 25, target: 25, verdict: "hit" } } };
    const text = message(data, { year: 2027, month: 1, day: 10 });
    expect(sectionOf(text, "Changed since last export")).toEqual([
      "Changed since last export (week 53 of 2026):",
      "- Career · Tengu WAU: in progress → hit",
    ]);
  });
});

describe("coachingButtonTitle", () => {
  it("names the review week, and says so on a Monday", () => {
    expect(coachingButtonTitle(reviewWeekFor(sunday))).toBe("Copy week 18's scoreboard and open the coaching chat");
    expect(coachingButtonTitle(reviewWeekFor(monday))).toContain("just-finished week 18");
  });
});
