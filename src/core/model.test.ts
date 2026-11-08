import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "./data";
import { buildScoreboardModel } from "./model";

// Wednesday 5 May 2027 is in 2027-W18.
const today = { year: 2027, month: 5, day: 5 };
const at = "2027-05-05T10:00:00Z";

describe("buildScoreboardModel", () => {
  it("builds one card per goal and one row per metric, in config order", () => {
    const model = buildScoreboardModel(sampleConfig(), emptyScoreboardData(), today);
    expect(model.week).toEqual({ year: 2027, week: 18 });
    expect(model.goals.map((g) => g.goal.id)).toEqual(["career", "self", "creative"]);
    expect(model.goals[2]!.rows.map((r) => [r.metric.id, r.kind])).toEqual([
      ["music-practice", "weekly"],
      ["eps", "year"],
      ["gigs", "untargeted"],
    ]);
  });

  it("scores weekly rows on this week's entries only", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = {
      "2027-W17": { value: 90, enteredAt: at },
      "2027-W18": { value: 40, enteredAt: at },
    };
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 25, enteredAt: at } };
    const model = buildScoreboardModel(sampleConfig(), data, today);
    const rows = Object.fromEntries(model.goals.flatMap((g) => g.rows).map((r) => [r.metric.id, r]));
    expect(rows["music-practice"]).toMatchObject({ value: { value: 40 }, status: { state: "in-progress", toGo: 20 } });
    expect(rows["tengu-wau"]).toMatchObject({ status: { state: "hit" } });
    expect(rows["meditation"]).toMatchObject({ value: null, status: { state: "in-progress", toGo: 100 } });
  });

  it("counts weekly metrics hit so far / weekly metrics in the This week score", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 30, enteredAt: at } };
    // Year and untargeted metrics are excluded even with values.
    data.manual.latest["eps"] = { value: 5, enteredAt: at };
    data.manual.weekly["gigs"] = { "2027-W18": { value: 2, enteredAt: at } };
    expect(buildScoreboardModel(sampleConfig(), data, today).thisWeek).toEqual({ achieved: 1, total: 3 });
  });
});

describe("buildScoreboardModel: untargeted metrics", () => {
  const rowsOf = (data: ReturnType<typeof emptyScoreboardData>) =>
    Object.fromEntries(buildScoreboardModel(sampleConfig(), data, today).goals.flatMap((g) => g.rows).map((r) => [r.metric.id, r]));

  it("are excluded from both header scores and from badges, whatever their values", () => {
    const empty = buildScoreboardModel(sampleConfig(), emptyScoreboardData(), today);
    const data = emptyScoreboardData();
    data.manual.weekly["gigs"] = { "2027-W18": { value: 9, enteredAt: at } };
    data.manual.latest["resting-hr"] = { value: 50, enteredAt: at };
    const model = buildScoreboardModel(sampleConfig(), data, today);
    expect(model.thisWeek).toEqual(empty.thisWeek);
    expect(model.thisWeek.total).toBe(3);
    expect(model.yearToDate).toEqual(empty.yearToDate);
    expect(model.yearToDate.total).toBe(2);
    const badges = Object.fromEntries(model.goals.map((g) => [g.goal.id, g.badge]));
    expect(badges["self"]).toMatchObject({ scored: 1 });
    expect(badges["creative"]).toMatchObject({ scored: 2 });
  });

  it("build value, change against 4 weeks ago and an uncoloured strip", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["gigs"] = {
      "2027-W14": { value: 1, enteredAt: at },
      "2027-W18": { value: 3, enteredAt: at },
    };
    data.manual.latest["resting-hr"] = { value: 52, enteredAt: at };
    const rows = rowsOf(data);
    expect(rows["gigs"]).toMatchObject({ kind: "untargeted", value: { value: 3 }, change: { delta: 2, direction: "up" } });
    expect((rows["gigs"] as { history: unknown[] }).history).toHaveLength(4); // W14–W17
    expect(rows["resting-hr"]).toMatchObject({ value: { value: 52 }, change: null, history: [] });
  });
});

describe("buildScoreboardModel: year metrics", () => {
  // 5 May 2027 is day 124: linear EPs plan 5 × 124/364 ≈ 1.70; ASL quarterly 10 + 40 × 35/91 ≈ 25.38%.
  const rowsOf = (data = emptyScoreboardData()) =>
    Object.fromEntries(buildScoreboardModel(sampleConfig(), data, today).goals.flatMap((g) => g.rows).map((r) => [r.metric.id, r]));

  it("scores year rows against the plan curve today, with the per-metric tolerance", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 1.6, enteredAt: at }; // ≥ 0.9 × 1.70
    data.manual.latest["asl"] = { value: 24, enteredAt: at }; // < 0.95 × 25.38
    const rows = rowsOf(data);
    expect(rows["eps"]).toMatchObject({ paceTolerance: 0.9, status: { state: "on-pace", onPace: true } });
    expect((rows["eps"] as { planValue: number }).planValue).toBeCloseTo((5 * 124) / 364, 10);
    expect(rows["asl"]).toMatchObject({ paceTolerance: 0.95, status: { state: "behind", onPace: false } });
    expect((rows["asl"] as { planTick: number }).planTick).toBeCloseTo(0.2538, 3);
    expect(rows["asl"]).toMatchObject({ progress: 0.24, updatedWeeksAgo: null });
  });

  it("counts year metrics on pace / year metrics in the Year to date tile", () => {
    const data = emptyScoreboardData();
    expect(buildScoreboardModel(sampleConfig(), data, today).yearToDate).toEqual({ achieved: 0, total: 2 });
    data.manual.latest["eps"] = { value: 2, enteredAt: at };
    expect(buildScoreboardModel(sampleConfig(), data, today).yearToDate).toEqual({ achieved: 1, total: 2 });
    data.manual.latest["asl"] = { value: 30, enteredAt: at };
    expect(buildScoreboardModel(sampleConfig(), data, today).yearToDate).toEqual({ achieved: 2, total: 2 });
    // On 1 Jan every plan is at its baseline, so no data yet is on pace.
    const jan1 = { year: 2027, month: 1, day: 1 };
    expect(buildScoreboardModel(sampleConfig(), emptyScoreboardData(), jan1).yearToDate).toEqual({
      achieved: 2,
      total: 2,
    });
  });

  it("flags a manual year value more than 4 weeks old, still scoring it", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 5, enteredAt: "2027-03-24T10:00:00Z" };
    expect(rowsOf(data)["eps"]).toMatchObject({ updatedWeeksAgo: 6, status: { state: "ahead", onPace: true } });
  });
});
