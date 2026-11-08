import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import {
  clocksBackWeek,
  clocksForwardWeek,
  errorBodies,
  MEDITATION_ID,
  mondayAfterClocksBack,
  okBody,
  READING_ID,
  week,
} from "../../tests/fixtures/trackerResponses";
import { applyDataPatch, emptyScoreboardData, readScoreboardData, type RawDataDocument } from "./data";
import {
  aggregateWeek,
  localMidnightIso,
  parseTrackerResponse,
  TrackerError,
  trackerApply,
  trackerRequestUrl,
  trackerWindow,
  weekTotals,
  type TrackerMetric,
} from "./tracker";
import { metricWeekValue } from "./values";
import { findMetric } from "./config";

const TZ = "Europe/London";

function metric(periods: unknown[], id = MEDITATION_ID): TrackerMetric {
  return parseTrackerResponse(200, okBody([{ id, name: "Meditation", periods }])).metrics[0]!;
}

describe("trackerWindow", () => {
  it("runs from the Monday 8 weeks before the current ISO week to the end of the current week, in local time", () => {
    // Sunday 8 Nov 2026 is in 2026-W45; the window spans the clocks-back change.
    const w = trackerWindow({ year: 2026, month: 11, day: 8 }, TZ);
    expect(w.weeks).toHaveLength(9);
    expect(w.weeks[0]).toEqual({ year: 2026, week: 37 });
    expect(w.weeks[8]).toEqual({ year: 2026, week: 45 });
    expect(w.from).toBe("2026-09-07T00:00:00+01:00");
    expect(w.to).toBe("2026-11-09T00:00:00+00:00");
  });

  it("crosses the year boundary", () => {
    const w = trackerWindow({ year: 2027, month: 1, day: 6 }, TZ); // 2027-W01
    expect(w.weeks[0]).toEqual({ year: 2026, week: 46 });
    expect(w.from).toBe("2026-11-09T00:00:00+00:00");
    expect(w.to).toBe("2027-01-11T00:00:00+00:00");
  });

  it("writes local midnight with the zone's offset on DST days", () => {
    expect(localMidnightIso({ year: 2026, month: 10, day: 25 }, TZ)).toBe("2026-10-25T00:00:00+01:00");
    expect(localMidnightIso({ year: 2026, month: 10, day: 26 }, TZ)).toBe("2026-10-26T00:00:00+00:00");
    expect(localMidnightIso({ year: 2027, month: 3, day: 28 }, TZ)).toBe("2027-03-28T00:00:00+00:00");
    expect(localMidnightIso({ year: 2027, month: 3, day: 29 }, TZ)).toBe("2027-03-29T00:00:00+01:00");
  });
});

describe("trackerRequestUrl", () => {
  it("asks for day buckets and encodes + offsets as %2B", () => {
    const url = trackerRequestUrl("https://tracker-metrics-api.vercel.app/", {
      from: "2027-03-29T00:00:00+01:00",
      to: "2027-05-10T00:00:00+01:00",
    });
    expect(url).toBe(
      "https://tracker-metrics-api.vercel.app/v1/metrics?from=2027-03-29T00%3A00%3A00%2B01%3A00&to=2027-05-10T00%3A00%3A00%2B01%3A00&granularity=day",
    );
    expect(url).not.toContain("+");
  });
});

