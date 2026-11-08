import { describe, expect, it } from "vitest";
import { memoryIO } from "../../tests/fixtures/memoryIO";
import { DataFileFormatError, setManualLatestEntry, setManualWeeklyEntry } from "../core/data";
import { DataFileRepository } from "./DataFileRepository";

const PATH = "🗺️ Plans/🎯 2027 Plan/scoreboard-data.json";
const at = "2027-05-05T10:00:00.000Z";

describe("DataFileRepository", () => {
  it("loads a missing file as empty data without writing", async () => {
    const mem = memoryIO();
    const data = await new DataFileRepository(mem.io, () => PATH).load();
    expect(data.manual.weekly).toEqual({});
    expect(mem.writes).toEqual([]);
  });

  it("creates the file on first change and persists across instances (restart)", async () => {
    const mem = memoryIO();
    await new DataFileRepository(mem.io, () => PATH).update([
      setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at }),
    ]);
    const reloaded = await new DataFileRepository(mem.io, () => PATH).load();
    expect(reloaded.manual.weekly.music?.["2027-W18"]?.value).toBe(40);
    expect(JSON.parse(mem.files.get(PATH)!).version).toBe(1);
  });

  it("writes nothing when the patch changes nothing", async () => {
    const mem = memoryIO();
    const repo = new DataFileRepository(mem.io, () => PATH);
    const op = setManualLatestEntry("eps", { value: 1, enteredAt: at });
    expect((await repo.update([op])).changed).toBe(true);
    expect((await repo.update([op])).changed).toBe(false);
    expect((await repo.update([])).changed).toBe(false);
    expect(mem.writes).toHaveLength(1);
  });

  it("re-reads before writing and keeps a concurrent change from another device", async () => {
    const mem = memoryIO();
    const repo = new DataFileRepository(mem.io, () => PATH);
    await repo.load(); // our view of the file: empty
    // Another device syncs in an entry after we loaded.
    mem.files.set(
      PATH,
      JSON.stringify({ version: 1, manual: { weekly: { wau: { "2027-W18": { value: 20, enteredAt: at } } } }, other: 1 }),
    );
    const { data } = await repo.update([setManualWeeklyEntry("music", "2027-W18", { value: 40, enteredAt: at })]);
    expect(data.manual.weekly.wau?.["2027-W18"]?.value).toBe(20);
    expect(data.manual.weekly.music?.["2027-W18"]?.value).toBe(40);
    expect(JSON.parse(mem.files.get(PATH)!).other).toBe(1);
  });

  it("queues updates so two saves don't lose each other", async () => {
    const mem = memoryIO();
    const repo = new DataFileRepository(mem.io, () => PATH);
    await Promise.all([
      repo.update([setManualLatestEntry("a", { value: 1, enteredAt: at })]),
      repo.update([setManualLatestEntry("b", { value: 2, enteredAt: at })]),
    ]);
    const data = await repo.load();
    expect(Object.keys(data.manual.latest).sort()).toEqual(["a", "b"]);
  });

  it("refuses to overwrite a file it can't read", async () => {
    const mem = memoryIO({ [PATH]: "{ corrupted" });
    const repo = new DataFileRepository(mem.io, () => PATH);
    await expect(repo.update([setManualLatestEntry("a", { value: 1, enteredAt: at })])).rejects.toThrow(
      DataFileFormatError,
    );
    expect(mem.files.get(PATH)).toBe("{ corrupted");
    // A failed update doesn't block later ones.
    mem.files.set(PATH, "{}");
    await expect(repo.update([setManualLatestEntry("a", { value: 1, enteredAt: at })])).resolves.toMatchObject({
      changed: true,
    });
  });
});
