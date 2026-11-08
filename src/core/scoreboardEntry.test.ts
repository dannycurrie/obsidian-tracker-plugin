import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "./data";
import { buildReviewReport } from "./report";
import {
  escapeTableCell,
  formatExportTime,
  renderScoreboardEntry,
  ScoreboardMarkerError,
  upsertScoreboardEntry,
} from "./scoreboardEntry";

const at = "2027-05-05T10:00:00Z";
const sunday = { year: 2027, month: 5, day: 9 };
const monday = { year: 2027, month: 5, day: 10 };
// 18:40 BST on Sunday 9 May 2027.
const exportedAt = "2027-05-09T17:40:00.000Z";

function sampleData() {
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
  data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 26, enteredAt: at } };
  data.manual.latest["eps"] = { value: 5, enteredAt: at };
  return data;
}

const projects = [
  { path: "🚀 Projects/Tengu launch.md", title: "Tengu launch", goal: { goalId: "career", label: "Career", unknown: false }, nextAction: "Email the beta list" },
  { path: "🚀 Projects/EP one.md", title: "EP one", goal: { goalId: "creative", label: "Creative", unknown: false }, nextAction: null },
];

describe("renderScoreboardEntry", () => {
  it("renders the brief's format for a running week", () => {
    const report = buildReviewReport({ config: sampleConfig(), data: sampleData(), today: sunday, projects });
    const entry = renderScoreboardEntry(report, { exportedAt, timeZone: "Europe/London" });
    const lines = entry.split("\n");
    expect(lines.slice(0, 7)).toEqual([
      "<!-- scoreboard:2027-W18 -->",
      "## Scoreboard — Week 18 (3 May 2027)",
      "",
      "This week: 1/3 weekly targets hit · Year to date: 1/2 on pace · Exported 2027-05-09 18:40",
      "",
      "| Goal | Metric | Value | Target | Status |",
      "| --- | --- | --- | --- | --- |",
    ]);
    expect(entry).toContain("| Career | Tengu WAU | 26 | 25 | Hit |");
    expect(entry).toContain("| Self | Meditation | – | 100 min | 100 to go |");
    expect(entry).toContain("| Creative | Music practice, playing, recording | 40 min | 60 min | 20 to go |");
    expect(entry).toMatch(/\| Creative \| EPs released \| 5 \| 5 \| .* ahead of pace \|/);
    expect(entry).toContain("| Self | Resting heart rate | – | – | No target |");
    expect(lines.slice(-4)).toEqual([
      "**Active projects**",
      "- [[Tengu launch]] — Next: Email the beta list",
      "- [[EP one]] — No next action",
      "<!-- /scoreboard:2027-W18 -->",
    ]);
    expect(entry.endsWith("\n")).toBe(false);
  });

  it("renders 'Missed (N short)' for a Monday export of the ended week", () => {
    const report = buildReviewReport({ config: sampleConfig(), data: sampleData(), today: monday, projects: [] });
    const entry = renderScoreboardEntry(report, { exportedAt: "2027-05-10T07:05:00Z", timeZone: "Europe/London" });
    expect(entry).toContain("## Scoreboard — Week 18 (3 May 2027)");
    expect(entry).toContain("Exported 2027-05-10 08:05");
    expect(entry).toContain("| Creative | Music practice, playing, recording | 40 min | 60 min | Missed (20 short) |");
    expect(entry).toContain("| Self | Meditation | – | 100 min | Missed (100 short) |");
    expect(entry).toContain("| Career | Tengu WAU | 26 | 25 | Hit |");
    expect(entry).toContain("**Active projects**\n- No active projects\n<!-- /scoreboard:2027-W18 -->");
  });

  it("marks stale values and escapes pipes in cells", () => {
    const config = sampleConfig();
    config.goals[1]!.metrics[0]!.label = "Meditation | sits";
    const data = emptyScoreboardData();
    data.snapshots["2027-W18"] = { frozen: false, updatedAt: at, metrics: { meditation: { value: 70, target: 100, source: "tracker", fetchedAt: at } } };
    const report = buildReviewReport({
      config,
      data,
      today: sunday,
      projects: [],
      sources: { tracker: { ok: false, error: "down", failedAt: exportedAt, lastFetchedAt: null } },
    });
    const entry = renderScoreboardEntry(report, { exportedAt, timeZone: "Europe/London" });
    expect(entry).toContain("| Self | Meditation \\| sits | 70 min (stale) | 100 min | 30 to go |");
  });

  it("uses the given wikilink text", () => {
    const report = buildReviewReport({ config: sampleConfig(), data: sampleData(), today: sunday, projects });
    const entry = renderScoreboardEntry(report, { exportedAt, timeZone: "Europe/London", linkText: (p) => p.path.replace(/\.md$/, "") });
    expect(entry).toContain("- [[🚀 Projects/Tengu launch]] — Next: Email the beta list");
  });
});

describe("formatExportTime / escapeTableCell", () => {
  it("formats in the config timezone with a 24-hour clock", () => {
    expect(formatExportTime("2027-01-10T00:05:00Z", "Europe/London")).toBe("2027-01-10 00:05");
    expect(formatExportTime("2027-07-01T23:30:00Z", "Europe/London")).toBe("2027-07-02 00:30");
  });

  it("escapes pipes and flattens line breaks", () => {
    expect(escapeTableCell("a|b\nc")).toBe("a\\|b c");
  });
});

