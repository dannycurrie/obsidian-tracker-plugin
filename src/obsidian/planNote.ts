/**
 * Obsidian side of Export to Obsidian (ticket 09): the 2027 Plan note write
 * and the export notices. Only the 2027 Plan note is ever written, and only
 * through `upsertScoreboardEntry` (inside scoreboard markers, or a new block
 * appended at the end).
 */
import { Notice, normalizePath, TFile, type App } from "obsidian";
import type { ExportOutcome } from "./exportReviewWeek";

/**
 * Rewrites the plan note with `fn` in one atomic read-modify-write
 * (`vault.process`). A missing note is an error: the note is Danny's plan,
 * so the export never creates it (fix the path in settings, or create it).
 */
export async function processPlanNote(app: App, path: string, fn: (text: string) => string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(normalizePath(path));
  if (!(file instanceof TFile)) {
    throw new Error(`No note at "${path}". Create the 2027 Plan note, or set its path in the scoreboard settings.`);
  }
  await app.vault.process(file, fn);
}

/** Link text for `path#heading` (path without ".md"). */
export function headingLinkText(path: string, heading: string): string {
  return `${normalizePath(path).replace(/\.md$/i, "")}#${heading}`;
}

/** Shows the outcome of an export: a link to the entry on success, the error otherwise. */
export function showExportNotice(app: App, outcome: ExportOutcome): void {
  if (!outcome.ok) {
    new Notice(outcome.error, 10_000);
    return;
  }
  const week = outcome.report.reviewWeek.week.week;
  const frag = document.createDocumentFragment();
  const line = frag.appendChild(document.createElement("div"));
  line.append(`Week ${week} ${outcome.action === "replaced" ? "updated in" : "exported to"} the 2027 Plan note. `);
  const link = line.appendChild(document.createElement("a"));
  link.textContent = "Open entry";
  link.href = "#";
  link.addEventListener("click", (evt) => {
    evt.preventDefault();
    void app.workspace.openLinkText(headingLinkText(outcome.notePath, outcome.heading), "", false);
  });
  if (outcome.dataError) {
    const warn = frag.appendChild(document.createElement("div"));
    warn.textContent = `But the data file couldn't be updated (${outcome.dataError}), so the week snapshot and export record weren't saved. Export again to retry.`;
  }
  new Notice(frag, outcome.dataError ? 0 : 10_000);
}
