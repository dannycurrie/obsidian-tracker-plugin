import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "./data";
import { goalBadge, goalBadgeFromStates, goalBadgeLabel, metricTrackState, type MetricTrackState } from "./goalBadge";
import { buildScoreboardModel } from "./model";

const badge = (...states: MetricTrackState[]) => goalBadgeFromStates(states);

describe("goalBadgeFromStates", () => {
  it("counts metrics on track over scored metrics", () => {
    expect(badge("on-track", "behind", "in-progress")).toMatchObject({ onTrack: 1, scored: 3 });
  });

  it("leaves untargeted metrics out of both numbers", () => {
    expect(badge("on-track", "unscored", "unscored")).toEqual({ onTrack: 1, scored: 1, tone: "on-track" });
    expect(badge("behind", "unscored")).toEqual({ onTrack: 0, scored: 1, tone: "behind" });
  });

  it("is blue when every scored metric is on track", () => {
    expect(badge("on-track", "on-track").tone).toBe("on-track");
  });

  it("is orange when none is on track and at least one is behind or missed", () => {
    expect(badge("behind", "behind").tone).toBe("behind");
    expect(badge("behind", "in-progress").tone).toBe("behind");
  });

  it("is grey when some but not all are on track", () => {
    expect(badge("on-track", "behind").tone).toBe("neutral");
    expect(badge("on-track", "in-progress").tone).toBe("neutral");
  });

  it("Monday morning: weekly metrics still in progress count as not on track but never turn it orange", () => {
    expect(badge("in-progress", "in-progress")).toEqual({ onTrack: 0, scored: 2, tone: "neutral" });
  });

  it("is grey with nothing scored", () => {
    expect(badge()).toEqual({ onTrack: 0, scored: 0, tone: "neutral" });
    expect(badge("unscored")).toEqual({ onTrack: 0, scored: 0, tone: "neutral" });
  });
});

describe("goalBadgeLabel", () => {
  it('reads "x / y on track", or "no targets set" with nothing scored', () => {
    expect(goalBadgeLabel({ onTrack: 2, scored: 3, tone: "neutral" })).toBe("2 / 3 on track");
    expect(goalBadgeLabel({ onTrack: 0, scored: 0, tone: "neutral" })).toBe("no targets set");
  });
});

describe("metricTrackState and goalBadge on real rows", () => {
  // Wednesday 5 May 2027 (2027-W18); Monday 3 May is its first day.
  const at = "2027-05-03T07:00:00Z";
  const cards = (data = emptyScoreboardData(), today = { year: 2027, month: 5, day: 5 }) =>
    Object.fromEntries(buildScoreboardModel(sampleConfig(), data, today).goals.map((g) => [g.goal.id, g]));

  it("maps weekly hit / in progress, year on pace / behind and untargeted", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 60, enteredAt: at } };
    data.manual.latest["eps"] = { value: 0, enteredAt: at };
    data.manual.weekly["gigs"] = { "2027-W18": { value: 3, enteredAt: at } };
    const rows = cards(data)["creative"]!.rows;
    expect(rows.map(metricTrackState)).toEqual(["on-track", "behind", "unscored"]);
    expect(goalBadge(rows)).toEqual({ onTrack: 1, scored: 2, tone: "neutral" });
  });

  it("Monday morning with only weekly metrics in progress: grey 0 / n, not orange", () => {
    const monday = { year: 2027, month: 5, day: 3 };
    // Self: meditation (weekly, no data yet) + an untargeted metric.
    expect(cards(emptyScoreboardData(), monday)["self"]!.badge).toEqual({ onTrack: 0, scored: 1, tone: "neutral" });
  });

  it("turns orange when a year metric is behind and the weekly one is only in progress", () => {
    const data = emptyScoreboardData();
    data.manual.latest["asl"] = { value: 0, enteredAt: at };
    expect(cards(data)["career"]!.badge).toEqual({ onTrack: 0, scored: 2, tone: "behind" });
  });

  it("is blue when all scored metrics are on track, ignoring an untargeted one with no data", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 60, enteredAt: at } };
    data.manual.latest["eps"] = { value: 2, enteredAt: at };
    expect(cards(data)["creative"]!.badge).toEqual({ onTrack: 2, scored: 2, tone: "on-track" });
  });
});
