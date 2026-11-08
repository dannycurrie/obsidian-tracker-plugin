import { describe, expect, it, vi } from "vitest";
import { memoryIO } from "../../tests/fixtures/memoryIO";
import { sampleConfigText } from "../../tests/fixtures/sampleConfig";
import { setManualWeeklyEntry } from "../core/data";
import { buildScoreboardModel } from "../core/model";
import { DataFileRepository } from "./DataFileRepository";
import { ScoreboardStore } from "./ScoreboardStore";

const CONFIG = "plan/scoreboard.yaml";
const DATA = "plan/scoreboard-data.json";
const now = () => new Date("2027-05-05T10:00:00.000Z");

function makeStore(files: Record<string, string>) {
  const mem = memoryIO(files);
  const store = new ScoreboardStore({
    io: mem.io,
    configPath: () => CONFIG,
    data: new DataFileRepository(mem.io, () => DATA),
    now,
  });
  return { mem, store };
}

describe("ScoreboardStore", () => {
  it("starts loading, then loads config and data on reload", async () => {
    const { store } = makeStore({
      [CONFIG]: sampleConfigText,
      [DATA]: JSON.stringify({ version: 1, manual: { latest: { eps: { value: 2, enteredAt: "x" } } } }),
    });
    expect(store.getState().status).toBe("loading");
    const listener = vi.fn();
    store.subscribe(listener);
    await store.reload();
    const s = store.getState();
    expect(s).toMatchObject({ status: "ready", configValid: true, configProblems: [], configError: null, dataError: null });
    expect(s.config?.goals).toHaveLength(3);
    expect(s.data.manual.latest.eps?.value).toBe(2);
    expect(s.loadedAt).toBe("2027-05-05T10:00:00.000Z");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reports a missing config file", async () => {
    const { store } = makeStore({});
    await store.reload();
    expect(store.getState().config).toBeNull();
    expect(store.getState().configError).toContain(CONFIG);
  });

  it("keeps the last valid config when the file becomes invalid, and lists the problems", async () => {
    const { mem, store } = makeStore({ [CONFIG]: sampleConfigText });
    await store.reload();
    mem.files.set(CONFIG, "year: [broken\n");
    await store.reload();
    const s = store.getState();
    expect(s.config?.goals).toHaveLength(3);
    expect(s.configValid).toBe(true);
    expect(s.configProblems.length).toBeGreaterThan(0);
    expect(s.configProblems[0]!.line).toBeDefined();
  });

  it("uses a best-effort config when no valid config has been seen", async () => {
    const { store } = makeStore({
      [CONFIG]: "year: 2027\ngoals:\n  - id: g\n    metrics:\n      - { id: a, kind: weekly, source: { type: manual } }\n",
    });
    await store.reload();
    expect(store.getState()).toMatchObject({ configValid: false, config: { goals: [{ id: "g", metrics: [] }] } });
  });

  it("writes a patch through the repository and updates state", async () => {
    const { mem, store } = makeStore({ [CONFIG]: sampleConfigText });
    await store.reload();
    const op = setManualWeeklyEntry("music-practice", "2027-W18", { value: 40, enteredAt: now().toISOString() });
    expect(await store.updateData([op])).toEqual({ changed: true });
    expect(store.getState().data.manual.weekly["music-practice"]?.["2027-W18"]?.value).toBe(40);
    expect(await store.updateData([op])).toEqual({ changed: false });
    expect(mem.writes).toEqual([DATA]);
  });

  it("surfaces an unreadable data file and refuses to write", async () => {
    const { mem, store } = makeStore({ [CONFIG]: sampleConfigText, [DATA]: "nope" });
    await store.reload();
    expect(store.getState().dataError).toMatch(/not valid JSON/);
    await expect(
      store.updateData([setManualWeeklyEntry("m", "2027-W18", { value: 1, enteredAt: "x" })]),
    ).rejects.toThrow();
    expect(mem.files.get(DATA)).toBe("nope");
  });
});

