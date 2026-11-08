import { describe, expect, it } from "vitest";
import { isWeeklyHit, thisWeekScore, weeklyStatus, weeklyStatusLabel } from "./weeklyScoring";

describe("isWeeklyHit", () => {
  it("is hit at or above the target", () => {
    expect(isWeeklyHit(100, 100)).toBe(true);
    expect(isWeeklyHit(120, 100)).toBe(true);
  });

  it("is not hit below the target or with no data", () => {
    expect(isWeeklyHit(99, 100)).toBe(false);
    expect(isWeeklyHit(null, 100)).toBe(false);
    expect(isWeeklyHit(0, 100)).toBe(false);
  });

  it("treats a zero target as hit once any value exists", () => {
    expect(isWeeklyHit(0, 0)).toBe(true);
    expect(isWeeklyHit(null, 0)).toBe(false);
  });
});

describe("weeklyStatus", () => {
  it("counts as hit during the week as soon as the target is reached", () => {
    expect(weeklyStatus(60, 60, false)).toEqual({ state: "hit" });
  });

  it("shows progress while the week is running", () => {
    expect(weeklyStatus(40, 60, false)).toEqual({ state: "in-progress", toGo: 20 });
    expect(weeklyStatus(null, 60, false)).toEqual({ state: "in-progress", toGo: 60 });
  });

  it("is only missed once the week has ended, including no data", () => {
    expect(weeklyStatus(40, 60, true)).toEqual({ state: "missed", short: 20 });
    expect(weeklyStatus(null, 60, true)).toEqual({ state: "missed", short: 60 });
    expect(weeklyStatus(70, 60, true)).toEqual({ state: "hit" });
  });
});

describe("weeklyStatusLabel", () => {
  it("reads 'N to go this week', 'Hit' or 'Missed (N short)'", () => {
    expect(weeklyStatusLabel({ state: "in-progress", toGo: 20 })).toBe("20 to go this week");
    expect(weeklyStatusLabel({ state: "hit" })).toBe("Hit");
    expect(weeklyStatusLabel({ state: "missed", short: 1500 })).toBe("Missed (1,500 short)");
  });

  it("reads 'Hit · streak N' when given a streak", () => {
    expect(weeklyStatusLabel({ state: "hit" }, 4)).toBe("Hit · streak 4");
    expect(weeklyStatusLabel({ state: "in-progress", toGo: 20 }, 4)).toBe("20 to go this week");
  });
});

describe("thisWeekScore", () => {
  it("is weekly metrics hit so far / number of weekly metrics", () => {
    expect(
      thisWeekScore([
        { state: "hit" },
        { state: "in-progress", toGo: 3 },
        { state: "hit" },
        { state: "in-progress", toGo: 10 },
        { state: "in-progress", toGo: 1 },
      ]),
    ).toEqual({ achieved: 2, total: 5 });
  });

  it("is 0/0 with no weekly metrics", () => {
    expect(thisWeekScore([])).toEqual({ achieved: 0, total: 0 });
  });
});
