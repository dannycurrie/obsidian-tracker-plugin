import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData, type ScoreboardData } from "./data";
import { buildReviewReport, exportButtonCopy, exportRecordOf, reviewWeekFor, type ReviewReport } from "./report";

const at = "2027-05-05T10:00:00Z";
// 2027-W18 runs Mon 3 May – Sun 9 May 2027.
const sunday = { year: 2027, month: 5, day: 9 };
const monday = { year: 2027, month: 5, day: 10 };

function report(data: ScoreboardData, today = sunday, extra: Partial<Parameters<typeof buildReviewReport>[0]> = {}): ReviewReport {
  return buildReviewReport({ config: sampleConfig(), data, today, projects: [], ...extra });
}

const byId = (r: ReviewReport) => Object.fromEntries(r.metrics.map((m) => [m.metric.id, m]));

describe("reviewWeekFor", () => {
  it("is the current ISO week from Tuesday to Sunday", () => {
    for (const day of [4, 5, 9]) {
      expect(reviewWeekFor({ year: 2027, month: 5, day })).toMatchObject({ key: "2027-W18", ended: false });
    }
  });

  it("is the just-finished week on a Monday", () => {
    expect(reviewWeekFor(monday)).toEqual({
      week: { year: 2027, week: 18 },
      key: "2027-W18",
      start: { year: 2027, month: 5, day: 3 },
      end: { year: 2027, month: 5, day: 9 },
      ended: true,
    });
  });

  it("crosses the year boundary on Monday 4 Jan 2027 (2026-W53)", () => {
    expect(reviewWeekFor({ year: 2027, month: 1, day: 4 })).toMatchObject({ key: "2026-W53", ended: true });
  });
});

describe("buildReviewReport: weekly metrics", () => {
  it("reads 'N to go' while the week runs and 'Hit' once reached", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 25, enteredAt: at } };
    const m = byId(report(data));
    expect(m["music-practice"]).toMatchObject({ statusLabel: "20 to go", state: "in-progress", valueText: "40 min", targetText: "60 min" });
    expect(m["tengu-wau"]).toMatchObject({ statusLabel: "Hit", state: "on-track", valueText: "25", targetText: "25" });
    expect(m["meditation"]).toMatchObject({ statusLabel: "100 to go", valueText: "–" });
  });

  it("on a Monday reports last week: 'Missed (N short)' once it has ended, and 'Hit' kept", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = {
      "2027-W18": { value: 40, enteredAt: at },
      "2027-W19": { value: 90, enteredAt: at },
    };
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 30, enteredAt: at } };
    const r = report(data, monday);
    expect(r.reviewWeek.key).toBe("2027-W18");
    const m = byId(r);
    expect(m["music-practice"]).toMatchObject({ statusLabel: "Missed (20 short)", state: "behind", valueText: "40 min" });
    expect(m["tengu-wau"]).toMatchObject({ statusLabel: "Hit", state: "on-track" });
    expect(m["meditation"]).toMatchObject({ statusLabel: "Missed (100 short)", state: "behind" });
    expect(r.thisWeek).toEqual({ achieved: 1, total: 3 });
  });

  it("scores an ended week against its frozen snapshot target", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 50, enteredAt: at } };
    data.snapshots["2027-W18"] = {
      frozen: true,
      updatedAt: at,
      metrics: { "music-practice": { value: 50, target: 45, verdict: "hit" } },
    };
    const m = byId(report(data, monday));
    expect(m["music-practice"]).toMatchObject({ target: 45, targetText: "45 min", statusLabel: "Hit" });
  });

  it("counts the streak back from the review week", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["tengu-wau"] = {
      "2027-W16": { value: 25, enteredAt: at },
      "2027-W17": { value: 25, enteredAt: at },
      "2027-W18": { value: 25, enteredAt: at },
    };
    expect(byId(report(data, monday))["tengu-wau"]!.weekly!.streak).toBe(3);
    expect(byId(report(data, sunday))["tengu-wau"]!.weekly!.streak).toBe(3);
  });
});