describe("upsertScoreboardEntry", () => {
  const entry = (key: string, body = "new") => `<!-- scoreboard:${key} -->\n${body}\n<!-- /scoreboard:${key} -->`;

  it("appends to an empty note", () => {
    expect(upsertScoreboardEntry("", "2027-W18", entry("2027-W18"))).toEqual({ text: entry("2027-W18") + "\n", action: "appended" });
  });

  it("appends after one blank line, whatever the note ends with", () => {
    const e = entry("2027-W18");
    expect(upsertScoreboardEntry("# Plan", "2027-W18", e).text).toBe(`# Plan\n\n${e}\n`);
    expect(upsertScoreboardEntry("# Plan\n", "2027-W18", e).text).toBe(`# Plan\n\n${e}\n`);
    expect(upsertScoreboardEntry("# Plan\n\n", "2027-W18", e).text).toBe(`# Plan\n\n${e}\n`);
    // Never removes anything the note already had.
    expect(upsertScoreboardEntry("# Plan\n\n\n", "2027-W18", e).text).toBe(`# Plan\n\n\n${e}\n`);
  });

  it("appends a new week after earlier entries", () => {
    const note = `# Plan\n\n${entry("2027-W17", "old")}\n`;
    const { text, action } = upsertScoreboardEntry(note, "2027-W18", entry("2027-W18"));
    expect(action).toBe("appended");
    expect(text).toBe(`${note}\n${entry("2027-W18")}\n`);
  });

  it("replaces the week's entry in place, leaving the rest of the note untouched", () => {
    const before = `# Plan\n\nIntro\n\n${entry("2027-W17", "w17")}\n\n`;
    const after = `\n\n## Notes\nKeep me\n`;
    const note = before + entry("2027-W18", "old\nlines\n| x |") + after;
    const { text, action } = upsertScoreboardEntry(note, "2027-W18", entry("2027-W18", "fresh"));
    expect(action).toBe("replaced");
    expect(text).toBe(before + entry("2027-W18", "fresh") + after);
  });

  it("re-exporting twice gives the same note as exporting once", () => {
    const once = upsertScoreboardEntry("# Plan\n", "2027-W18", entry("2027-W18", "a")).text;
    const twice = upsertScoreboardEntry(once, "2027-W18", entry("2027-W18", "a")).text;
    expect(twice).toBe(once);
  });

  it("tolerates whitespace inside hand-edited markers", () => {
    const note = "x\n<!--scoreboard:2027-W18-->\nold\n<!--  /scoreboard:2027-W18  -->\ny";
    expect(upsertScoreboardEntry(note, "2027-W18", entry("2027-W18")).text).toBe(`x\n${entry("2027-W18")}\ny`);
  });

  it("keeps CRLF line endings", () => {
    const note = "# Plan\r\n";
    expect(upsertScoreboardEntry(note, "2027-W18", entry("2027-W18")).text).toBe(
      "# Plan\r\n\r\n<!-- scoreboard:2027-W18 -->\r\nnew\r\n<!-- /scoreboard:2027-W18 -->\r\n",
    );
  });

  it("refuses an opening marker with no closing one", () => {
    const note = "# Plan\n<!-- scoreboard:2027-W18 -->\nhalf an entry\n";
    expect(() => upsertScoreboardEntry(note, "2027-W18", entry("2027-W18"))).toThrow(ScoreboardMarkerError);
    expect(() => upsertScoreboardEntry(note, "2027-W18", entry("2027-W18"))).toThrow(/no "<!-- \/scoreboard:2027-W18 -->" after it/);
  });

  it("refuses a closing marker with no opening one", () => {
    const note = "# Plan\nstuff\n<!-- /scoreboard:2027-W18 -->\n";
    expect(() => upsertScoreboardEntry(note, "2027-W18", entry("2027-W18"))).toThrow(/with no "<!-- scoreboard:2027-W18 -->"/);
  });

  it("refuses duplicate markers, reversed markers and another week's marker inside the block", () => {
    const e = entry("2027-W18");
    expect(() => upsertScoreboardEntry(`${e}\n${e}\n`, "2027-W18", e)).toThrow(/more than one/);
    expect(() => upsertScoreboardEntry("<!-- /scoreboard:2027-W18 -->\n<!-- scoreboard:2027-W18 -->", "2027-W18", e)).toThrow(/before the opening/);
    const nested = "<!-- scoreboard:2027-W18 -->\n<!-- scoreboard:2027-W17 -->\n<!-- /scoreboard:2027-W18 -->";
    expect(() => upsertScoreboardEntry(nested, "2027-W18", e)).toThrow(/2027-W17/);
  });

  it("ignores other weeks' malformed markers outside the block", () => {
    const note = "<!-- scoreboard:2027-W10 -->\nbroken\n";
    expect(upsertScoreboardEntry(note, "2027-W18", entry("2027-W18")).action).toBe("appended");
  });
});
