import { describe, expect, it } from "vitest";
import {
  applyDataPatch,
  DataFileFormatError,
  parseDataDocument,
  readScoreboardData,
  serializeDataDocument,
  setManualLatestEntry,
  setManualWeeklyEntry,
  type RawDataDocument,
} from "./data";

const at = "2027-05-05T10:00:00.000Z";

describe("parseDataDocument", () => {
  it("treats a missing or empty file as a new version-1 document", () => {
    expect(parseDataDocument(null)).toEqual({ version: 1 });
    expect(parseDataDocument("  \n")).toEqual({ version: 1 });
  });

  it("refuses invalid JSON, non-objects and unknown versions (so they are never overwritten)", () => {
    expect(() => parseDataDocument("{ nope")).toThrow(DataFileFormatError);
    expect(() => parseDataDocument("[1,2]")).toThrow(DataFileFormatError);
    expect(() => parseDataDocument('{"version":2}')).toThrow(/version 2/);
  });

  it("round-trips through serialisation", () => {
    const doc = { version: 1, manual: { latest: { eps: { value: 1, enteredAt: at } } } };
    expect(parseDataDocument(serializeDataDocument(doc))).toEqual(doc);
  });
});

describe("readScoreboardData", () => {
  it("reads manual entries and fills in missing sections", () => {
    const data = readScoreboardData({
      version: 1,
      manual: { weekly: { music: { "2027-W18": { value: 40, enteredAt: at } } } },
    });
    expect(data.manual.weekly.music?.["2027-W18"]).toEqual({ value: 40, enteredAt: at });
    expect(data.manual.latest).toEqual({});
    expect(data.snapshots).toEqual({});
    expect(data.exports).toEqual({});
  });

  it("drops unreadable entries from the view without throwing", () => {
    const data = readScoreboardData({
      manual: { weekly: { music: { "2027-W18": { value: "lots" } } }, latest: { eps: null } },
      snapshots: "garbage",
    });
    expect(data.manual.weekly.music).toEqual({});
    expect(data.manual.latest).toEqual({});
    expect(data.snapshots).toEqual({});
  });
});

describe("applyDataPatch", () => {
  it("adds an entry, creating parent objects", () => {
    const { doc, changed } = applyDataPatch({ version: 1 }, [
      setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at }),
    ]);
    expect(changed).toBe(true);
    expect(doc).toEqual({ version: 1, manual: { weekly: { music: { "2027-W18": { value: 40, enteredAt: at } } } } });
  });

  it("replaces an earlier entry for the same metric and week", () => {
    const latest = applyDataPatch({}, [setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at })]).doc;
    const later = "2027-05-06T10:00:00.000Z";
    const { doc } = applyDataPatch(latest, [setManualWeeklyEntry("music", "2027-W18", { value: 55, enteredAt: later })]);
    expect(readScoreboardData(doc).manual.weekly.music).toEqual({ "2027-W18": { value: 55, enteredAt: later } });
  });

  it("reports no change when the value is deep-equal (so nothing is written)", () => {
    const entry = { value: 40, enteredAt: at };
    const latest = applyDataPatch({}, [setManualWeeklyEntry("music", "2027-W18", entry)]).doc;
    const result = applyDataPatch(latest, [setManualWeeklyEntry("music", "2027-W18", { ...entry })]);
    expect(result.changed).toBe(false);
    expect(result.doc).toBe(latest);
    expect(applyDataPatch(latest, []).changed).toBe(false);
  });

  it("preserves every field the patch doesn't touch, including unknown ones", () => {
    // Simulates another device having written since we last read.
    const latest: RawDataDocument = {
      version: 1,
      futureField: { keep: true },
      manual: {
        weekly: { music: { "2027-W17": { value: 30, enteredAt: at } }, wau: { "2027-W18": { value: 20, enteredAt: at } } },
        latest: { eps: { value: 1, enteredAt: at } },
      },
      snapshots: { "2027-W17": { frozen: true, updatedAt: at, metrics: {} } },
    };
    const { doc } = applyDataPatch(latest, [
      setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at }),
      setManualLatestEntry("vanguard", { value: 4300, enteredAt: at }),
    ]);
    expect(doc.futureField).toEqual({ keep: true });
    expect(doc.snapshots).toBe(latest.snapshots);
    const data = readScoreboardData(doc);
    expect(data.manual.weekly.music).toEqual({
      "2027-W17": { value: 30, enteredAt: at },
      "2027-W18": { value: 40, enteredAt: at },
    });
    expect(data.manual.weekly.wau).toEqual({ "2027-W18": { value: 20, enteredAt: at } });
    expect(data.manual.latest).toEqual({
      eps: { value: 1, enteredAt: at },
      vanguard: { value: 4300, enteredAt: at },
    });
  });

  it("does not mutate the input document", () => {
    const latest: RawDataDocument = { version: 1, manual: { weekly: {} } };
    const before = JSON.stringify(latest);
    applyDataPatch(latest, [setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at })]);
    expect(JSON.stringify(latest)).toBe(before);
  });

  it("deletes a path when value is undefined", () => {
    const latest = { version: 1, manual: { latest: { eps: { value: 1, enteredAt: at } } } };
    const { doc, changed } = applyDataPatch(latest, [{ path: ["manual", "latest", "eps"], value: undefined }]);
    expect(changed).toBe(true);
    expect(doc).toEqual({ version: 1, manual: { latest: {} } });
  });

  it("adds a version to a version-less document when it writes", () => {
    const { doc } = applyDataPatch({}, [setManualLatestEntry("eps", { value: 1, enteredAt: at })]);
    expect(doc.version).toBe(1);
  });
});
