import { DEFAULT_TIMEZONE } from "../core/config";
import { configValidationState } from "../core/configStatus";
import { buildScoreboardModel } from "../core/model";
import { modelWithSourceStatus, sourceErrorLines } from "../core/sources";
import { isoWeekOf, type CalendarDate } from "../core/week";
import type { ScoreboardState } from "../core/viewState";
import { ConfigBanner } from "./ConfigBanner";
import { GoalCards } from "./GoalCards";
import { Header, type HeaderActions } from "./Header";
import { Projects, ProjectNotesNeedingFix, type OpenNoteHandler } from "./Projects";
import { buildProjectsModel, type ProjectNote } from "../core/projects";

export interface ScoreboardAppProps extends HeaderActions {
  /** Today in the config timezone (computed at the edge with calendarDateIn). */
  today: CalendarDate;
  state: ScoreboardState;
  /** Strategic-project notes (ticket 08); null/omitted until read. */
  projectNotes?: readonly ProjectNote[] | null;
  onOpenNote?: OpenNoteHandler;
}

/**
 * Root of the Scoreboard view. Builds the view model from store state and
 * composes the sections top to bottom as in the brief's Screen layout. Each
 * section lives in its own file; add a new section by creating a component
 * and adding one line here.
 */
export function ScoreboardApp({ today, state, onRefresh, onEnterValues, projectNotes, onOpenNote }: ScoreboardAppProps) {
  const built = state.config ? buildScoreboardModel(state.config, state.data, today) : null;
  // Failed sources: their values show as stale (last good value and its age), never zero.
  const model = built ? modelWithSourceStatus(built, state.sources) : null;
  const projects = projectNotes ? buildProjectsModel(projectNotes, state.config?.goals ?? null) : null;
  const timeZone = state.config?.timezone ?? DEFAULT_TIMEZONE;
  const emptyMessage =
    state.status === "loading"
      ? "Loading…"
      : state.config
        ? undefined
        : "No goals yet. Goals and metrics will appear here once the config file is read.";
  return (
    <div class="scoreboard">
      <Header
        week={model?.week ?? isoWeekOf(today)}
        thisWeek={model?.thisWeek}
        yearToDate={model?.yearToDate}
        onRefresh={onRefresh}
        onEnterValues={state.config ? onEnterValues : undefined}
        refreshedAt={state.loadedAt}
        timeZone={timeZone}
        sourceErrors={sourceErrorLines(state.sources)}
      />
      <ProjectNotesNeedingFix notes={projects?.malformed ?? []} onOpenNote={onOpenNote} />
      <ConfigBanner validation={configValidationState(state)} dataError={state.dataError} />
      <GoalCards goals={model?.goals ?? null} timeZone={timeZone} emptyMessage={emptyMessage} />
      <Projects projects={projects} onOpenNote={onOpenNote} />
    </div>
  );
}
