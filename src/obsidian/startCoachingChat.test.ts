import { describe, expect, it } from "vitest";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "../core/data";
import type { ActiveProject } from "../core/projects";
import { DEFAULT_SETTINGS } from "../core/settings";
import { initialScoreboardState, type ScoreboardState } from "../core/viewState";
import {
  checkChatUrl,
  CLAUDE_PROJECTS_URL,
  coachingNotices,
  COPIED_NOTICE,
  startCoachingChat,
  type CoachingDeps,
} from "./startCoachingChat";

const at = "2027-05-05T10:00:00Z";
// Sunday 9 May 2027 18:40 BST (2027-W18 still running).
const sundayEvening = new Date("2027-05-09T17:40:00Z");
const CHAT = "https://claude.ai/chat/0000-1111";

const projects: ActiveProject[] = [
  { path: "🚀 Projects/Tengu launch.md", title: "Tengu launch", goal: { goalId: "career", label: "Career", unknown: false }, nextAction: "Email the beta list" },
];

function readyState(overrides: Partial<ScoreboardState> = {}): ScoreboardState {
  const data = emptyScoreboardData();
  data.manual.weekly["music-practice"] = { "2027-W18": { value: 40, enteredAt: at } };
  return { ...initialScoreboardState(), status: "ready", config: sampleConfig(), configValid: true, data, ...overrides };
}

function setup(overrides: Partial<CoachingDeps> = {}) {
  const copied: string[] = [];
  const opened: string[] = [];
  const deps: CoachingDeps = {
    state: readyState(),
    projects,
    now: sundayEvening,
    chatUrl: CHAT,
    promptTemplate: "Coach me on this week.",
    copyText: async (text) => {
      copied.push(text);
    },
    openUrl: (url) => {
      opened.push(url);
    },
    ...overrides,
  };
  return { deps, copied, opened };
}

