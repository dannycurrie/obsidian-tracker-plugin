import { describe, expect, it } from "vitest";
import { formatNumber, formatValue, formatValueOverTarget } from "./format";

describe("format", () => {
  it("formats numbers with separators and up to 2 decimals", () => {
    expect(formatNumber(12000)).toBe("12,000");
    expect(formatNumber(2.345)).toBe("2.35");
    expect(formatNumber(0)).toBe("0");
  });

  it("places units before or after the number", () => {
    expect(formatValue(4300, "£")).toBe("£4,300");
    expect(formatValue(-560, "£")).toBe("-£560");
    expect(formatValue(40, "%")).toBe("40%");
    expect(formatValue(70, "min")).toBe("70 min");
    expect(formatValue(12, "")).toBe("12");
  });

  it("formats value / target, with a dash for no data", () => {
    expect(formatValueOverTarget(70, 100, "min")).toBe("70 / 100 min");
    expect(formatValueOverTarget(4300, 12000, "£")).toBe("£4,300 / £12,000");
    expect(formatValueOverTarget(null, 60, "min")).toBe("– / 60 min");
    expect(formatValueOverTarget(20, 25, "")).toBe("20 / 25");
  });
});

import { valueSourceTitle } from "./format";

describe("valueSourceTitle", () => {
  it("names the source and the London time it was entered", () => {
    expect(valueSourceTitle({ source: "manual", at: "2027-05-05T10:00:00Z" }, "Europe/London")).toBe(
      "Manual entry · 5 May 2027, 11:00",
    );
    expect(valueSourceTitle({ source: "tracker", at: "" }, "Europe/London")).toBe("Tracker");
  });
});
