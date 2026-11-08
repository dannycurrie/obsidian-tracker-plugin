import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import type { ScoreboardConfig } from "./config";
import { applyDataPatch, emptyScoreboardData, readScoreboardData, type RawDataDocument, type ScoreboardData } from "./data";
import { snapshotRefreshPatch, snapshotValuePatch } from "./snapshots";
import { findMetric } from "./config";

// Wednesday 5 May 2027 is in 2027-W18; Monday 10 May starts W19.
const wed = { year: 2027, month: 5, day: 5 };
const nextMon = { year: 2027, month: 5, day: 10 };
const t1 = "2027-05-05T10:00:00.000Z";
const t2 = "2027-05-10T08:00:00.000Z";
const at = "2027-05-04T19:00:00.000Z";

/** Runs a refresh's snapshot step against a document and returns the new document + data. */
function refresh(doc: RawDataDocument, today = wed, now = t1, config: ScoreboardConfig = sampleConfig()) {
  const data = readScoreboardData(doc);
  const patch = snapshotRefreshPatch(config, data, today, now);
  const result = applyDataPatch(doc, patch);
  return { ...result, patch, data: readScoreboardData(result.doc) };
}

function withMusic(weeks: Record<string, number>): RawDataDocument {
  const entries = Object.fromEntries(Object.entries(weeks).map(([k, v]) => [k, { value: v, enteredAt: at }]));
  return { version: 1, manual: { weekly: { "music-practice": entries } } };
}

function withTarget(config: ScoreboardConfig, metricId: string, target: number): ScoreboardConfig {
  const c = structuredClone(config);
  const m = findMetric(c, metricId)!;
  if (m.kind !== "untargeted") m.target = target;
  return c;
}

describe("snapshotRefreshPatch", () => {
  it("writes no snapshot when there is no data at all", () => {
    expect(refresh({ version: 1 }).patch).toEqual([]);
  });

  it("records the running week with config targets, verdicts and provenance", () => {
    const doc = withMusic({ "2027-W18": 40 });
    (doc.manual as Record<string, unknown>).latest = { eps: { value: 2, enteredAt: at } };
    const { data } = refresh(doc);
    const snap = data.snapshots["2027-W18"]!;
    expect(snap.frozen).toBe(false);
    expect(snap.updatedAt).toBe(t1);
    expect(snap.metrics["music-practice"]).toEqual({
      value: 40,
      target: 60,
      verdict: "in-progress",
      source: "manual",
      fetchedAt: at,
    });
    expect(snap.metrics["meditation"]).toEqual({ value: null, target: 100, verdict: "in-progress" });
    expect(snap.metrics["eps"]).toMatchObject({ value: 2, target: 5 });
    expect(snap.metrics["gigs"]).toEqual({ value: null, target: null });
  });

  it("changes nothing on a second refresh with the same values (no write)", () => {
    const first = refresh(withMusic({ "2027-W18": 40 }));
    const second = refresh(first.doc, wed, "2027-05-05T11:00:00.000Z");
    expect(second.changed).toBe(false);
    expect(second.patch).toEqual([]);
  });

  it("updates the running week when a value changes, touching only that line", () => {
    const first = refresh(withMusic({ "2027-W18": 40 }));
    const doc = applyDataPatch(first.doc, [
      { path: ["manual", "weekly", "music-practice", "2027-W18"], value: { value: 70, enteredAt: t1 } },
    ]).doc;
    const second = refresh(doc, wed, "2027-05-05T12:00:00.000Z");
    expect(second.patch.map((op) => op.path.join("."))).toEqual([
      "snapshots.2027-W18.metrics.music-practice",
      "snapshots.2027-W18.updatedAt",
    ]);
    expect(second.data.snapshots["2027-W18"]!.metrics["music-practice"]).toMatchObject({ value: 70, verdict: "hit" });
  });

  it("follows target changes while the week runs", () => {
    const first = refresh(withMusic({ "2027-W18": 40 }));
    const second = refresh(first.doc, wed, t1, withTarget(sampleConfig(), "music-practice", 30));
    expect(second.data.snapshots["2027-W18"]!.metrics["music-practice"]).toMatchObject({ target: 30, verdict: "hit" });
  });

  it("freezes at the first refresh after the week ends, keeping the target that applied", () => {
    const running = refresh(withMusic({ "2027-W18": 40 }));
    // Target changed to 30 over the weekend; the first refresh is on Monday of W19.
    const frozen = refresh(running.doc, nextMon, t2, withTarget(sampleConfig(), "music-practice", 30));
    const snap = frozen.data.snapshots["2027-W18"]!;
    expect(snap.frozen).toBe(true);
    expect(snap.updatedAt).toBe(t2);
    expect(snap.metrics["music-practice"]).toMatchObject({ value: 40, target: 60, verdict: "missed" });
    expect(snap.metrics["meditation"]).toMatchObject({ value: null, target: 100, verdict: "missed" });
    // Year lines keep the value from when the week ran.
    expect(snap.metrics["eps"]).toEqual(running.data.snapshots["2027-W18"]!.metrics["eps"]);
    // Refreshing again changes nothing.
    expect(refresh(frozen.doc, nextMon, "2027-05-10T09:00:00.000Z").changed).toBe(false);
  });

  it("never changes a frozen week's target, even when the config changes", () => {
    const frozen = refresh(refresh(withMusic({ "2027-W18": 40 })).doc, nextMon, t2);
    const later = refresh(frozen.doc, nextMon, t2, withTarget(sampleConfig(), "music-practice", 10));
    expect(later.changed).toBe(false);
    expect(later.data.snapshots["2027-W18"]!.metrics["music-practice"]).toMatchObject({ target: 60, verdict: "missed" });
  });

  it("updates a frozen week's value from its source but keeps its target", () => {
    const frozen = refresh(refresh(withMusic({ "2027-W18": 40 })).doc, nextMon, t2);
    const doc = applyDataPatch(frozen.doc, [
      { path: ["manual", "weekly", "music-practice", "2027-W18"], value: { value: 65, enteredAt: t2 } },
    ]).doc;
    const later = refresh(doc, nextMon, "2027-05-10T09:00:00.000Z", withTarget(sampleConfig(), "music-practice", 100));
    const snap = later.data.snapshots["2027-W18"]!;
    expect(snap.frozen).toBe(true);
    expect(snap.metrics["music-practice"]).toMatchObject({ value: 65, target: 60, verdict: "hit" });
  });

  it("creates a frozen snapshot for an ended week that has entries but no snapshot", () => {
    const { data } = refresh(withMusic({ "2027-W15": 70 }));
    const snap = data.snapshots["2027-W15"]!;
    expect(snap.frozen).toBe(true);
    expect(snap.metrics["music-practice"]).toMatchObject({ value: 70, target: 60, verdict: "hit" });
    expect(snap.metrics["tengu-wau"]).toMatchObject({ value: null, target: 25, verdict: "missed" });
    // Only per-week metrics: there's no way to know a year metric's value back then.
    expect(snap.metrics["eps"]).toBeUndefined();
    // Gap weeks with no data get no snapshot.
    expect(data.snapshots["2027-W16"]).toBeUndefined();
  });

  it("ignores weeks after the current one and malformed keys", () => {
    const { data } = refresh(withMusic({ "2027-W20": 70, "nonsense": 1 }));
    expect(Object.keys(data.snapshots)).toEqual([]);
  });

  it("never wipes a recorded value when the source has none", () => {
    const doc: RawDataDocument = {
      version: 1,
      snapshots: {
        "2027-W17": { frozen: true, updatedAt: at, metrics: { meditation: { value: 120, target: 100, verdict: "hit", source: "tracker", fetchedAt: at } } },
        "2027-W18": { frozen: false, updatedAt: at, metrics: { meditation: { value: 50, target: 100, verdict: "in-progress", source: "tracker", fetchedAt: at } } },
      },
    };
    const r = refresh(doc);
    expect(r.data.snapshots["2027-W17"]!.metrics["meditation"]!.value).toBe(120);
    expect(r.data.snapshots["2027-W18"]!.metrics["meditation"]).toMatchObject({ value: 50, source: "tracker", fetchedAt: at });
  });
});

