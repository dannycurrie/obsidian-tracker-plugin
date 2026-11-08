import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectNote } from "../core/projects";
import { ProjectsStore } from "./ProjectsStore";

function note(title: string, nextAction: string | null = "Next"): ProjectNote {
  return { path: `P/${title}.md`, title, status: "active", rawStatus: "active", goalId: "career", rank: null, nextAction };
}

describe("ProjectsStore", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads the notes and notifies listeners", async () => {
    const store = new ProjectsStore({ readNotes: async () => [note("A")] });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getState().notes).toBeNull();
    await store.reload();
    expect(store.getState().notes).toEqual([note("A")]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when nothing changed", async () => {
    const store = new ProjectsStore({ readNotes: async () => [note("A")] });
    await store.reload();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.reload();
    expect(listener).not.toHaveBeenCalled();
  });

  it("batches change events into one read", async () => {
    let next = "first";
    const readNotes = vi.fn(async () => [note("A", next)]);
    const store = new ProjectsStore({ readNotes, debounceMs: 100 });
    store.scheduleReload();
    store.scheduleReload();
    next = "edited";
    store.scheduleReload();
    await vi.advanceTimersByTimeAsync(100);
    expect(readNotes).toHaveBeenCalledTimes(1);
    expect(store.getState().notes?.[0]?.nextAction).toBe("edited");
  });

  it("keeps the last notes and reports an error when a read fails", async () => {
    let fail = false;
    const store = new ProjectsStore({
      readNotes: async () => {
        if (fail) throw new Error("boom");
        return [note("A")];
      },
    });
    await store.reload();
    fail = true;
    await store.reload();
    expect(store.getState()).toEqual({ notes: [note("A")], error: "Could not read project notes: boom" });
  });

  it("lets a newer read win over a slower older one", async () => {
    const resolvers: ((n: ProjectNote[]) => void)[] = [];
    const store = new ProjectsStore({ readNotes: () => new Promise((r) => resolvers.push(r)) });
    const first = store.reload();
    const second = store.reload();
    resolvers[1]!([note("New")]);
    await second;
    resolvers[0]!([note("Old")]);
    await first;
    expect(store.getState().notes?.[0]?.title).toBe("New");
  });

  it("stops scheduled reads after dispose", async () => {
    const readNotes = vi.fn(async () => [note("A")]);
    const store = new ProjectsStore({ readNotes, debounceMs: 10 });
    store.scheduleReload();
    store.dispose();
    await vi.advanceTimersByTimeAsync(50);
    expect(readNotes).not.toHaveBeenCalled();
  });
});
