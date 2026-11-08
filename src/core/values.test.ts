import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { findMetric } from "./config";
import { emptyScoreboardData } from "./data";
import { combineWeekReadings, metricCurrentValue, metricWeekValue } from "./values";

describe("combineWeekReadings", () => {
  const readings = [
    { value: 20, at: "2027-05-03T09:00:00Z" },
    { value: 23, at: "2027-05-06T09:00:00Z" },
    { value: 21, at: "2027-05-04T09:00:00Z" },
  ];

  it("sums readings for an accumulating metric", () => {
    expect(combineWeekReadings(readings, false)).toBe(64);
  });

  it("uses the latest reading in the week for a level metric", () => {
    expect(combineWeekReadings(readings, true)).toBe(23);
  });

  it("is null with no readings", () => {
    expect(combineWeekReadings([], true)).toBeNull();
    expect(combineWeekReadings([], false)).toBeNull();
  });
});

describe("metric values", () => {
  const config = sampleConfig();
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: "2027-05-05T10:00:00Z" } };
  data.manual.latest["eps"] = { value: 1, enteredAt: "2027-04-01T10:00:00Z" };

  it("reads a manual weekly entry for its week only, with source and time", () => {
    const music = findMetric(config, "music-practice")!;
    expect(metricWeekValue(music, data, "2027-W18")).toEqual({
      value: 40,
      source: "manual",
      at: "2027-05-05T10:00:00Z",
    });
    expect(metricWeekValue(music, data, "2027-W19")).toBeNull();
  });

  it("uses the latest value for year metrics", () => {
    expect(metricCurrentValue(findMetric(config, "eps")!, data, "2027-W18")?.value).toBe(1);
  });

  it("has no value for tracker metrics yet", () => {
    expect(metricCurrentValue(findMetric(config, "meditation")!, data, "2027-W18")).toBeNull();
  });
});
