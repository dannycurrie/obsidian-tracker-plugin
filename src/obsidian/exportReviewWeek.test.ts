import { describe, expect, it } from "vitest";
import { memoryIO } from "../../tests/fixtures/memoryIO";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData, readScoreboardData, parseDataDocument, type DataPatch } from "../core/data";
import type { ActiveProject } from "../core/projects";
import { initialScoreboardState, type ScoreboardState } from "../core/viewState";
import { DataFileRepository } from "./DataFileRepository";
import { exportReviewWeek, type ExportDeps } from "./exportReviewWeek";

const PLAN = "🗺️ Plans/🎯 2027 Plan/2027 Plan.md";
const DATA = "🗺️ Plans/🎯 2027 Plan/scoreboard-data.json";
const at = "2027-05-05T10:00:00Z";
// Sunday 9 May 2027 18:40 BST (2027-W18 still running).
const sundayEvening = new Date("2027-05-09T17:40:00Z");
// Monday 10 May 2027 09:00 BST.
const mondayMorning = new Date("2027-05-10T08:00:00Z");

const projects: ActiveProject[] = [
  { path: "🚀 Projects/Tengu launch.md", title: "Tengu launch", goal: { goalId: "career", label: "Career", unknown: false }, nextAction: "Email the beta list" },
];

function readyState(overrides: Partial<ScoreboardState> = {}): ScoreboardState {
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
  return { ...initialScoreboardState(), status: "ready", config: sampleConfig(), configValid: true, data, ...overrides };
}

function setup(note: string | null = "# 2027 Plan\n", overrides: Partial<ExportDeps> = {}) {
  const fake = memoryIO(note === null ? {} : { [PLAN]: note });
  const repo = new DataFileRepository(fake.io, () => DATA);
  const deps: ExportDeps = {
    state: readyState(),
    projects,
    now: sundayEvening,
    planNotePath: PLAN,
    // Like vault.process: a missing file or a throwing fn writes nothing.
    processNote: async (path, fn) => {
      const text = fake.files.get(path);
      if (text === undefined) throw new Error(`No note at "${path}".`);
      fake.files.set(path, fn(text));
      fake.writes.push(path);
    },
    updateData: (patch: DataPatch) => repo.update(patch),
    ...overrides,
  };
  const data = () => readScoreboardData(parseDataDocument(fake.files.get(DATA) ?? null));
  return { fake, deps, data };
}

