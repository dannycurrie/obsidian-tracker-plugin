/**
 * Strategic projects (see GLOSSARY.md): notes in the projects folder whose
 * frontmatter has `type: strategic-project`. Pure: no Obsidian imports.
 *
 * Pipeline: the Obsidian reader turns each note into a `ProjectNoteInput`
 * (path, title, frontmatter, markdown), `parseProjectNote` keeps the
 * strategic-project ones as `ProjectNote`, and `buildProjectsModel` decides
 * active / backlog / needs fixing against the config's goals. The notes are
 * the source of truth; nothing here is stored or written back.
 */

export const STRATEGIC_PROJECT_TYPE = "strategic-project";
/** Active project slots; more than this turns the slot label orange. */
export const PROJECT_SLOT_LIMIT = 3;
/** Heading whose first unchecked task is the next action. */
export const NEXT_ACTIONS_HEADING = "Next actions";

export type ProjectStatus = "active" | "backlog" | "done" | "dropped";
const PROJECT_STATUSES: readonly ProjectStatus[] = ["active", "backlog", "done", "dropped"];

/** One markdown note as read from the vault. */
export interface ProjectNoteInput {
  /** Vault path, e.g. "🚀 Projects/Career/Tengu launch.md". */
  path: string;
  /** Note title (file basename without extension). */
  title: string;
  /** Parsed frontmatter, or null if the note has none. */
  frontmatter: Record<string, unknown> | null;
  /** Full note text (frontmatter included or not; it is skipped). */
  markdown: string;
}

/** A strategic-project note with its fields read but not yet validated against the config. */
export interface ProjectNote {
  path: string;
  title: string;
  /** Null when `status` is missing or not one of the four statuses. */
  status: ProjectStatus | null;
  /** The `status` value as written, for the "needs fixing" message. */
  rawStatus: string | null;
  /** Goal id from `goal`, or null when missing. */
  goalId: string | null;
  /** Backlog pull order; null when missing or not a number. */
  rank: number | null;
  /** First unchecked task under "Next actions", or null. */
  nextAction: string | null;
}

/** Goal tag shown on a project; `unknown` tags are grey and read "unknown goal". */
export interface ProjectGoalTag {
  goalId: string | null;
  label: string;
  unknown: boolean;
}

export interface ActiveProject {
  path: string;
  title: string;
  goal: ProjectGoalTag;
  /** Null renders as "No next action" (orange: the project is stalled). */
  nextAction: string | null;
}

export interface BacklogProject {
  path: string;
  title: string;
  goal: ProjectGoalTag;
  rank: number | null;
}

export interface MalformedProjectNote {
  path: string;
  title: string;
  /** e.g. 'missing status', 'unknown status "paused"'. */
  problem: string;
}

export interface ProjectsModel {
  /** status: active, sorted by title. All are shown, even past the slot limit. */
  active: ActiveProject[];
  /** status: backlog, in pull order: rank ascending (missing rank last), then title. */
  backlog: BacklogProject[];
  /** Strategic-project notes left out because their status is missing or unknown. */
  malformed: MalformedProjectNote[];
  slotLimit: number;
  /** True when more projects are active than there are slots. */
  overSlotLimit: boolean;
}

/** Minimal goal shape (a `GoalConfig` fits). */
export interface ProjectGoal {
  id: string;
  name: string;
}

/**
 * Whether `path` is inside `folder` (subfolders included). An empty folder or
 * "/" means the whole vault. Compares NFC-normalised, so emoji / accented
 * paths match whatever normal form the file system reports.
 */
export function isInFolder(path: string, folder: string): boolean {
  const f = folder.normalize("NFC").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (f === "") return true;
  return path.normalize("NFC").startsWith(`${f}/`);
}

/** Whether the frontmatter marks a strategic project (`type: strategic-project`). */
export function isStrategicProject(frontmatter: Record<string, unknown> | null | undefined): boolean {
  const type = frontmatter?.["type"];
  return typeof type === "string" && type.trim().toLowerCase() === STRATEGIC_PROJECT_TYPE;
}