describe("ScoreboardStore week snapshots", () => {
  const entry = (value: number) => ({ value, enteredAt: "2027-05-04T19:00:00.000Z" });
  const musicIn = (weeks: Record<string, number>) =>
    JSON.stringify({
      version: 1,
      manual: { weekly: { "music-practice": Object.fromEntries(Object.entries(weeks).map(([k, v]) => [k, entry(v)])) } },
    });

  function makeClockedStore(files: Record<string, string>, clock: { now: Date }) {
    const mem = memoryIO(files);
    const make = () =>
      new ScoreboardStore({
        io: mem.io,
        configPath: () => CONFIG,
        data: new DataFileRepository(mem.io, () => DATA),
        now: () => clock.now,
      });
    return { mem, make };
  }

  const snapshotsOf = (mem: ReturnType<typeof memoryIO>) => JSON.parse(mem.files.get(DATA)!).snapshots;

  it("records the running week on refresh, and a refresh that changes nothing writes nothing", async () => {
    const clock = { now: new Date("2027-05-05T10:00:00.000Z") };
    const { mem, make } = makeClockedStore({ [CONFIG]: sampleConfigText, [DATA]: musicIn({ "2027-W18": 40 }) }, clock);
    const store = make();
    await store.reload();
    expect(mem.writes).toEqual([DATA]);
    expect(snapshotsOf(mem)["2027-W18"]).toMatchObject({ frozen: false, metrics: { "music-practice": { value: 40, target: 60 } } });
    expect(store.getState().data.snapshots["2027-W18"]?.frozen).toBe(false);
    clock.now = new Date("2027-05-05T10:15:00.000Z");
    await store.reload();
    await store.reload();
    expect(mem.writes).toEqual([DATA]);
  });

  it("writes nothing when there is no data", async () => {
    const clock = { now: new Date("2027-05-05T10:00:00.000Z") };
    const { mem, make } = makeClockedStore({ [CONFIG]: sampleConfigText }, clock);
    await make().reload();
    expect(mem.writes).toEqual([]);
  });

  it("freezes after the week ends; a later target change leaves frozen verdicts alone, across restarts", async () => {
    const clock = { now: new Date("2027-05-05T10:00:00.000Z") };
    const { mem, make } = makeClockedStore({ [CONFIG]: sampleConfigText, [DATA]: musicIn({ "2027-W18": 50 }) }, clock);
    await make().reload();
    clock.now = new Date("2027-05-10T08:00:00.000Z"); // Monday, W19
    await make().reload();
    expect(snapshotsOf(mem)["2027-W18"]).toMatchObject({
      frozen: true,
      metrics: { "music-practice": { value: 50, target: 60, verdict: "missed" } },
    });
    // Lower the target below 50 in config, then restart.
    mem.files.set(CONFIG, sampleConfigText.replace("target: 60", "target: 45"));
    const writesBefore = mem.writes.length;
    const restarted = make();
    await restarted.reload();
    expect(mem.writes.length).toBe(writesBefore);
    const s = restarted.getState();
    const model = buildScoreboardModel(s.config!, s.data, { year: 2027, month: 5, day: 10 });
    const row = model.goals.flatMap((g) => g.rows).find((r) => r.metric.id === "music-practice");
    expect(row).toMatchObject({
      kind: "weekly",
      streak: 0,
      history: [{ weekKey: "2027-W18", value: 50, target: 60, hit: false }],
    });
  });

  it("re-reads before the snapshot write and keeps a concurrent change from another device", async () => {
    const clock = { now: new Date("2027-05-05T10:00:00.000Z") };
    const { mem, make } = makeClockedStore({ [CONFIG]: sampleConfigText, [DATA]: musicIn({ "2027-W18": 40 }) }, clock);
    let reads = 0;
    mem.onAfterRead((path) => {
      if (path !== DATA || ++reads !== 1) return;
      // Another device syncs in a WAU entry and an unknown field right after our load.
      const doc = JSON.parse(mem.files.get(DATA)!);
      doc.manual.weekly["tengu-wau"] = { "2027-W18": entry(20) };
      doc.other = { keep: true };
      mem.files.set(DATA, JSON.stringify(doc));
    });
    const store = make();
    await store.reload();
    const doc = JSON.parse(mem.files.get(DATA)!);
    expect(doc.other).toEqual({ keep: true });
    expect(doc.manual.weekly["tengu-wau"]["2027-W18"].value).toBe(20);
    expect(doc.manual.weekly["music-practice"]["2027-W18"].value).toBe(40);
    expect(doc.snapshots["2027-W18"].metrics["music-practice"].value).toBe(40);
    expect(store.getState().data.manual.weekly["tengu-wau"]?.["2027-W18"]?.value).toBe(20);
  });

  it("skips snapshots while no valid config has been seen", async () => {
    const clock = { now: new Date("2027-05-05T10:00:00.000Z") };
    const { mem, make } = makeClockedStore({ [CONFIG]: "year: [broken\n", [DATA]: musicIn({ "2027-W18": 40 }) }, clock);
    await make().reload();
    expect(mem.writes).toEqual([]);
  });
});