describe("exportReviewWeek", () => {
  it("appends the first entry of a week to the end of the plan note and links its heading", async () => {
    const { fake, deps } = setup();
    const outcome = await exportReviewWeek(deps);
    expect(outcome).toMatchObject({ ok: true, action: "appended", notePath: PLAN, heading: "Scoreboard — Week 18 (3 May 2027)", dataError: null });
    const text = fake.files.get(PLAN)!;
    expect(text.startsWith("# 2027 Plan\n\n<!-- scoreboard:2027-W18 -->\n## Scoreboard — Week 18 (3 May 2027)\n")).toBe(true);
    expect(text).toContain("Exported 2027-05-09 18:40");
    expect(text).toContain("| Creative | Music practice, playing, recording | 40 min | 60 min | 20 to go |");
    expect(text).toContain("- [[Tengu launch]] — Next: Email the beta list");
    expect(text.endsWith("<!-- /scoreboard:2027-W18 -->\n")).toBe(true);
  });

  it("re-export in the same week replaces the entry in place", async () => {
    const { fake, deps } = setup("# 2027 Plan\n\nIntro\n");
    await exportReviewWeek(deps);
    fake.files.set(PLAN, fake.files.get(PLAN)! + "\n## Later notes\nKeep me\n");
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 75, enteredAt: at } };
    const outcome = await exportReviewWeek({ ...deps, state: readyState({ data }), now: new Date("2027-05-09T19:00:00Z") });
    expect(outcome).toMatchObject({ ok: true, action: "replaced" });
    const text = fake.files.get(PLAN)!;
    expect(text.match(/<!-- scoreboard:2027-W18 -->/g)).toHaveLength(1);
    expect(text).toContain("| 75 min | 60 min | Hit |");
    expect(text).not.toContain("20 to go");
    expect(text.startsWith("# 2027 Plan\n\nIntro\n\n<!-- scoreboard:2027-W18 -->")).toBe(true);
    expect(text.endsWith("<!-- /scoreboard:2027-W18 -->\n\n## Later notes\nKeep me\n")).toBe(true);
  });

  it("on a Monday exports the just-finished week with final labels", async () => {
    const { fake, deps } = setup();
    const outcome = await exportReviewWeek({ ...deps, now: mondayMorning });
    expect(outcome).toMatchObject({ ok: true, report: { reviewWeek: { key: "2027-W18", ended: true } } });
    expect(fake.files.get(PLAN)).toContain("| 40 min | 60 min | Missed (20 short) |");
  });

  it("writes the week snapshot and an export record to the data file", async () => {
    const { deps, data } = setup();
    await exportReviewWeek(deps);
    const d = data();
    expect(d.snapshots["2027-W18"]!.metrics["music-practice"]).toMatchObject({ value: 40, target: 60, verdict: "in-progress" });
    expect(d.exports["2027-W18"]).toMatchObject({
      exportedAt: sundayEvening.toISOString(),
      week: "2027-W18",
      weekEnded: false,
      thisWeek: { achieved: 0, total: 3 },
      yearToDate: { achieved: 0, total: 2 },
    });
    expect(d.exports["2027-W18"]!.metrics["music-practice"]).toEqual({ state: "in-progress", label: "20 to go" });
  });

  it("a Monday export freezes the just-finished week's snapshot", async () => {
    const { deps, data } = setup();
    await exportReviewWeek({ ...deps, now: mondayMorning });
    expect(data().snapshots["2027-W18"]).toMatchObject({ frozen: true });
    expect(data().exports["2027-W18"]!.metrics["music-practice"]).toEqual({ state: "behind", label: "Missed (20 short)" });
  });

  it("is blocked with an explanation while the config is invalid, writing nothing", async () => {
    const { fake, deps } = setup();
    const state = readyState({ configProblems: [{ message: "Unknown curve type", line: 12 }] });
    const outcome = await exportReviewWeek({ ...deps, state });
    expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/^Export is blocked\. The config file has a problem/) });
    expect(fake.writes).toEqual([]);
  });

  it("is blocked while the data file is unreadable or the project notes couldn't be read", async () => {
    const { fake, deps } = setup();
    expect(await exportReviewWeek({ ...deps, state: readyState({ dataError: "not JSON" }) })).toMatchObject({ ok: false, error: expect.stringContaining("data file") });
    expect(await exportReviewWeek({ ...deps, projects: null })).toMatchObject({ ok: false, error: expect.stringContaining("project notes") });
    expect(fake.writes).toEqual([]);
  });

  it("fails without writing anything when the plan note is missing", async () => {
    const { fake, deps } = setup(null);
    const outcome = await exportReviewWeek(deps);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("nothing was written") });
    expect(fake.writes).toEqual([]);
    expect(fake.files.has(DATA)).toBe(false);
  });

  it("fails without writing anything when the week's markers are malformed", async () => {
    const note = "# 2027 Plan\n\n<!-- scoreboard:2027-W18 -->\nhalf an entry\n";
    const { fake, deps } = setup(note);
    const outcome = await exportReviewWeek(deps);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringMatching(/nothing was written.*no "<!-- \/scoreboard:2027-W18 -->"/) });
    expect(fake.files.get(PLAN)).toBe(note);
    expect(fake.writes).toEqual([]);
  });

  it("reports a data write failure after the entry was written", async () => {
    const { fake, deps } = setup();
    const outcome = await exportReviewWeek({ ...deps, updateData: async () => Promise.reject(new Error("disk full")) });
    expect(outcome).toMatchObject({ ok: true, dataError: "disk full" });
    expect(fake.files.get(PLAN)).toContain("<!-- scoreboard:2027-W18 -->");
  });
});
