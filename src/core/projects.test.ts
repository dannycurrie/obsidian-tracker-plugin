import { describe, expect, it } from "vitest";
import {
  buildProjectsModel,
  isInFolder,
  needsFixingLabel,
  nextActionFromMarkdown,
  parseProjectNote,
  slotLabel,
  type ProjectNote,
  type ProjectNoteInput,
} from "./projects";

const goals = [
  { id: "career", name: "Career" },
  { id: "creative", name: "Creative" },
];

function note(overrides: Partial<ProjectNote> & { title: string }): ProjectNote {
  return {
    path: `🚀 Projects/${overrides.title}.md`,
    status: "active",
    rawStatus: overrides.status ?? "active",
    goalId: "career",
    rank: null,
    nextAction: "Do the thing",
    ...overrides,
  };
}

function input(frontmatter: Record<string, unknown> | null, markdown = "", title = "P"): ProjectNoteInput {
  return { path: `🚀 Projects/${title}.md`, title, frontmatter, markdown };
}

describe("nextActionFromMarkdown", () => {
  it("returns the first unchecked task under ## Next actions", () => {
    const md = [
      "---",
      "type: strategic-project",
      "---",
      "# Project",
      "- [ ] Not this one (before the heading)",
      "## Next actions",
      "- [x] Done already",
      "- [ ] Email Sam about the launch",
      "- [ ] Second task",
    ].join("\n");
    expect(nextActionFromMarkdown(md)).toBe("Email Sam about the launch");
  });

  it("returns null when there is no Next actions heading", () => {
    expect(nextActionFromMarkdown("# Project\n- [ ] A task elsewhere\n")).toBeNull();
  });

  it("returns null when every task under the heading is checked", () => {
    expect(nextActionFromMarkdown("## Next actions\n- [x] One\n- [X] Two\n- [-] Cancelled\n")).toBeNull();
  });

  it("returns null when the heading has no tasks", () => {
    expect(nextActionFromMarkdown("## Next actions\nJust some prose.\n- plain bullet\n")).toBeNull();
  });

  it("stops at the next heading of the same or higher level", () => {
    const md = "## Next actions\n- [x] Done\n## Later\n- [ ] Not a next action\n";
    expect(nextActionFromMarkdown(md)).toBeNull();
  });

  it("includes tasks under subheadings and nested tasks", () => {
    expect(nextActionFromMarkdown("## Next actions\n### This week\n  - [ ] Nested task\n")).toBe("Nested task");
  });

  it("accepts other heading levels, case and list markers", () => {
    expect(nextActionFromMarkdown("### next Actions\n* [ ] Star task")).toBe("Star task");
    expect(nextActionFromMarkdown("## Next actions\n1. [ ] Numbered task")).toBe("Numbered task");
    expect(nextActionFromMarkdown("## Next actions\r\n+ [ ] CRLF task\r\n")).toBe("CRLF task");
  });

  it("ignores tasks inside fenced code blocks and empty tasks", () => {
    const md = "## Next actions\n```\n- [ ] in code\n```\n- [ ] \n- [ ] Real one\n";
    expect(nextActionFromMarkdown(md)).toBe("Real one");
  });

  it("does not treat a heading inside frontmatter-like text as a section", () => {
    expect(nextActionFromMarkdown("---\ntitle: x\n---\n## Next actions\n- [ ] After frontmatter")).toBe("After frontmatter");
  });
});

describe("isInFolder", () => {
  it("matches the folder and its subfolders", () => {
    expect(isInFolder("🚀 Projects/A.md", "🚀 Projects/")).toBe(true);
    expect(isInFolder("🚀 Projects/Career/B.md", "🚀 Projects")).toBe(true);
    expect(isInFolder("🚀 Projects old/C.md", "🚀 Projects")).toBe(false);
    expect(isInFolder("Other/D.md", "🚀 Projects/")).toBe(false);
  });

  it("treats an empty folder as the whole vault", () => {
    expect(isInFolder("Any/E.md", "")).toBe(true);
    expect(isInFolder("F.md", "/")).toBe(true);
  });

  it("compares Unicode paths in NFC", () => {
    expect(isInFolder("Projécts/A.md", "Projécts")).toBe(true);
  });
});

