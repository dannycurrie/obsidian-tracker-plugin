import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { ScoreboardApp } from "./ScoreboardApp";

describe("ScoreboardApp", () => {
  it("shows 'Week N of 52' in the header", () => {
    const html = render(<ScoreboardApp week={{ year: 2027, week: 18 }} />);
    expect(html).toContain("Week 18 of 52");
  });

  it("shows 'of 53' for 2026-W53 (1–3 Jan 2027)", () => {
    const html = render(<ScoreboardApp week={{ year: 2026, week: 53 }} />);
    expect(html).toContain("Week 53 of 53");
  });
});
