import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { findMetric, type WeeklyMetricConfig } from "./config";
import { emptyScoreboardData, type ScoreboardData } from "./data";
import { firstDataWeek, weeklyHistory, weeklyStreak } from "./history";

const W18 = { year: 2027, week: 18 };
const at = "2027-05-04T19:00:00.000Z";
const music = () => findMetric(sampleConfig(), "music-practice") as WeeklyMetricConfig; // target 60

function entries(weeks: Record<string, number>): ScoreboardData {
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = Object.fromEntries(
    Object.entries(weeks).map(([k, v]) => [k, { value: v, enteredAt: at }]),
  );
  return data;
}

function frozen(data: ScoreboardData, weekKey: string, value: number | null, target: number): void {
  data.snapshots[weekKey] = {
    frozen: true,
    updatedAt: at,
    metrics: { ...data.snapshots[weekKey]?.metrics, "music-practice": { value, target } },
  };
}

describe("weeklyHistory", () => {
  it("shows the last 8 completed weeks, oldest first, hit or missed", () => {
    const data = entries({ "2027-W05": 60, "2027-W10": 60, "2027-W12": 59, "2027-W17": 90, "2027-W18": 100 });
    const h = weeklyHistory(music(), data, W18);
    expect(h.map((w) => w.weekKey)).toEqual([
      "2027-W10", "2027-W11", "2027-W12", "2027-W13", "2027-W14", "2027-W15", "2027-W16", "2027-W17",
    ]);
    expect(h.map((w) => w.hit)).toEqual([true, false, false, false, false, false, false, true]);
  });

  it("counts a completed week with no value as missed", () => {
    const h = weeklyHistory(music(), entries({ "2027-W15": 60 }), W18);
    expect(h.find((w) => w.weekKey === "2027-W16")).toMatchObject({ value: null, hit: false });
  });

  it("leaves out weeks before the first week with data", () => {
    const h = weeklyHistory(music(), entries({ "2027-W15": 60 }), W18);
    expect(h.map((w) => w.weekKey)).toEqual(["2027-W15", "2027-W16", "2027-W17"]);
  });

  it("is empty with no data, or with data only this week", () => {
    expect(weeklyHistory(music(), emptyScoreboardData(), W18)).toEqual([]);
    expect(weeklyHistory(music(), entries({ "2027-W18": 60 }), W18)).toEqual([]);
  });

  it("scores frozen weeks against their stored target, not the config's", () => {
    const data = entries({});
    frozen(data, "2027-W16", 50, 40); // config target is 60, but 40 applied that week
    frozen(data, "2027-W17", 70, 80);
    const h = weeklyHistory(music(), data, W18);
    expect(h).toMatchObject([
      { weekKey: "2027-W16", value: 50, target: 40, hit: true },
      { weekKey: "2027-W17", value: 70, target: 80, hit: false },
    ]);
  });

  it("uses snapshot values (e.g. tracker metrics with no manual entries)", () => {
    const data = emptyScoreboardData();
    data.snapshots["2027-W17"] = { frozen: true, updatedAt: at, metrics: { meditation: { value: 120, target: 100 } } };
    const meditation = findMetric(sampleConfig(), "meditation") as WeeklyMetricConfig;
    expect(weeklyHistory(meditation, data, W18)).toMatchObject([{ weekKey: "2027-W17", value: 120, hit: true }]);
  });

  it("crosses the year boundary (2026-W53)", () => {
    const h = weeklyHistory(music(), entries({ "2026-W53": 60 }), { year: 2027, week: 2 });
    expect(h.map((w) => w.weekKey)).toEqual(["2026-W53", "2027-W01"]);
  });
});

describe("firstDataWeek", () => {
  it("is the earliest week with a manual entry or a snapshot value", () => {
    const data = entries({ "2027-W12": 1 });
    data.snapshots["2027-W09"] = { frozen: true, updatedAt: at, metrics: { "music-practice": { value: null, target: 60 } } };
    expect(firstDataWeek("music-practice", data)).toEqual({ year: 2027, week: 12 });
    frozen(data, "2027-W10", 5, 60);
    expect(firstDataWeek("music-practice", data)).toEqual({ year: 2027, week: 10 });
    expect(firstDataWeek("other", data)).toBeNull();
  });
});

describe("weeklyStreak", () => {
  it("counts consecutive completed weeks hit back from last week", () => {
    const data = entries({ "2027-W13": 60, "2027-W14": 10, "2027-W15": 60, "2027-W16": 61, "2027-W17": 90 });
    expect(weeklyStreak(music(), data, W18, false)).toBe(3);
  });

  it("adds the current week if already hit", () => {
    const data = entries({ "2027-W16": 60, "2027-W17": 90, "2027-W18": 60 });
    expect(weeklyStreak(music(), data, W18, true)).toBe(3);
  });

  it("is broken by a week with no data", () => {
    const data = entries({ "2027-W15": 60, "2027-W17": 90 });
    expect(weeklyStreak(music(), data, W18, true)).toBe(2);
  });

  it("is zero when last week was missed and this week isn't hit yet", () => {
    expect(weeklyStreak(music(), entries({ "2027-W16": 60, "2027-W17": 10 }), W18, false)).toBe(0);
  });

  it("never counts back past the first week with data", () => {
    expect(weeklyStreak(music(), entries({ "2027-W16": 60, "2027-W17": 60 }), W18, true)).toBe(3);
    expect(weeklyStreak(music(), emptyScoreboardData(), W18, false)).toBe(0);
  });

  it("counts beyond the 8 weeks shown in the strip", () => {
    const weeks: Record<string, number> = {};
    for (let w = 2; w <= 17; w++) weeks[`2027-W${String(w).padStart(2, "0")}`] = 60;
    expect(weeklyStreak(music(), entries(weeks), W18, false)).toBe(16);
  });

  it("uses frozen targets: a target raised later doesn't break the streak", () => {
    const data = entries({});
    frozen(data, "2027-W16", 50, 50);
    frozen(data, "2027-W17", 50, 50);
    expect(weeklyStreak(music(), data, W18, false)).toBe(2);
  });
});