describe("parseProjectNote", () => {
  it("ignores notes that are not strategic projects", () => {
    expect(parseProjectNote(input(null))).toBeNull();
    expect(parseProjectNote(input({ type: "meeting" }))).toBeNull();
  });

  it("reads goal, status, rank and next action", () => {
    const parsed = parseProjectNote(
      input({ type: "strategic-project", goal: "career", status: "Backlog", rank: "2" }, "## Next actions\n- [ ] Go", "Tengu"),
    );
    expect(parsed).toEqual({
      path: "🚀 Projects/Tengu.md",
      title: "Tengu",
      status: "backlog",
      rawStatus: "Backlog",
      goalId: "career",
      rank: 2,
      nextAction: "Go",
    });
  });

  it("marks missing or unknown status as null and keeps the raw value", () => {
    expect(parseProjectNote(input({ type: "strategic-project" }))).toMatchObject({ status: null, rawStatus: null });
    expect(parseProjectNote(input({ type: "strategic-project", status: "paused" }))).toMatchObject({
      status: null,
      rawStatus: "paused",
    });
  });

  it("treats a non-numeric rank as missing", () => {
    expect(parseProjectNote(input({ type: "strategic-project", status: "backlog", rank: "soon" }))?.rank).toBeNull();
  });
});

describe("buildProjectsModel", () => {
  it("puts active notes on cards and leaves done and dropped out", () => {
    const model = buildProjectsModel(
      [
        note({ title: "B project" }),
        note({ title: "A project", goalId: "creative" }),
        note({ title: "Finished", status: "done" }),
        note({ title: "Abandoned", status: "dropped" }),
      ],
      goals,
    );
    expect(model.active.map((p) => p.title)).toEqual(["A project", "B project"]);
    expect(model.active[0]!.goal).toEqual({ goalId: "creative", label: "Creative", unknown: false });
    expect(model.backlog).toEqual([]);
    expect(model.overSlotLimit).toBe(false);
    expect(slotLabel(model)).toBe("2 of 3 slots in use");
  });

  it("shows every active project and flags more than three", () => {
    const model = buildProjectsModel(["A", "B", "C", "D"].map((title) => note({ title })), goals);
    expect(model.active).toHaveLength(4);
    expect(model.overSlotLimit).toBe(true);
    expect(slotLabel(model)).toBe("4 of 3 slots in use");
    expect(buildProjectsModel(["A", "B", "C"].map((title) => note({ title })), goals).overSlotLimit).toBe(false);
  });

  it("sorts the backlog by rank, then title, with missing ranks last", () => {
    const model = buildProjectsModel(
      [
        note({ title: "Zebra", status: "backlog", rank: 1 }),
        note({ title: "No rank", status: "backlog", rank: null }),
        note({ title: "Beta", status: "backlog", rank: 2 }),
        note({ title: "Alpha", status: "backlog", rank: 2 }),
        note({ title: "Active one" }),
      ],
      goals,
    );
    expect(model.backlog.map((p) => p.title)).toEqual(["Zebra", "Alpha", "Beta", "No rank"]);
  });

  it("lists notes with missing or unknown status as needing fixes", () => {
    const model = buildProjectsModel(
      [note({ title: "Typo", status: null, rawStatus: "actve" }), note({ title: "Blank", status: null, rawStatus: null })],
      goals,
    );
    expect(model.active).toEqual([]);
    expect(model.malformed).toEqual([
      { path: "🚀 Projects/Blank.md", title: "Blank", problem: "missing status" },
      { path: "🚀 Projects/Typo.md", title: "Typo", problem: 'unknown status "actve"' },
    ]);
    expect(needsFixingLabel(2)).toBe("2 project notes need fixing");
    expect(needsFixingLabel(1)).toBe("1 project note needs fixing");
  });

  it("tags a goal that is missing or not in the config as unknown goal", () => {
    const model = buildProjectsModel(
      [note({ title: "Mystery", goalId: "hobbies" }), note({ title: "No goal", status: "backlog", goalId: null })],
      goals,
    );
    expect(model.active[0]!.goal).toEqual({ goalId: "hobbies", label: "unknown goal", unknown: true });
    expect(model.backlog[0]!.goal).toEqual({ goalId: null, label: "unknown goal", unknown: true });
  });

  it("shows the goal id as written when there is no config", () => {
    const model = buildProjectsModel([note({ title: "P", goalId: "career" })], null);
    expect(model.active[0]!.goal).toEqual({ goalId: "career", label: "career", unknown: false });
  });

  it("keeps a null next action for the 'No next action' case", () => {
    const model = buildProjectsModel([note({ title: "Stalled", nextAction: null })], goals);
    expect(model.active[0]!.nextAction).toBeNull();
  });
});
