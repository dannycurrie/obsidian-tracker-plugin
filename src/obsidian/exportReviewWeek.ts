/**
 * Export to Obsidian (ticket 09): writes the review week's scoreboard entry
 * into the 2027 Plan note, then that week's snapshot and an export record
 * into the data file. No `obsidian` imports (the note write is injected), so
 * it is unit-tested with fakes; `planNote.ts` supplies the vault side.
 *
 * Order, so that a failure writes nothing:
 * 1. Refuse while the config is invalid, the data file is unreadable, or
 *    the project notes couldn't be read.
 * 2. Compute everything first: report, entry text, data patch.
 * 3. Write the note (one atomic read-modify-write; a missing note or broken
 *    markers fail here, before anything is written).
 * 4. Write the data file. The two files can't be written atomically
 *    together: if this last step fails, the entry is already in the note,
 *    and the outcome says so (`dataError`) so the notice can ask for a
 *    re-export, which replaces the entry and retries the data write.
 */
import { configValidationState } from "../core/configStatus";
import type { DataPatch } from "../core/data";
import { setExportRecord } from "../core/data";
import type { ActiveProject } from "../core/projects";
import { buildReviewReport, exportRecordOf, type ReportProject, type ReviewReport } from "../core/report";
import { entryHeading, renderScoreboardEntry, upsertScoreboardEntry } from "../core/scoreboardEntry";
import { snapshotRefreshPatch } from "../core/snapshots";
import type { ScoreboardState } from "../core/viewState";
import { calendarDateIn } from "../core/week";

export interface ExportDeps {
  state: ScoreboardState;
  /** Active projects (`buildProjectsModel(...).active`); null if the notes couldn't be read. */
  projects: readonly ActiveProject[] | null;
  /** The export instant (the only clock read). */
  now: Date;
  planNotePath: string;
  /** Rewrites the note atomically with `fn`; throws (writing nothing) if the note is missing or `fn` throws. */
  processNote: (path: string, fn: (text: string) => string) => Promise<void>;
  /** Writes a patch to the data file (`ScoreboardStore.updateData`). */
  updateData: (patch: DataPatch) => Promise<unknown>;
  /** Wikilink text for a project note; default its title. */
  linkText?: (project: ReportProject) => string;
}

export type ExportOutcome =
  | {
      ok: true;
      report: ReviewReport;
      notePath: string;
      /** Heading of the entry, for a `path#heading` link. */
      heading: string;
      action: "replaced" | "appended";
      /** Set when the entry was written but the data file write failed. */
      dataError: string | null;
    }
  | { ok: false; error: string };

export async function exportReviewWeek(deps: ExportDeps): Promise<ExportOutcome> {
  const { state } = deps;
  const validation = configValidationState(state);
  if (validation.blocksActions || !state.config) {
    return { ok: false, error: `Export is blocked. ${validation.blockedReason ?? "There is no config."}` };
  }
  if (state.dataError) {
    return { ok: false, error: `Export is blocked: the data file can't be read (${state.dataError}). Fix it first.` };
  }
  if (!deps.projects) {
    return { ok: false, error: "Export is blocked: the project notes couldn't be read. Try Refresh, then export again." };
  }

  const config = state.config;
  const exportedAt = deps.now.toISOString();
  let report: ReviewReport;
  let entry: string;
  let patch: DataPatch;
  try {
    const today = calendarDateIn(deps.now, config.timezone);
    report = buildReviewReport({ config, data: state.data, today, sources: state.sources, projects: deps.projects });
    entry = renderScoreboardEntry(report, { exportedAt, timeZone: config.timezone, linkText: deps.linkText });
    patch = [
      ...snapshotRefreshPatch(config, state.data, today, exportedAt),
      setExportRecord(report.reviewWeek.key, exportRecordOf(report, exportedAt)),
    ];
  } catch (e) {
    return { ok: false, error: `Export failed: ${message(e)}` };
  }

  let action: "replaced" | "appended" = "appended";
  try {
    await deps.processNote(deps.planNotePath, (text) => {
      const result = upsertScoreboardEntry(text, report.reviewWeek.key, entry);
      action = result.action;
      return result.text;
    });
  } catch (e) {
    return { ok: false, error: `Export failed, nothing was written: ${message(e)}` };
  }

  let dataError: string | null = null;
  try {
    await deps.updateData(patch);
  } catch (e) {
    dataError = message(e);
  }
  return { ok: true, report, notePath: deps.planNotePath, heading: entryHeading(report), action, dataError };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
