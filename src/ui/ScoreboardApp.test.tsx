import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "../core/data";
import { initialScoreboardState, type ScoreboardState } from "../core/viewState";
import { ScoreboardApp } from "./ScoreboardApp";

// Wednesday 5 May 2027 is in 2027-W18.
const today = { year: 2027, month: 5, day: 5 };
const at = "2027-05-05T10:00:00Z";

function readyState(overrides: Partial<ScoreboardState> = {}): ScoreboardState {
  return { ...initialScoreboardState(), status: "ready", config: sampleConfig(), configValid: true, ...overrides };
}

describe("ScoreboardApp", () => {
  it("shows 'Week N of 52' in the header", () => {
    const html = render(<ScoreboardApp today={today} state={initialScoreboardState()} />);
    expect(html).toContain("Week 18 of 52");
  });

  it("shows 'of 53' for 2026-W53 (1–3 Jan 2027)", () => {
    const html = render(<ScoreboardApp today={{ year: 2027, month: 1, day: 2 }} state={initialScoreboardState()} />);
    expect(html).toContain("Week 53 of 53");
  });

  it("renders goal cards with name, statement and weekly rows from the config", () => {
    const html = render(<ScoreboardApp today={today} state={readyState()} />);
    expect(html).toContain("Creative");
    expect(html).toContain("Put more music out into the world");
    expect(html).toContain("Music practice, playing, recording");
    expect(html).toContain("– / 60 min");
    expect(html).toContain("60 to go this week");
  });

  it("shows value / target and Hit or N to go, with the This week tile", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
    data.manual.weekly["tengu-wau"] = { "2027-W18": { value: 26, enteredAt: at } };
    const html = render(<ScoreboardApp today={today} state={readyState({ data })} onEnterValues={() => {}} />);
    expect(html).toContain("40 / 60 min");
    expect(html).toContain("20 to go this week");
    expect(html).toContain("26 / 25");
    expect(html).toMatch(/>Hit · streak 1</);
    expect(html).toContain("This week");
    expect(html).toContain("1/3");
    expect(html).toContain("weekly targets hit");
    expect(html).toContain("Enter values");
    expect(html).toContain('title="Manual entry · 5 May 2027, 11:00"');
  });

  it("renders the history strip of completed weeks and 'Hit · streak N'", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = {
      "2027-W15": { value: 60, enteredAt: at },
      "2027-W17": { value: 70, enteredAt: at },
      "2027-W18": { value: 60, enteredAt: at },
    };
    data.snapshots["2027-W16"] = { frozen: true, updatedAt: at, metrics: { "music-practice": { value: 50, target: 60 } } };
    const html = render(<ScoreboardApp today={today} state={readyState({ data })} />);
    expect(html).toContain('aria-label="Last 3 weeks: 2 hit, 1 missed"');
    expect(html).toContain('title="Week 15: 60 / 60 min · Hit"');
    expect(html).toContain('title="Week 16: 50 / 60 min · Missed"');
    expect(html.match(/scoreboard-history__week is-hit/g)).toHaveLength(2);
    expect(html.match(/scoreboard-history__week is-missed/g)).toHaveLength(1);
    expect(html).toContain("Hit · streak 2");
    // No strip for metrics with no data before this week.
    expect(html.match(/class="scoreboard-history"/g)).toHaveLength(1);
  });

  it("says target, never goal, for the number", () => {
    const html = render(<ScoreboardApp today={today} state={readyState()} />);
    const visibleText = html.replace(/<[^>]*>/g, " ");
    expect(visibleText).not.toMatch(/goal/i);
    expect(visibleText).toContain("weekly targets hit");
  });

  it("lists config problems with line numbers", () => {
    const html = render(
      <ScoreboardApp
        today={today}
        state={readyState({
          configProblems: [{ message: "Metric \"x\": `target` must be a number.", line: 12 }],
          usingLastValidConfig: true,
        })}
      />,
    );
    expect(html).toContain("The config file has a problem.");
    expect(html).toContain("Line 12:");
    expect(html).toContain("showing the last valid config");
    expect(html).toContain("export is blocked");
  });

  it("shows no banner for a valid config", () => {
    const html = render(<ScoreboardApp today={today} state={readyState()} />);
    expect(html).not.toContain("scoreboard-banner");
  });

  it("explains an unreadable config file", () => {
    const html = render(<ScoreboardApp today={today} state={readyState({ configError: 'No config file at "x".' })} />);
    expect(html).toContain('No config file at &quot;x&quot;.');
    expect(html).toContain("Export is blocked until it is fixed.");
  });

  it("warns about history for metric ids no longer in the config", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["practice"] = { "2027-W17": { value: 30, enteredAt: at } };
    const html = render(<ScoreboardApp today={today} state={readyState({ data })} />);
    expect(html).toContain("The data file has history for a metric id not in the");
    expect(html).toContain("practice: 1 weekly entry");
    expect(html).not.toContain('role="alert"');
  });

  it("hides Enter values while there is no config", () => {
    const html = render(<ScoreboardApp today={today} state={readyState({ config: null })} onEnterValues={() => {}} />);
    expect(html).not.toContain("Enter values");
  });
});

describe("ScoreboardApp: year metrics", () => {
  it("shows value / target, a progress bar with plan tick, the pace label and the Year to date tile", () => {
    const data = emptyScoreboardData();
    data.manual.latest["eps"] = { value: 2, enteredAt: at };
    data.manual.latest["asl"] = { value: 20, enteredAt: "2027-03-24T10:00:00Z" };
    const html = render(<ScoreboardApp today={today} state={readyState({ data })} />);
    expect(html).toContain("2 / 5");
    expect(html).toContain("0.3 ahead of pace");
    expect(html).toContain("20 / 100%");
    expect(html).toContain("5.4% behind pace");
    expect(html).toContain("updated 6 wks ago");
    expect(html.match(/updated [0-9]+ wks? ago/g)).toHaveLength(1);
    expect(html).toContain("scoreboard-progress__plan-tick");
    expect(html).toContain("Year to date");
    expect(html).toContain("1/2");
    expect(html).toContain("year targets on pace");
  });
});
