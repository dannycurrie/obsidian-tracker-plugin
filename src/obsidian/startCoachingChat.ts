/**
 * Start coaching chat (ticket 10): copies the review week's coaching context
 * message to the clipboard and opens the ongoing coaching chat on claude.ai.
 * No `obsidian` imports (clipboard and URL opening are injected), so it is
 * unit-tested with fakes; ScoreboardView supplies `navigator.clipboard` and
 * `window.open`, and shows `coachingNotices` as Obsidian notices.
 *
 * Behaviour:
 * - Refuses (copies and opens nothing) with no config or an unreadable data
 *   file: the message would claim every metric missed. An invalid config
 *   doesn't block (only Export is blocked): the message uses the last valid
 *   config and a notice says so.
 * - Opens the saved chat URL if it is a valid http(s) URL. With none saved
 *   (or an invalid one) it opens the claude.ai projects page, since the 2027
 *   Planning project's own URL isn't known, and asks for the chat URL to be
 *   pasted into settings.
 * - If copying fails the chat still opens, and a notice says the context
 *   wasn't copied (so the paste won't be the message) and to try again.
 */
import { configValidationState } from "../core/configStatus";
import { renderCoachingMessage } from "../core/coachingMessage";
import type { ActiveProject } from "../core/projects";
import { buildReviewReport, type ReviewReport } from "../core/report";
import { DEFAULT_SETTINGS } from "../core/settings";
import type { ScoreboardState } from "../core/viewState";
import { calendarDateIn } from "../core/week";

/** Opened when no coaching chat URL is saved (the 2027 Planning project's URL isn't known). */
export const CLAUDE_PROJECTS_URL = "https://claude.ai/projects";

export const COPIED_NOTICE = "Coaching context copied — paste it into the chat.";

export interface CoachingDeps {
  state: ScoreboardState;
  /** Active projects (`buildProjectsModel(...).active`); null if the notes couldn't be read. */
  projects: readonly ActiveProject[] | null;
  /** The only clock read. */
  now: Date;
  /** Coaching chat URL from settings; empty = not set. */
  chatUrl: string;
  /** Coaching prompt template from settings; blank falls back to the default. */
  promptTemplate: string;
  /** Writes text to the clipboard (`navigator.clipboard.writeText`); rejects on failure. */
  copyText: (text: string) => Promise<void>;
  /** Opens a URL outside Obsidian (`window.open`). */
  openUrl: (url: string) => void;
}

export type CoachingOutcome =
  | {
      ok: true;
      report: ReviewReport;
      message: string;
      /** The URL opened. */
      openedUrl: string;
      /** Why the saved chat URL wasn't used: none saved, or not an http(s) URL. */
      chatUrlProblem: "missing" | "invalid" | null;
      /** Set when copying to the clipboard failed. */
      copyError: string | null;
      /** Set when the URL couldn't be opened. */
      openError: string | null;
      /** Set when the message uses the last valid config because the config file has problems. */
      configWarning: string | null;
    }
  | { ok: false; error: string };

/** The saved chat URL if it is an absolute http(s) URL, else why not. */
export function checkChatUrl(raw: string): { url: string } | { problem: "missing" | "invalid" } {
  const trimmed = raw.trim();
  if (trimmed === "") return { problem: "missing" };
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:" ? { url: url.href } : { problem: "invalid" };
  } catch {
    return { problem: "invalid" };
  }
}

export async function startCoachingChat(deps: CoachingDeps): Promise<CoachingOutcome> {
  const { state } = deps;
  if (!state.config) {
    return { ok: false, error: "Can't start the coaching chat: there is no config. Fix the config file, then try again." };
  }
  if (state.dataError) {
    return { ok: false, error: `Can't start the coaching chat: the data file can't be read (${state.dataError}). Fix it first.` };
  }

  const config = state.config;
  let report: ReviewReport;
  let message: string;
  try {
    const today = calendarDateIn(deps.now, config.timezone);
    report = buildReviewReport({ config, data: state.data, today, sources: state.sources, projects: deps.projects ?? [] });
    message = renderCoachingMessage(report, state.data, {
      promptTemplate: deps.promptTemplate.trim() || DEFAULT_SETTINGS.coachingPromptTemplate,
      projectsRead: deps.projects !== null,
    });
  } catch (e) {
    return { ok: false, error: `Couldn't build the coaching context: ${errorMessage(e)}` };
  }

  let copyError: string | null = null;
  try {
    await deps.copyText(message);
  } catch (e) {
    copyError = errorMessage(e);
  }

  const checked = checkChatUrl(deps.chatUrl);
  const openedUrl = "url" in checked ? checked.url : CLAUDE_PROJECTS_URL;
  let openError: string | null = null;
  try {
    deps.openUrl(openedUrl);
  } catch (e) {
    openError = errorMessage(e);
  }

  const validation = configValidationState(state);
  return {
    ok: true,
    report,
    message,
    openedUrl,
    chatUrlProblem: "problem" in checked ? checked.problem : null,
    copyError,
    openError,
    configWarning: validation.blocksActions
      ? "The config file has problems, so the coaching context uses the last valid config."
      : null,
  };
}

/** The notices to show for an outcome, most important first. */
export function coachingNotices(outcome: CoachingOutcome): string[] {
  if (!outcome.ok) return [outcome.error];
  const notices: string[] = [];
  if (outcome.chatUrlProblem === "missing") {
    notices.push(
      "No coaching chat URL is saved, so the claude.ai projects page was opened. Open the coaching chat in the 2027 Planning project and paste its URL into the scoreboard settings (Coaching chat URL).",
    );
  } else if (outcome.chatUrlProblem === "invalid") {
    notices.push(
      "The saved coaching chat URL isn't an http(s) link, so the claude.ai projects page was opened. Paste the chat's full URL (https://claude.ai/chat/…) into the scoreboard settings.",
    );
  }
  if (outcome.openError) notices.push(`Couldn't open ${outcome.openedUrl} (${outcome.openError}).`);
  if (outcome.configWarning) notices.push(outcome.configWarning);
  notices.push(
    outcome.copyError
      ? `Couldn't copy the coaching context to the clipboard (${outcome.copyError}). Click Start coaching chat again to retry.`
      : COPIED_NOTICE,
  );
  return notices;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
