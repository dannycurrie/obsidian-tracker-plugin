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
