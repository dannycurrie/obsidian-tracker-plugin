/**
 * Static preview of the Scoreboard view (ticket 11): renders ScoreboardApp to
 * HTML with examples/scoreboard.yaml and sample data for Wed 5 May 2027
 * (week 18, the mockup's sample week), next to styles.css and a small shim
 * of Obsidian's theme variables. Open the .html files in a browser and
 * resize to 360 px and 1440 px. Run: `npm run preview` (writes next to this file).
 *
 * Not shipped; the shim only approximates Obsidian's default theme.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { render } from "preact-render-to-string";
import { validateConfigText } from "../../../src/core/configValidation";
import { emptyScoreboardData, type ScoreboardData } from "../../../src/core/data";
import type { ProjectNote } from "../../../src/core/projects";
import { initialScoreboardState, type ScoreboardState } from "../../../src/core/viewState";
import { ScoreboardApp } from "../../../src/ui/ScoreboardApp";

// Run from the repo root (npm run preview); the bundle lives elsewhere, so no import.meta.url.
const root = process.cwd();
const here = join(root, ".scratch/2027-scoreboard/preview");
const configText = readFileSync(join(root, "examples/scoreboard.yaml"), "utf8");
const { config } = validateConfigText(configText);
if (!config) throw new Error("examples/scoreboard.yaml did not load");

const today = { year: 2027, month: 5, day: 5 };
const now = "2027-05-05T13:00:00.000Z";
const at = (w: number) => `2027-${w < 10 ? "0" : ""}${w}`;

function sampleData(): ScoreboardData {
  const data = emptyScoreboardData();
  data.manual.latest["vanguard-saved"] = { value: 4300, enteredAt: "2027-05-03T19:00:00Z" };
  data.manual.latest["mortgage-overpayment"] = { value: 2900, enteredAt: "2027-05-03T19:00:00Z" };
  data.manual.latest["asl-requests"] = { value: 21, enteredAt: "2027-05-03T19:00:00Z" };
  data.manual.latest["react-migration"] = { value: 12, enteredAt: "2027-03-20T19:00:00Z" }; // > 4 weeks old
  data.manual.latest["time-with-s"] = { value: 4, enteredAt: "2027-05-03T19:00:00Z" };
  data.manual.latest["eps"] = { value: 1, enteredAt: "2027-04-01T19:00:00Z" };
  // 8 completed weeks (W10–W17) and the running week W18, as in the mockup strips.
  const hist: Record<string, { pattern: string; hit: number; miss: number; target: number; now: number }> = {
    "homework-n": { pattern: "11011101", hit: 65, miss: 40, target: 60, now: 60 },
    meditation: { pattern: "10110010", hit: 110, miss: 60, target: 100, now: 70 },
    "feedback-given": { pattern: "01111011", hit: 12, miss: 6, target: 10, now: 11 },
    "music-practice": { pattern: "11100110", hit: 70, miss: 30, target: 60, now: 45 },
    "tengu-wau": { pattern: "00011111", hit: 27, miss: 19, target: 25, now: 26 },
  };
  for (let i = 0; i < 8; i++) {
    const key = `${at(10 + i)}`.replace("2027-", "2027-W");
    const metrics: ScoreboardData["snapshots"][string]["metrics"] = {};
    for (const [id, h] of Object.entries(hist)) {
      const value = h.pattern[i] === "1" ? h.hit : h.miss;
      const tracker = id === "homework-n" || id === "meditation" || id === "feedback-given";
      metrics[id] = { value, target: h.target, ...(tracker ? { source: "tracker" as const, fetchedAt: now } : {}) };
      if (!tracker) data.manual.weekly[id] = { ...data.manual.weekly[id], [key]: { value, enteredAt: now } };
    }
    data.snapshots[key] = { frozen: true, updatedAt: now, metrics };
  }
  const w18: ScoreboardData["snapshots"][string]["metrics"] = {};
  for (const [id, h] of Object.entries(hist)) {
    const tracker = id === "homework-n" || id === "meditation" || id === "feedback-given";
    w18[id] = { value: h.now, target: h.target, ...(tracker ? { source: "tracker" as const, fetchedAt: now } : {}) };
    if (!tracker) data.manual.weekly[id] = { ...data.manual.weekly[id], "2027-W18": { value: h.now, enteredAt: now } };
  }
  data.snapshots["2027-W18"] = { frozen: false, updatedAt: now, metrics: w18 };
  return data;
}

const note = (title: string, status: ProjectNote["status"], goalId: string | null, nextAction: string | null, rank: number | null = null, folder = "🚀 Projects"): ProjectNote => ({
  path: `${folder}/${title}.md`,
  title,
  status,
  rawStatus: status,
  goalId,
  rank,
  nextAction,
});

const projects: ProjectNote[] = [
  note("Tengu launch", "active", "career", "Email the beta list about the March release"),
  note("Remortgage", "active", "finances", "Book a call with the broker", null, "🚀 Projects/Money"),
  note("EP two", "active", "creative", null),
  note("ASL coverage for email", "backlog", "career", null, 1),
  note("Morning routine", "backlog", "self", null, 2),
  note("Family holiday plan", "backlog", "family", null, 3),
  note("Studio rebuild", "backlog", "creative", null, 4),
];

const ready: ScoreboardState = {
  ...initialScoreboardState(),
  status: "ready",
  config,
  configValid: true,
  data: sampleData(),
  loadedAt: now,
  sources: { tracker: { ok: true, fetchedAt: now } },
};

// Edge states: tracker failing (stale), an invalid config banner, 4 active projects, a malformed note.
const states: ScoreboardState = {
  ...ready,
  configValid: false,
  usingLastValidConfig: true,
  configProblems: [{ line: 94, message: 'Metric "homework-n": unknown curve type "monthly".' }],
  sources: {
    tracker: {
      ok: false,
      error: "Tracker API error (HTTP 401): unauthorized",
      failedAt: now,
      lastFetchedAt: "2027-05-05T09:00:00.000Z",
    },
  },
};
const statesProjects: ProjectNote[] = [
  ...projects,
  note("Second album demos", "active", "creative", "Pick 6 songs"),
  { ...note("Typo", null, "career", null), rawStatus: "actve" },
  note("Gardening", "backlog", "garden", null, 5),
];

const noop = () => {};
const actions = { onRefresh: noop, onEnterValues: noop, onExport: noop, onStartCoaching: noop, onOpenNote: noop };

const SHIM = `
body { margin: 0; font-family: var(--font-interface); background: var(--background-secondary); color: var(--text-normal); }
body.theme-light {
  --background-primary: #ffffff; --background-primary-alt: #fafafa; --background-secondary: #f6f6f4;
  --background-modifier-border: #e2e2de; --background-modifier-hover: rgba(0,0,0,0.065);
  --text-normal: #16181d; --text-muted: #5a5e66; --text-error: #e93147; --text-on-accent: #fff;
  --color-blue: #086ddd; --color-blue-rgb: 8, 109, 221; --color-orange: #ec7500; --color-orange-rgb: 236, 117, 0;
  --interactive-normal: #fff; --interactive-accent: #7852ee;
}
body.theme-dark {
  --background-primary: #1e1e1e; --background-primary-alt: #242424; --background-secondary: #161616;
  --background-modifier-border: #363636; --background-modifier-hover: rgba(255,255,255,0.075);
  --text-normal: #dadada; --text-muted: #a3a3a3; --text-error: #fb464c; --text-on-accent: #fff;
  --color-blue: #027aff; --color-blue-rgb: 2, 122, 255; --color-orange: #e9973f; --color-orange-rgb: 233, 151, 63;
  --interactive-normal: #363636; --interactive-accent: #8a5cf5;
}
body { --font-interface: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; --font-monospace: Menlo, monospace; --font-text-size: 16px; --radius-m: 8px; --radius-s: 4px; }
button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); background: var(--interactive-normal); color: var(--text-normal); cursor: pointer; }
button.mod-cta { background: var(--interactive-accent); color: var(--text-on-accent); border-color: transparent; }
a.internal-link { color: var(--interactive-accent); text-decoration: none; }
.view-content { width: 100%; min-height: 100vh; }
/* Phone pages: the view is exactly 360 px wide (headless Chrome can't make a window that narrow). */
body.preview-360 .view-content { width: 360px; outline: 1px dashed #c33; }
`;

function page(title: string, body: string, bodyClass: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${SHIM}</style>
<link rel="stylesheet" href="styles.css">
</head><body class="${bodyClass}"><div class="view-content scoreboard-view">${body}</div></body></html>
`;
}

const normal = render(<ScoreboardApp today={today} state={ready} projectNotes={projects} {...actions} />);
const edge = render(<ScoreboardApp today={today} state={states} projectNotes={statesProjects} {...actions} />);

writeFileSync(join(here, "index.html"), page("Scoreboard preview · light", normal, "theme-light"));
writeFileSync(join(here, "dark.html"), page("Scoreboard preview · dark", normal, "theme-dark"));
writeFileSync(join(here, "phone.html"), page("Scoreboard preview · phone 360 px", normal, "theme-light is-mobile is-phone preview-360"));
writeFileSync(join(here, "states-phone.html"), page("Scoreboard preview · edge states, phone 360 px", edge, "theme-light is-mobile is-phone preview-360"));
writeFileSync(join(here, "states.html"), page("Scoreboard preview · edge states", edge, "theme-light"));
copyFileSync(join(root, "styles.css"), join(here, "styles.css"));
console.log("Wrote index.html, dark.html, phone.html, states.html, states-phone.html and styles.css to", here);
