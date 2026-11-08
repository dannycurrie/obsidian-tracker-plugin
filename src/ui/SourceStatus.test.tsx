/** Tracker values in the view (ticket 07): hover provenance, stale marking, header refresh line. */
import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "../core/data";
import { initialScoreboardState, type ScoreboardState } from "../core/viewState";
import { ScoreboardApp } from "./ScoreboardApp";

const today = { year: 2027, month: 5, day: 5 };
const text = (html: string) => html.replace(/<[^>]*>/g, "");

function state(overrides: Partial<ScoreboardState>): ScoreboardState {
  const data = emptyScoreboardData();
  data.snapshots["2027-W18"] = {
    frozen: false,
    updatedAt: "2027-05-05T09:00:00.000Z",
    metrics: { meditation: { value: 70, target: 100, source: "tracker", fetchedAt: "2027-05-05T09:00:00.000Z" } },
  };
  return {
    ...initialScoreboardState(),
    status: "ready",
    config: sampleConfig(),
    configValid: true,
    data,
    loadedAt: "2027-05-05T13:00:00.000Z",
    ...overrides,
  };
}

describe("tracker values in the view", () => {
  it("shows the tracker value with its source and fetch time on hover, and the refresh time", () => {
    const html = render(
      <ScoreboardApp today={today} state={state({ sources: { tracker: { ok: true, fetchedAt: "2027-05-05T13:00:00.000Z" } } })} />,
    );
    expect(text(html)).toContain("70 / 100 min");
    expect(html).toContain('title="Tracker · fetched 5 May 2027, 14:00"');
    expect(html).toContain("Refreshed 5 May 2027, 14:00");
    expect(html).not.toContain("stale");
  });

  it("marks a failed source's values stale with their age, and says why in the header", () => {
    const sources = {
      tracker: { ok: false as const, error: "Tracker API error (HTTP 401): unauthorized", failedAt: "2027-05-05T13:00:00.000Z", lastFetchedAt: null },
    };
    const html = render(<ScoreboardApp today={today} state={state({ sources })} />);
    expect(text(html)).toContain("70 / 100 min");
    expect(html).toContain("stale · 4 h old");
    expect(html).toContain("Tracker · last fetched 5 May 2027, 10:00 · stale: Tracker API error (HTTP 401): unauthorized");
    expect(html).toContain("Tracker: Tracker API error (HTTP 401): unauthorized Showing the last good values, marked stale.");
  });
});
