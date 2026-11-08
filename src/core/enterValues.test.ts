import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { applyDataPatch, emptyScoreboardData, readScoreboardData } from "./data";
import { buildEnterValuesFields, enterValuesPatch, parseEnteredNumber } from "./enterValues";

const week = { year: 2027, week: 18 };
const at = "2027-05-05T10:00:00.000Z";

function dataWithHistory() {
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = {
    "2027-W17": { value: 45, enteredAt: at },
    "2027-W18": { value: 20, enteredAt: at },
  };
  data.manual.latest["eps"] = { value: 1, enteredAt: at };
  return data;
}

describe("buildEnterValuesFields", () => {
  it("lists only manual metrics, in config order", () => {
    const fields = buildEnterValuesFields(sampleConfig(), emptyScoreboardData(), week);
    expect(fields.map((f) => f.metricId)).toEqual(["tengu-wau", "asl", "resting-hr", "music-practice", "eps", "gigs"]);
    expect(fields.map((f) => f.metricId)).not.toContain("meditation");
  });

  it("starts weekly fields blank with a 'last week: N' hint", () => {
    const fields = buildEnterValuesFields(sampleConfig(), dataWithHistory(), week);
    const music = fields.find((f) => f.metricId === "music-practice")!;
    expect(music).toMatchObject({ mode: "week", initial: "", stored: 20 });
    expect(music.hint).toBe("last week: 45 min · entered this week: 20 min");
    const wau = fields.find((f) => f.metricId === "tengu-wau")!;
    expect(wau).toMatchObject({ initial: "", hint: "last week: –", stored: null });
  });

  it("pre-fills year fields with the latest value", () => {
    const eps = buildEnterValuesFields(sampleConfig(), dataWithHistory(), week).find((f) => f.metricId === "eps")!;
    expect(eps).toMatchObject({ mode: "latest", initial: "1", stored: 1 });
  });
});

describe("parseEnteredNumber", () => {
  it("parses numbers with separators and units", () => {
    expect(parseEnteredNumber(" 1,200 ")).toEqual({ kind: "number", value: 1200 });
    expect(parseEnteredNumber("£4300")).toEqual({ kind: "number", value: 4300 });
    expect(parseEnteredNumber("40%")).toEqual({ kind: "number", value: 40 });
    expect(parseEnteredNumber("0")).toEqual({ kind: "number", value: 0 });
    expect(parseEnteredNumber("2.5")).toEqual({ kind: "number", value: 2.5 });
  });

  it("treats blank as unchanged and rejects non-numbers", () => {
    expect(parseEnteredNumber("   ")).toEqual({ kind: "blank" });
    expect(parseEnteredNumber("abc")).toEqual({ kind: "invalid" });
    expect(parseEnteredNumber("1.2.3")).toEqual({ kind: "invalid" });
  });
});

describe("enterValuesPatch", () => {
  const fields = buildEnterValuesFields(sampleConfig(), dataWithHistory(), week);

  it("saves typed values in one patch and leaves blank fields unchanged", () => {
    const { patch, errors } = enterValuesPatch(
      fields,
      { "music-practice": "55", "tengu-wau": "", eps: "2" },
      week,
      at,
    );
    expect(errors).toEqual({});
    expect(patch).toEqual([
      { path: ["manual", "weekly", "music-practice", "2027-W18"], value: { value: 55, enteredAt: at } },
      { path: ["manual", "latest", "eps"], value: { value: 2, enteredAt: at } },
    ]);
  });

  it("replaces this week's earlier entry and keeps other weeks", () => {
    const { patch } = enterValuesPatch(fields, { "music-practice": "55" }, week, at);
    const before = { version: 1, manual: dataWithHistory().manual } as Record<string, unknown>;
    const after = readScoreboardData(applyDataPatch(before, patch).doc);
    expect(after.manual.weekly["music-practice"]).toEqual({
      "2027-W17": { value: 45, enteredAt: at },
      "2027-W18": { value: 55, enteredAt: at },
    });
  });

  it("replaces a year metric's running total rather than adding to it", () => {
    const later = "2027-05-12T10:00:00.000Z";
    const { patch } = enterValuesPatch(fields, { eps: "3" }, week, later);
    const before = { version: 1, manual: dataWithHistory().manual } as Record<string, unknown>;
    const after = readScoreboardData(applyDataPatch(before, patch).doc);
    expect(after.manual.latest["eps"]).toEqual({ value: 3, enteredAt: later });
  });

  it("skips values equal to what is stored (an untouched pre-filled year field)", () => {
    const { patch } = enterValuesPatch(fields, { eps: "1", "music-practice": "20" }, week, at);
    expect(patch).toEqual([]);
  });

  it("reports non-numbers per field", () => {
    const { errors } = enterValuesPatch(fields, { "music-practice": "lots" }, week, at);
    expect(Object.keys(errors)).toEqual(["music-practice"]);
  });
});
