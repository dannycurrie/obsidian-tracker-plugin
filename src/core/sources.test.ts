import { describe, expect, it } from "vitest";
import { sourceErrorLines, staleAgeLabel, withSourceStatus } from "./sources";
import type { MetricValue } from "./values";

const tracker: MetricValue = { value: 70, source: "tracker", at: "2027-05-05T06:00:00.000Z" };

describe("withSourceStatus", () => {
  it("leaves values alone with no status, and manual values always", () => {
    expect(withSourceStatus(tracker, undefined)).toBe(tracker);
    const manual: MetricValue = { value: 1, source: "manual", at: "x" };
    expect(withSourceStatus(manual, { ok: false, error: "e", failedAt: "y", lastFetchedAt: null })).toBe(manual);
    expect(withSourceStatus(null, { ok: false, error: "e", failedAt: "y", lastFetchedAt: null })).toBeNull();
  });

  it("shows the latest fetch time after a successful fetch", () => {
    expect(withSourceStatus(tracker, { ok: true, fetchedAt: "2027-05-05T10:00:00.000Z" })).toEqual({
      ...tracker,
      at: "2027-05-05T10:00:00.000Z",
    });
  });

  it("marks the last good value stale after a failure, aged from the last good fetch", () => {
    const failed = { ok: false as const, error: "boom", failedAt: "2027-05-05T10:00:00.000Z", lastFetchedAt: "2027-05-05T07:00:00.000Z" };
    const v = withSourceStatus(tracker, failed)!;
    expect(v).toEqual({ value: 70, source: "tracker", at: "2027-05-05T07:00:00.000Z", stale: { error: "boom", failedAt: failed.failedAt } });
    expect(staleAgeLabel(v)).toBe("3 h old");
  });

  it("after a restart, ages a stale value from when it was recorded", () => {
    const v = withSourceStatus(tracker, { ok: false, error: "boom", failedAt: "2027-05-08T07:00:00.000Z", lastFetchedAt: null })!;
    expect(v.at).toBe(tracker.at);
    expect(staleAgeLabel(v)).toBe("3 days old");
  });

  it("labels a fresh stale value", () => {
    const v = withSourceStatus(tracker, { ok: false, error: "boom", failedAt: "2027-05-05T06:20:00.000Z", lastFetchedAt: null })!;
    expect(staleAgeLabel(v)).toBe("under 1 h old");
    expect(staleAgeLabel(tracker)).toBeNull();
  });
});

describe("sourceErrorLines", () => {
  it("lists failing sources only", () => {
    expect(
      sourceErrorLines({
        tracker: { ok: false, error: "No key.", failedAt: "x", lastFetchedAt: null },
        other: { ok: true, fetchedAt: "x" },
      }),
    ).toEqual(["Tracker: No key."]);
  });
});