describe("buildReviewReport: year and untargeted metrics", () => {
  it("uses the pace labels against the plan today while the week runs", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 5, enteredAt: at };
    const r = report(data);
    expect(r.planDate).toEqual(sunday);
    expect(byId(r)["eps"]).toMatchObject({ state: "on-track", valueText: "5", targetText: "5" });
    expect(byId(r)["eps"]!.statusLabel).toMatch(/ahead of pace$/);
    expect(byId(r)["asl"]).toMatchObject({ state: "behind", valueText: "–", targetText: "100%" });
    expect(byId(r)["asl"]!.statusLabel).toMatch(/behind pace$/);
  });

  it("on a Monday scores year metrics on the review week's Sunday", () => {
    const r = report(emptyScoreboardData(), monday);
    expect(r.planDate).toEqual(sunday);
    const sundayPlan = report(emptyScoreboardData(), sunday).metrics.find((m) => m.metric.id === "eps")!.year!.planValue;
    expect(byId(r)["eps"]!.year!.planValue).toBe(sundayPlan);
  });

  it("lists untargeted metrics with 'No target' and no target", () => {
    const data = emptyScoreboardData();
    data.manual.latest["resting-hr"] = { value: 52, enteredAt: at };
    const m = byId(report(data));
    expect(m["resting-hr"]).toMatchObject({ state: "unscored", statusLabel: "No target", target: null, targetText: "–", valueText: "52 bpm" });
    expect(m["gigs"]).toMatchObject({ statusLabel: "No target", valueText: "–" });
  });

  it("counts year metrics on pace in yearToDate and excludes untargeted from both scores", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 5, enteredAt: at };
    const r = report(data);
    expect(r.yearToDate).toEqual({ achieved: 1, total: 2 });
    expect(r.thisWeek.total).toBe(3);
  });
});

describe("buildReviewReport: stale flags, projects, order", () => {
  it("flags metrics whose source failed as stale", () => {
    const data = emptyScoreboardData();
    data.snapshots["2027-W18"] = { frozen: false, updatedAt: at, metrics: { meditation: { value: 70, target: 100, source: "tracker", fetchedAt: at } } };
    const r = report(data, sunday, {
      sources: { tracker: { ok: false, error: "HTTP 500", failedAt: "2027-05-09T17:00:00Z", lastFetchedAt: null } },
    });
    expect(byId(r)["meditation"]).toMatchObject({ stale: true, valueText: "70 min", statusLabel: "30 to go" });
    expect(r.stale.map((m) => m.metric.id)).toEqual(["meditation"]);
  });

  it("keeps config order and passes active projects through", () => {
    const projects = [
      { path: "🚀 Projects/A.md", title: "A", goal: { goalId: "career", label: "Career", unknown: false }, nextAction: "Ship it" },
      { path: "🚀 Projects/B.md", title: "B", goal: { goalId: "self", label: "Self", unknown: false }, nextAction: null },
    ];
    const r = report(emptyScoreboardData(), sunday, { projects });
    expect(r.metrics.map((m) => m.metric.id)).toEqual(["tengu-wau", "asl", "meditation", "resting-hr", "music-practice", "eps", "gigs"]);
    expect(r.metrics[0]!.goal.name).toBe("Career");
    expect(r.projects).toEqual([
      { path: "🚀 Projects/A.md", title: "A", nextAction: "Ship it" },
      { path: "🚀 Projects/B.md", title: "B", nextAction: null },
    ]);
  });
});

describe("exportRecordOf", () => {
  it("records the week, scores and every metric's state and label", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
    const rec = exportRecordOf(report(data, monday), "2027-05-10T08:00:00.000Z");
    expect(rec).toMatchObject({ exportedAt: "2027-05-10T08:00:00.000Z", week: "2027-W18", weekEnded: true, thisWeek: { achieved: 0, total: 3 } });
    expect(rec.metrics["music-practice"]).toEqual({ state: "behind", label: "Missed (20 short)" });
    expect(rec.metrics["gigs"]).toEqual({ state: "unscored", label: "No target" });
    expect(Object.keys(rec.metrics)).toHaveLength(7);
  });
});

describe("exportButtonCopy", () => {
  it("says which week a Monday export covers", () => {
    expect(exportButtonCopy(reviewWeekFor(monday)).label).toBe("Export week 18");
    expect(exportButtonCopy(reviewWeekFor(monday)).title).toContain("just-finished week 18");
    expect(exportButtonCopy(reviewWeekFor(sunday)).label).toBe("Export to Obsidian");
  });
});