/** Reads a note's project fields; null if it isn't a strategic project. */
export function parseProjectNote(input: ProjectNoteInput): ProjectNote | null {
  const fm = input.frontmatter;
  if (!fm || !isStrategicProject(fm)) return null;
  const rawStatus = scalarText(fm["status"]);
  const normalised = rawStatus?.trim().toLowerCase() ?? "";
  const status = (PROJECT_STATUSES as readonly string[]).includes(normalised) ? (normalised as ProjectStatus) : null;
  const goal = scalarText(fm["goal"])?.trim();
  return {
    path: input.path,
    title: input.title,
    status,
    rawStatus,
    goalId: goal ? goal : null,
    rank: parseRank(fm["rank"]),
    nextAction: nextActionFromMarkdown(input.markdown),
  };
}

/**
 * The first unchecked task (`- [ ] …`, also `*` / `+` / numbered) under a
 * "Next actions" heading (any level, case-insensitive), up to the next
 * heading of the same or a higher level. Frontmatter and fenced code blocks
 * are skipped. Returns the task text, trimmed, or null.
 */
export function nextActionFromMarkdown(markdown: string): string | null {
  const lines = stripFrontmatter(markdown).split(/\r?\n/);
  let sectionLevel: number | null = null;
  let fence: string | null = null;
  for (const line of lines) {
    const fenceMatch = /^\s*(```|~~~)/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      if (sectionLevel !== null && level <= sectionLevel) sectionLevel = null;
      if (sectionLevel === null && heading[2]!.trim().toLowerCase() === NEXT_ACTIONS_HEADING.toLowerCase()) {
        sectionLevel = level;
      }
      continue;
    }
    if (sectionLevel === null) continue;
    const task = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[ \]\s+(.*)$/.exec(line);
    if (task) {
      const text = task[1]!.trim();
      if (text !== "") return text;
    }
  }
  return null;
}

/**
 * Sorts strategic-project notes into active cards, backlog and notes that
 * need fixing. `goals` is the config's goal list, or null while there is no
 * config (tags then show the goal id as written).
 */
export function buildProjectsModel(notes: readonly ProjectNote[], goals: readonly ProjectGoal[] | null): ProjectsModel {
  const active: ActiveProject[] = [];
  const backlog: BacklogProject[] = [];
  const malformed: MalformedProjectNote[] = [];
  for (const note of notes) {
    if (note.status === null) {
      malformed.push({
        path: note.path,
        title: note.title,
        problem: note.rawStatus === null || note.rawStatus.trim() === "" ? "missing status" : `unknown status "${note.rawStatus}"`,
      });
      continue;
    }
    const goal = goalTag(note.goalId, goals);
    if (note.status === "active") active.push({ path: note.path, title: note.title, goal, nextAction: note.nextAction });
    else if (note.status === "backlog") backlog.push({ path: note.path, title: note.title, goal, rank: note.rank });
  }
  active.sort((a, b) => compareTitles(a.title, b.title) || compareTitles(a.path, b.path));
  backlog.sort((a, b) => compareRanks(a.rank, b.rank) || compareTitles(a.title, b.title) || compareTitles(a.path, b.path));
  malformed.sort((a, b) => compareTitles(a.title, b.title) || compareTitles(a.path, b.path));
  return { active, backlog, malformed, slotLimit: PROJECT_SLOT_LIMIT, overSlotLimit: active.length > PROJECT_SLOT_LIMIT };
}

/** "N of 3 slots in use". */
export function slotLabel(model: ProjectsModel): string {
  return `${model.active.length} of ${model.slotLimit} slots in use`;
}

/** "1 project note needs fixing" / "N project notes need fixing". */
export function needsFixingLabel(count: number): string {
  return count === 1 ? "1 project note needs fixing" : `${count} project notes need fixing`;
}

function goalTag(goalId: string | null, goals: readonly ProjectGoal[] | null): ProjectGoalTag {
  if (goalId === null) return { goalId, label: "unknown goal", unknown: true };
  if (goals === null) return { goalId, label: goalId, unknown: false };
  const goal = goals.find((g) => g.id === goalId);
  return goal ? { goalId, label: goal.name, unknown: false } : { goalId, label: "unknown goal", unknown: true };
}

function compareRanks(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function parseRank(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stripFrontmatter(markdown: string): string {
  const m = /^﻿?---\r?\n(?:[\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(markdown);
  return m ? markdown.slice(m[0].length) : markdown;
}