describe("snapshotValuePatch (tracker values in frozen weeks, ticket 07)", () => {
  const meditation = () => findMetric(sampleConfig(), "meditation")!;
  const frozenData = (): ScoreboardData => {
    const data = emptyScoreboardData();
    data.snapshots["2027-W17"] = {
      frozen: true,
      updatedAt: at,
      metrics: { meditation: { value: 80, target: 120, verdict: "missed", source: "tracker", fetchedAt: at } },
    };
    return data;
  };

  it("rewrites the value and verdict against the stored target, without unfreezing", () => {
    const ops = snapshotValuePatch(frozenData(), meditation(), "2027-W17", { value: 125, source: "tracker", at: t2 }, true, t2);
    expect(ops.map((o) => o.path.join("."))).toEqual(["snapshots.2027-W17.metrics.meditation", "snapshots.2027-W17.updatedAt"]);
    expect(ops[0]!.value).toEqual({ value: 125, target: 120, verdict: "hit", source: "tracker", fetchedAt: t2 });
  });

  it("is empty when only the fetch time changed", () => {
    expect(snapshotValuePatch(frozenData(), meditation(), "2027-W17", { value: 80, source: "tracker", at: t2 }, true, t2)).toEqual([]);
  });

  it("creates a missing ended week frozen, with the config target", () => {
    const ops = snapshotValuePatch(emptyScoreboardData(), meditation(), "2027-W16", { value: 10, source: "tracker", at: t2 }, true, t2);
    const doc = applyDataPatch({ version: 1 }, ops).doc;
    expect(readScoreboardData(doc).snapshots["2027-W16"]).toMatchObject({
      frozen: true,
      metrics: { meditation: { value: 10, target: 100, verdict: "missed" } },
    });
  });
});
