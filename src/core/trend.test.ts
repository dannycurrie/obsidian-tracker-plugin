import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { findMetric, type MetricConfig } from "./config";
import { emptyScoreboardData, type ScoreboardData } from "./data";
import { changeAgainstWeeksAgo, trendChange, trendChangeLabel, trendHistory, trendWeekValue } from "./trend";

const W18 = { year: 2027, week: 18 };
const at = "2027-05-04T19:00:00.000Z";
const gigs = () => findMetric(sampleConfig(), "gigs") as MetricConfig; // untargeted, weekly cadence
const hr = () => findMetric(sampleConfig(), "resting-hr") as MetricConfig; // untargeted, ad hoc, bpm

function gigWeeks(weeks: Record<string, number>): ScoreboardData {
  const data = emptyScoreboardData();
  data.manual.weekly["gigs"] = Object.fromEntries(Object.entries(weeks).map(([k, v]) => [k, { value: v, enteredAt: at }]));
  return data;
}

function snapshot(data: ScoreboardData, weekKey: string, metricId: string, value: number | null): void {
  data.snapshots[weekKey] = {
    frozen: true,
    updatedAt: at,
    metrics: { ...data.snapshots[weekKey]?.metrics, [metricId]: { value, target: null } },
  };
}

describe("trendHistory", () => {
  it("shows the last 8 completed weeks with values and no verdict", () => {
    const data = gigWeeks({ "2027-W08": 1, "2027-W11": 2, "2027-W17": 4, "2027-W18": 9 });
    const h = trendHistory(gigs(), data, W18);
    expect(h.map((w) => w.weekKey)).toEqual([
      "2027-W10", "2027-W11", "2027-W12", "2027-W13", "2027-W14", "2027-W15", "2027-W16", "2027-W17",
    ]);
    expect(h.map((w) => w.value)).toEqual([null, 2, null, null, null, null, null, 4]);
    expect(h[0]).not.toHaveProperty("hit");
  });

  it("leaves out weeks before the first week with data, and is empty with none", () => {
    expect(trendHistory(gigs(), gigWeeks({ "2027-W16": 1 }), W18).map((w) => w.weekKey)).toEqual(["2027-W16", "2027-W17"]);
    expect(trendHistory(gigs(), emptyScoreboardData(), W18)).toEqual([]);
  });

  it("prefers a week snapshot's stored value", () => {
    const data = gigWeeks({ "2027-W17": 4 });
    snapshot(data, "2027-W17", "gigs", 5);
    expect(trendWeekValue(gigs(), data, { year: 2027, week: 17 })).toBe(5);
  });

  it("reads an ad-hoc metric's past weeks from snapshots only", () => {
    const data = emptyScoreboardData();
    data.manual.latest["resting-hr"] = { value: 52, enteredAt: at };
    snapshot(data, "2027-W14", "resting-hr", 58);
    snapshot(data, "2027-W16", "resting-hr", 55);
    expect(trendHistory(hr(), data, W18).map((w) => [w.weekKey, w.value])).toEqual([
      ["2027-W14", 58],
      ["2027-W15", null],
      ["2027-W16", 55],
      ["2027-W17", null],
    ]);
  });
});

describe("change against 4 weeks ago", () => {
  it("compares the current value with the week 4 weeks back", () => {
    const data = gigWeeks({ "2027-W14": 2, "2027-W18": 5 });
    expect(changeAgainstWeeksAgo(gigs(), data, W18, 5)).toEqual({ delta: 3, direction: "up" });
    expect(changeAgainstWeeksAgo(gigs(), data, W18, 1)).toEqual({ delta: -1, direction: "down" });
    expect(changeAgainstWeeksAgo(gigs(), data, W18, 2)).toEqual({ delta: 0, direction: "flat" });
  });

  it("is null without a current value or without a value 4 weeks ago", () => {
    expect(changeAgainstWeeksAgo(gigs(), gigWeeks({ "2027-W14": 2 }), W18, null)).toBeNull();
    expect(changeAgainstWeeksAgo(gigs(), gigWeeks({ "2027-W15": 2 }), W18, 5)).toBeNull();
    expect(trendChange(null, 1)).toBeNull();
  });

  it("uses the snapshot 4 weeks ago for an ad-hoc metric", () => {
    const data = emptyScoreboardData();
    snapshot(data, "2027-W14", "resting-hr", 58);
    expect(changeAgainstWeeksAgo(hr(), data, W18, 52)).toEqual({ delta: -6, direction: "down" });
  });

  it("labels the change with an arrow and the number in the metric's unit", () => {
    expect(trendChangeLabel({ delta: 3, direction: "up" }, "")).toBe("↑ 3 vs 4 wks ago");
    expect(trendChangeLabel({ delta: -6, direction: "down" }, "bpm")).toBe("↓ 6 bpm vs 4 wks ago");
    expect(trendChangeLabel({ delta: -150, direction: "down" }, "£")).toBe("↓ £150 vs 4 wks ago");
    expect(trendChangeLabel({ delta: 0, direction: "flat" }, "")).toBe("→ 0 vs 4 wks ago");
  });
});