describe("startCoachingChat", () => {
  it("copies the review week's context message and opens the saved chat URL", async () => {
    const { deps, copied, opened } = setup();
    const outcome = await startCoachingChat(deps);
    expect(outcome).toMatchObject({ ok: true, openedUrl: CHAT, chatUrlProblem: null, copyError: null, configWarning: null });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(/^Weekly scoreboard check-in — Week 18 of 52 \(3–9 May 2027\)\n/);
    expect(copied[0]).toContain("- Creative · Music practice, playing, recording: 40 / 60 min (20 to go)");
    expect(copied[0]).toContain("- Tengu launch — Email the beta list");
    expect(copied[0]!.endsWith("\n\nCoach me on this week.")).toBe(true);
    expect(opened).toEqual([CHAT]);
    expect(coachingNotices(outcome)).toEqual([COPIED_NOTICE]);
    expect(COPIED_NOTICE).toBe("Coaching context copied — paste it into the chat.");
  });

  it("starts the copy and opens the URL synchronously, inside the click's user gesture", async () => {
    // Mobile WebViews drop clipboard writes and popups once an await has
    // passed, so both calls must happen before startCoachingChat yields.
    const calls: string[] = [];
    let finishCopy!: () => void;
    const { deps } = setup({
      copyText: (text) => {
        calls.push(`copy:${text.slice(0, 26)}`);
        return new Promise<void>((resolve) => (finishCopy = resolve));
      },
      openUrl: (url) => {
        calls.push(`open:${url}`);
      },
    });
    const pending = startCoachingChat(deps);
    expect(calls).toEqual(["copy:Weekly scoreboard check-in", `open:${CHAT}`]);
    finishCopy();
    expect(await pending).toMatchObject({ ok: true, copyError: null });
  });

  it("reports a copy function that throws synchronously as a copy error, still opening the chat", async () => {
    const { deps, opened } = setup({
      copyText: () => {
        throw new Error("the clipboard isn't available");
      },
    });
    const outcome = await startCoachingChat(deps);
    expect(outcome).toMatchObject({ ok: true, copyError: "the clipboard isn't available" });
    expect(opened).toEqual([CHAT]);
  });

  it("with no saved URL opens the claude.ai projects page and asks for the chat URL in settings", async () => {
    const { deps, copied, opened } = setup({ chatUrl: "  " });
    const outcome = await startCoachingChat(deps);
    expect(outcome).toMatchObject({ ok: true, openedUrl: CLAUDE_PROJECTS_URL, chatUrlProblem: "missing" });
    expect(opened).toEqual([CLAUDE_PROJECTS_URL]);
    expect(copied).toHaveLength(1);
    const notices = coachingNotices(outcome);
    expect(notices[0]).toMatch(/No coaching chat URL is saved.*paste its URL into the scoreboard settings/);
    expect(notices.at(-1)).toBe(COPIED_NOTICE);
  });

  it("treats a saved URL that isn't http(s) like a missing one, saying it is invalid", async () => {
    for (const bad of ["claude.ai/chat/123", "javascript:alert(1)", "obsidian://open?vault=x"]) {
      const { deps, opened } = setup({ chatUrl: bad });
      const outcome = await startCoachingChat(deps);
      expect(outcome).toMatchObject({ ok: true, chatUrlProblem: "invalid" });
      expect(opened).toEqual([CLAUDE_PROJECTS_URL]);
      expect(coachingNotices(outcome)[0]).toContain("isn't an http(s) link");
    }
  });

  it("still opens the chat when copying fails, and says the context wasn't copied", async () => {
    const { deps, opened } = setup({ copyText: async () => Promise.reject(new Error("Document is not focused")) });
    const outcome = await startCoachingChat(deps);
    expect(outcome).toMatchObject({ ok: true, copyError: "Document is not focused" });
    expect(opened).toEqual([CHAT]);
    const notices = coachingNotices(outcome);
    expect(notices).not.toContain(COPIED_NOTICE);
    expect(notices.at(-1)).toMatch(/^Couldn't copy the coaching context to the clipboard \(Document is not focused\)/);
  });

  it("uses the default prompt template when the setting is blank", async () => {
    const { deps, copied } = setup({ promptTemplate: "" });
    await startCoachingChat(deps);
    expect(copied[0]!.endsWith(`\n\n${DEFAULT_SETTINGS.coachingPromptTemplate}`)).toBe(true);
  });

  it("refuses with no config or an unreadable data file, copying and opening nothing", async () => {
    for (const state of [readyState({ config: null }), readyState({ dataError: "not JSON" })]) {
      const { deps, copied, opened } = setup({ state });
      const outcome = await startCoachingChat(deps);
      expect(outcome).toMatchObject({ ok: false, error: expect.stringMatching(/^Can't start the coaching chat/) });
      expect(coachingNotices(outcome)).toEqual([(outcome as { error: string }).error]);
      expect(copied).toEqual([]);
      expect(opened).toEqual([]);
    }
  });

  it("isn't blocked by an invalid config but warns that the last valid config is used", async () => {
    const { deps, opened } = setup({ state: readyState({ configProblems: [{ message: "bad", line: 3 }] }) });
    const outcome = await startCoachingChat(deps);
    expect(outcome).toMatchObject({ ok: true, configWarning: expect.stringContaining("last valid config") });
    expect(opened).toEqual([CHAT]);
  });

  it("says so in the message when the project notes couldn't be read", async () => {
    const { deps, copied } = setup({ projects: null });
    await startCoachingChat(deps);
    expect(copied[0]).toContain("Active projects: couldn't read the project notes");
  });
});

describe("checkChatUrl", () => {
  it("accepts absolute http(s) URLs only", () => {
    expect(checkChatUrl(` ${CHAT} `)).toEqual({ url: CHAT });
    expect(checkChatUrl("http://example.com/x")).toEqual({ url: "http://example.com/x" });
    expect(checkChatUrl("")).toEqual({ problem: "missing" });
    expect(checkChatUrl("ftp://claude.ai")).toEqual({ problem: "invalid" });
    expect(checkChatUrl("not a url")).toEqual({ problem: "invalid" });
  });
});
