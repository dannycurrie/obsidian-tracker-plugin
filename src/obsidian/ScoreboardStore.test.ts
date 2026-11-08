import { describe, expect, it, vi } from "vitest";
import { memoryIO } from "../../tests/fixtures/memoryIO";
import { sampleConfigText } from "../../tests/fixtures/sampleConfig";
import { setManualWeeklyEntry } from "../core/data";
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
