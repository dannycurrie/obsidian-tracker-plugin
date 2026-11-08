import { describe, expect, it } from "vitest";
import type { YearMetricConfig } from "./config";
import {
  isOnPace,
  manualValueWeeksOld,
  paceToleranceFor,
  updatedWeeksAgoLabel,
  yearStatus,
  yearStatusLabel,
  yearToDateScore,
} from "./yearScoring";

const metric = (paceTolerance?: number): YearMetricConfig => ({
  id: "m",
  label: "M",
  goalId: "g",
  unit: "£",
  level: false,
  source: { type: "manual", cadence: "ad-hoc" },
  kind: "year",
  target: 12000,
  plan: { type: "linear", baseline: 0 },
  ...(paceTolerance !== undefined ? { paceTolerance } : {}),
});

describe("pace tolerance", () => {
  it("uses the global value unless the metric overrides it", () => {
    expect(paceToleranceFor(metric(), { paceTolerance: 0.95 })).toBe(0.95);
    expect(paceToleranceFor(metric(0.9), { paceTolerance: 0.95 })).toBe(0.9);
  });
});

describe("on-pace rule", () => {
  it("is on pace at or above tolerance × plan value", () => {
    expect(isOnPace(95, 100, 0.95)).toBe(true);
    expect(isOnPace(94.9, 100, 0.95)).toBe(false);
    expect(isOnPace(90, 100, 0.9)).toBe(true);
    expect(isOnPace(89, 100, 0.9)).toBe(false);
  });

  it("counts no value as 0", () => {
    expect(isOnPace(null, 0, 0.95)).toBe(true);
    expect(isOnPace(null, 10, 0.95)).toBe(false);
  });
});

describe("year status and labels", () => {
  it("is ahead when the delta is ≥ 0", () => {
    const s = yearStatus(4300, 4150, 0.95);
    expect(s).toEqual({ state: "ahead", delta: 150, onPace: true });
    expect(yearStatusLabel(s, "£")).toBe("£150 ahead of pace");
    expect(yearStatusLabel(yearStatus(100, 100, 0.95), "")).toBe("0 ahead of pace");
  });

  it("is on pace (−X) when below plan but within tolerance", () => {
    const s = yearStatus(3960, 4000, 0.95);
    expect(s).toEqual({ state: "on-pace", delta: -40, onPace: true });
    expect(yearStatusLabel(s, "£")).toBe("On pace (−£40)");
  });

  it("is behind when outside tolerance", () => {
    const s = yearStatus(2900, 3460, 0.95);
    expect(s).toEqual({ state: "behind", delta: -560, onPace: false });
    expect(yearStatusLabel(s, "£")).toBe("£560 behind pace");
    expect(yearStatusLabel(yearStatus(20, 32.5, 0.95), "%")).toBe("13% behind pace");
  });

  it("shows the delta in the metric's unit, rounded for display", () => {
    expect(yearStatusLabel(yearStatus(1, 1.3699, 0.9), "")).toBe("0.4 behind pace");
    expect(yearStatusLabel(yearStatus(4300, 4120.88, 0.95), "£")).toBe("£179 ahead of pace");
    expect(yearStatusLabel(yearStatus(0, 2.5, 0.95), "min")).toBe("2.5 min behind pace");
  });
});

describe("Year to date score", () => {
  it("is year metrics on pace / number of year metrics", () => {
    const statuses = [yearStatus(100, 90, 0.95), yearStatus(96, 100, 0.95), yearStatus(10, 100, 0.95)];
    expect(yearToDateScore(statuses)).toEqual({ achieved: 2, total: 3 });
    expect(yearToDateScore([])).toEqual({ achieved: 0, total: 0 });
  });
});

describe("old manual values", () => {
  const today = { year: 2027, month: 5, day: 5 };

  it("is null for values up to 4 weeks old", () => {
    expect(manualValueWeeksOld("2027-05-05T10:00:00Z", today, "Europe/London")).toBeNull();
    expect(manualValueWeeksOld("2027-04-07T10:00:00Z", today, "Europe/London")).toBeNull(); // 28 days
  });

  it("gives whole weeks once a value is more than 4 weeks old", () => {
    expect(manualValueWeeksOld("2027-04-06T10:00:00Z", today, "Europe/London")).toBe(4); // 29 days
    expect(manualValueWeeksOld("2027-03-24T10:00:00Z", today, "Europe/London")).toBe(6); // 42 days
    expect(manualValueWeeksOld("2026-12-20T10:00:00Z", today, "Europe/London")).toBe(19); // across years
  });

  it("uses the calendar date in the config timezone", () => {
    // 23:30 UTC on 6 Apr is 00:30 on 7 Apr in London (BST): exactly 28 days.
    expect(manualValueWeeksOld("2027-04-06T23:30:00Z", today, "Europe/London")).toBeNull();
    expect(manualValueWeeksOld("2027-04-06T23:30:00Z", today, "UTC")).toBe(4);
  });

  it("ignores unreadable timestamps", () => {
    expect(manualValueWeeksOld("not a date", today, "Europe/London")).toBeNull();
  });

  it("labels the age", () => {
    expect(updatedWeeksAgoLabel(5)).toBe("updated 5 wks ago");
  });
});
