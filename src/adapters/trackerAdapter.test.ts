import { describe, expect, it, vi } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { errorBodies, MEDITATION_ID, okBody, week } from "../../tests/fixtures/trackerResponses";
import { allMetrics } from "../core/config";
import { emptyScoreboardData } from "../core/data";
import { createTrackerAdapter, type HttpGet } from "./trackerAdapter";

const now = new Date("2027-05-05T10:00:00.000Z");
const nowIso = now.toISOString();

function adapter(http: HttpGet, key = "k".repeat(32)) {
  return createTrackerAdapter({ http, apiUrl: () => "https://tracker.example/", apiKey: () => key });
}

const okHttp = (body = okBody([{ id: MEDITATION_ID, name: "Meditation", periods: week("2027-05-03", [10, 5]) }])) =>
  vi.fn<HttpGet>(async () => ({ status: 200, text: body }));

describe("tracker adapter", () => {
  const config = sampleConfig();
  const data = emptyScoreboardData();

  it("makes one GET with the bearer key for the whole window, and writes week values", async () => {
    const http = okHttp();
    const result = await adapter(http).refresh({ config, data, now });
    expect(http).toHaveBeenCalledTimes(1);
    const [url, headers] = http.mock.calls[0]!;
    expect(url).toBe(
      "https://tracker.example/v1/metrics?from=2027-03-08T00%3A00%3A00%2B00%3A00&to=2027-05-10T00%3A00%3A00%2B01%3A00&granularity=day",
    );
    expect(headers).toMatchObject({ Authorization: `Bearer ${"k".repeat(32)}` });
    expect(result.status).toEqual({ ok: true, fetchedAt: nowIso });
    expect(result.problems).toEqual([]);
    expect(result.patch).toContainEqual({
      path: ["snapshots", "2027-W18", "metrics", "meditation"],
      value: { value: 15, target: 100, verdict: "in-progress", source: "tracker", fetchedAt: nowIso },
    });
  });

  it("does nothing (no request, no status) when no metric uses the tracker", async () => {
    const manualOnly = sampleConfig();
    for (const m of allMetrics(manualOnly)) m.source = { type: "manual", cadence: "weekly" };
    const http = okHttp();
    expect(await adapter(http).refresh({ config: manualOnly, data, now })).toEqual({ status: null, patch: [], problems: [] });
    expect(http).not.toHaveBeenCalled();
  });

  it("fails without a request when no key is set", async () => {
    const http = okHttp();
    const result = await adapter(http, "  ").refresh({ config, data, now });
    expect(http).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: { ok: false, error: expect.stringContaining("No tracker API key set"), failedAt: nowIso, lastFetchedAt: null },
      patch: [],
      problems: null,
    });
  });

  it("fails on a network error, writing nothing and keeping earlier problems", async () => {
    const http = vi.fn<HttpGet>(async () => {
      throw new Error("net::ERR_INTERNET_DISCONNECTED");
    });
    const result = await adapter(http).refresh({ config, data, now });
    expect(result.status).toMatchObject({ ok: false, error: "Couldn't reach the tracker API: net::ERR_INTERNET_DISCONNECTED" });
    expect(result.patch).toEqual([]);
    expect(result.problems).toBeNull();
  });

  it.each([
    [401, errorBodies.unauthorized, /HTTP 401\): unauthorized/],
    [500, errorBodies.internal, /HTTP 500\): internal_error/],
    [200, "garbage", /isn't JSON/],
  ])("fails on HTTP %i with the API's error", async (status, text, error) => {
    const result = await adapter(vi.fn<HttpGet>(async () => ({ status, text }))).refresh({ config, data, now });
    expect(result.status).toMatchObject({ ok: false, error: expect.stringMatching(error) });
    expect(result.patch).toEqual([]);
    expect(result.problems).toBeNull();
  });
});
