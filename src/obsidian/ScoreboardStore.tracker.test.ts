/** ScoreboardStore with the tracker adapter (ticket 07), using a fake HTTP function. */
import { describe, expect, it, vi } from "vitest";
import { memoryIO } from "../../tests/fixtures/memoryIO";
import { sampleConfigText } from "../../tests/fixtures/sampleConfig";
import { errorBodies, MEDITATION_ID, okBody, READING_ID, week } from "../../tests/fixtures/trackerResponses";
import { createTrackerAdapter, type HttpGet } from "../adapters/trackerAdapter";
import { configValidationState } from "../core/configStatus";
import { buildScoreboardModel, type WeeklyRowModel } from "../core/model";
import { modelWithSourceStatus } from "../core/sources";
import { DataFileRepository } from "./DataFileRepository";
import { ScoreboardStore } from "./ScoreboardStore";

const CONFIG = "plan/scoreboard.yaml";
const DATA = "plan/scoreboard-data.json";
const today = { year: 2027, month: 5, day: 5 };

function setup(files: Record<string, string> = { [CONFIG]: sampleConfigText }) {
  const mem = memoryIO(files);
  let clock = new Date("2027-05-05T10:00:00.000Z");
  let reply: { status: number; text: string } | Error = { status: 200, text: "" };
  const http = vi.fn<HttpGet>(async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  });
  const store = new ScoreboardStore({
    io: mem.io,
    configPath: () => CONFIG,
    data: new DataFileRepository(mem.io, () => DATA),
    now: () => clock,
    adapters: [createTrackerAdapter({ http, apiUrl: () => "https://t.example", apiKey: () => "key" })],
  });
  return {
    mem,
    store,
    http,
    setReply: (r: typeof reply) => void (reply = r),
    setClock: (iso: string) => void (clock = new Date(iso)),
    meditationRow: () => {
      const s = store.getState();
      const model = modelWithSourceStatus(buildScoreboardModel(s.config!, s.data, today), s.sources);
      return model.goals.flatMap((g) => g.rows).find((r) => r.metric.id === "meditation") as WeeklyRowModel;
    },
  };
}

const meditationBody = (values: number[], lastWeek: number[] = [60, 40, 0, 0, 0, 0, 0]) =>
  okBody([
    { id: READING_ID, name: "Reading", periods: [] },
    { id: MEDITATION_ID, name: "Meditation", periods: [...week("2027-04-26", lastWeek), ...week("2027-05-03", values)] },
  ]);

describe("ScoreboardStore with the tracker source", () => {
  it("fills the tracker metric's current week and history from one request, and saves them", async () => {
    const t = setup();
    t.setReply({ status: 200, text: meditationBody([30, 40]) });
    await t.store.reload();
    expect(t.http).toHaveBeenCalledTimes(1);
    const row = t.meditationRow();
    expect(row.value).toEqual({ value: 70, source: "tracker", at: "2027-05-05T10:00:00.000Z" });
    expect(row.status).toMatchObject({ state: "in-progress", toGo: 30 });
    expect(row.history.map((w) => [w.weekKey, w.value, w.hit])).toEqual([["2027-W17", 100, true]]);
    expect(row.streak).toBe(1);
    const saved = JSON.parse(t.mem.files.get(DATA)!);
    expect(saved.snapshots["2027-W18"].metrics.meditation).toMatchObject({ value: 70, source: "tracker" });
    expect(saved.snapshots["2027-W17"]).toMatchObject({ frozen: true, metrics: { meditation: { value: 100, target: 100 } } });
    expect(JSON.stringify(saved)).not.toContain("key");
  });

  it("writes nothing when a refresh brings no change", async () => {
    const t = setup();
    t.setReply({ status: 200, text: meditationBody([30, 40]) });
    await t.store.reload();
    const writes = t.mem.writes.length;
    t.setClock("2027-05-05T10:15:00.000Z");
    await t.store.reload();
    expect(t.mem.writes.length).toBe(writes);
    // The hover shows the latest successful fetch, even though nothing was written.
    expect(t.meditationRow().value?.at).toBe("2027-05-05T10:15:00.000Z");
  });

  it("on failure shows the last good value as stale with its age, never zero", async () => {
    const t = setup();
    t.setReply({ status: 200, text: meditationBody([30, 40]) });
    await t.store.reload();
    t.setClock("2027-05-05T13:00:00.000Z");
    t.setReply({ status: 500, text: errorBodies.internal });
    const writes = t.mem.writes.length;
    await t.store.reload();
    expect(t.mem.writes.length).toBe(writes);
    const row = t.meditationRow();
    expect(row.value).toEqual({
      value: 70,
      source: "tracker",
      at: "2027-05-05T10:00:00.000Z",
      stale: { error: "Tracker API error (HTTP 500): internal_error: Something went wrong", failedAt: "2027-05-05T13:00:00.000Z" },
    });
    expect(t.store.getState().sources.tracker).toMatchObject({ ok: false, lastFetchedAt: "2027-05-05T10:00:00.000Z" });
  });

  it("after a restart with the API down, shows the value saved in the data file as stale", async () => {
    const first = setup();
    first.setReply({ status: 200, text: meditationBody([30, 40]) });
    await first.store.reload();
    const second = setup(Object.fromEntries(first.mem.files));
    second.setReply(new Error("offline"));
    second.setClock("2027-05-05T12:00:00.000Z");
    await second.store.reload();
    const row = second.meditationRow();
    expect(row.value).toMatchObject({ value: 70, at: "2027-05-05T10:00:00.000Z", stale: { error: "Couldn't reach the tracker API: offline" } });
  });

  it("lists an unknown tracker id in the config problems with the available ids, and clears it once fixed", async () => {
    const wrong = sampleConfigText.replace(MEDITATION_ID, "not-a-real-id");
    const t = setup({ [CONFIG]: wrong });
    t.setReply({ status: 200, text: meditationBody([30]) });
    await t.store.reload();
    let s = t.store.getState();
    expect(s.configProblems).toHaveLength(1);
    expect(s.configProblems[0]!.line).toBe(35);
    expect(s.configProblems[0]!.message).toContain('tracker metric id "not-a-real-id"');
    expect(s.configProblems[0]!.message).toContain(`\n- Meditation: ${MEDITATION_ID}`);
    expect(s.configProblems[0]!.message).toContain(`\n- Reading: ${READING_ID}`);
    expect(configValidationState(s).blocksActions).toBe(true);

    // A failed fetch can't tell: the problem stays.
    t.setReply(new Error("offline"));
    await t.store.reload();
    expect(t.store.getState().configProblems).toHaveLength(1);

    t.mem.files.set(CONFIG, sampleConfigText);
    t.setReply({ status: 200, text: meditationBody([30]) });
    await t.store.reload();
    s = t.store.getState();
    expect(s.configProblems).toEqual([]);
    expect(configValidationState(s).blocksActions).toBe(false);
  });

  it("shares one request between overlapping refreshes", async () => {
    const t = setup();
    t.setReply({ status: 200, text: meditationBody([30]) });
    await Promise.all([t.store.reload(), t.store.reload()]);
    expect(t.http).toHaveBeenCalledTimes(1);
  });
});