describe("parseTrackerResponse", () => {
  it("reads metrics and their buckets", () => {
    const r = parseTrackerResponse(200, okBody([{ id: MEDITATION_ID, name: "Meditation", periods: clocksBackWeek }]));
    expect(r.metrics[0]).toMatchObject({ id: MEDITATION_ID, name: "Meditation", type: "timed" });
    expect(r.metrics[0]!.periods).toHaveLength(7);
    expect(r.metrics[0]!.periods[6]).toEqual({
      start: "2026-10-25T00:00:00+01:00",
      end: "2026-10-26T00:00:00+00:00",
      entryCount: 2,
      value: 30,
    });
  });

  it.each([
    [401, errorBodies.unauthorized, "Tracker API error (HTTP 401): unauthorized: Missing or invalid API key"],
    [400, errorBodies.rangeTooLarge, "Tracker API error (HTTP 400): range_too_large: The range can be at most 2 years"],
    [500, errorBodies.internal, "Tracker API error (HTTP 500): internal_error: Something went wrong"],
    [500, errorBodies.misconfigured, "Tracker API error (HTTP 500): server_misconfigured: Server is missing configuration"],
    [502, "<html>Bad gateway</html>", "Tracker API error (HTTP 502): no error details"],
  ])("turns HTTP %i into a TrackerError with the API's code and message", (status, body, message) => {
    expect(() => parseTrackerResponse(status, body)).toThrow(new TrackerError(message));
  });

  it("rejects a body that isn't the documented shape", () => {
    expect(() => parseTrackerResponse(200, "not json")).toThrow(/isn't JSON/);
    expect(() => parseTrackerResponse(200, "{}")).toThrow(/no `metrics` list/);
    expect(() => parseTrackerResponse(200, JSON.stringify({ granularity: "day", metrics: [{ name: "x" }] }))).toThrow(
      /metric 1 has no id/,
    );
    const badBucket = okBody([{ id: "a", name: "A", periods: [{ start: "nope", end: "x", entryCount: 1, value: 2 }] }]);
    expect(() => parseTrackerResponse(200, badBucket)).toThrow(/bucket 1 of "A" is malformed/);
  });

  it("rejects a server that ignored granularity=day", () => {
    expect(() => parseTrackerResponse(200, okBody([], { granularity: "period" }))).toThrow(/granularity "period"/);
  });

  it("treats an error body as an error even with status 200", () => {
    expect(() => parseTrackerResponse(200, errorBodies.internal)).toThrow(/internal_error/);
  });
});

describe("weekTotals: day buckets into ISO weeks (Europe/London)", () => {
  it("sums the clocks-back week, including its 25-hour Sunday, into that week", () => {
    const totals = weekTotals(metric([...clocksBackWeek, mondayAfterClocksBack]), TZ);
    expect(totals.get("2026-W43")).toEqual({ value: 75, entryCount: 6 });
    expect(totals.get("2026-W44")).toEqual({ value: 5, entryCount: 1 });
  });

  it("sums the clocks-forward week, including its 23-hour Sunday, into that week", () => {
    const totals = weekTotals(metric(clocksForwardWeek), TZ);
    expect([...totals.keys()]).toEqual(["2027-W12"]);
    expect(totals.get("2027-W12")).toEqual({ value: 85, entryCount: 5 });
  });

  it("counts a null day value (average with no entries) as 0", () => {
    const totals = weekTotals(metric([{ ...clocksForwardWeek[0]!, value: null, entryCount: 0 }]), TZ);
    expect(totals.get("2027-W12")).toEqual({ value: 0, entryCount: 0 });
  });

  it("uses a weekly checklist bucket for its week and skips a monthly one", () => {
    const weekly = { start: "2027-05-03T00:00:00+01:00", end: "2027-05-10T00:00:00+01:00", entryCount: 2, value: 2 };
    const monthly = { start: "2027-05-01T00:00:00+01:00", end: "2027-06-01T00:00:00+01:00", entryCount: 3, value: 3 };
    const totals = weekTotals(metric([weekly, monthly]), TZ);
    expect([...totals.entries()]).toEqual([["2027-W18", { value: 2, entryCount: 2 }]]);
  });

  it("aggregates sum from bucket values and count from entry counts", () => {
    expect(aggregateWeek({ value: 75, entryCount: 6 }, "sum")).toBe(75);
    expect(aggregateWeek({ value: 75, entryCount: 6 }, "count")).toBe(6);
  });
});

describe("trackerApply", () => {
  const config = sampleConfig();
  const meditation = findMetric(config, "meditation")!;
  // Wednesday 5 May 2027: window 2027-W10 … W18; W12 is the clocks-forward week.
  const window = trackerWindow({ year: 2027, month: 5, day: 5 }, TZ);
  const now = "2027-05-05T10:00:00.000Z";
  const response = (periods: unknown[]) =>
    parseTrackerResponse(
      200,
      okBody([
        { id: READING_ID, name: "Reading", periods: [] },
        { id: MEDITATION_ID, name: "Meditation", periods },
      ]),
    );
  const apply = (doc: RawDataDocument, periods: unknown[]) => {
    const data = readScoreboardData(doc);
    const { patch, problems } = trackerApply(config, data, response(periods), window, now);
    const result = applyDataPatch(doc, patch);
    return { ...result, data: readScoreboardData(result.doc), patch, problems };
  };

  it("writes each week's value into its snapshot, with source and fetch time", () => {
    const periods = [...clocksForwardWeek, ...week("2027-05-03", [10, 20, 0, 0, 0, 0, 0])];
    const { data, problems } = apply({ version: 1 }, periods);
    expect(problems).toEqual([]);
    expect(data.snapshots["2027-W12"]).toMatchObject({
      frozen: true,
      metrics: { meditation: { value: 85, target: 100, verdict: "missed", source: "tracker", fetchedAt: now } },
    });
    expect(data.snapshots["2027-W18"]).toMatchObject({
      frozen: false,
      metrics: { meditation: { value: 30, target: 100, verdict: "in-progress" } },
    });
    expect(metricWeekValue(meditation, data, "2027-W18")).toEqual({ value: 30, source: "tracker", at: now });
    // Weeks with no buckets (before the tracker metric existed) get nothing.
    expect(data.snapshots["2027-W11"]).toBeUndefined();
  });

  it("updates a frozen week's value from late entries but keeps its stored target", () => {
    const doc: RawDataDocument = {
      version: 1,
      snapshots: {
        "2027-W12": {
          frozen: true,
          updatedAt: "2027-03-29T09:00:00Z",
          metrics: { meditation: { value: 60, target: 80, verdict: "missed", source: "tracker", fetchedAt: "x" } },
        },
      },
    };
    const { data } = apply(doc, clocksForwardWeek); // 85 now (offline entries synced late)
    expect(data.snapshots["2027-W12"]).toMatchObject({
      frozen: true,
      metrics: { meditation: { value: 85, target: 80, verdict: "hit" } },
    });
  });

  it("follows the API down as well as up", () => {
    const first = apply({ version: 1 }, week("2027-05-03", [50, 0, 0, 0, 0, 0, 0]));
    const second = apply(first.doc, week("2027-05-03", [20, 0, 0, 0, 0, 0, 0]));
    expect(second.data.snapshots["2027-W18"]!.metrics.meditation!.value).toBe(20);
  });

  it("changes nothing when the values are the same (so nothing is written)", () => {
    const periods = week("2027-05-03", [10, 20, 0, 0, 0, 0, 0]);
    const first = apply({ version: 1 }, periods);
    const second = apply(first.doc, periods);
    expect(second.patch).toEqual([]);
    expect(second.changed).toBe(false);
  });

  it("uses entry counts for aggregate: count", () => {
    const counted = sampleConfig();
    const m = findMetric(counted, "meditation")!;
    if (m.source.type === "tracker") m.source.aggregate = "count";
    const { patch } = trackerApply(counted, emptyScoreboardData(), response(clocksForwardWeek), window, now);
    const data = readScoreboardData(applyDataPatch({ version: 1 }, patch).doc);
    expect(data.snapshots["2027-W12"]!.metrics.meditation!.value).toBe(5);
  });

  it("reports an unknown tracker id with every available name and id", () => {
    const other = sampleConfig();
    const m = findMetric(other, "meditation")!;
    if (m.source.type === "tracker") m.source.metric = "<tracker metric id>";
    const { patch, problems } = trackerApply(other, emptyScoreboardData(), response(clocksForwardWeek), window, now);
    expect(patch).toEqual([]);
    expect(problems).toEqual([
      {
        metricId: "meditation",
        field: ["source", "metric"],
        message: [
          'Metric "Meditation": tracker metric id "<tracker metric id>" isn\'t in the tracker. Available tracker metrics (name: id):',
          `- Reading: ${READING_ID}`,
          `- Meditation: ${MEDITATION_ID}`,
        ].join("\n"),
      },
    ]);
  });
});
