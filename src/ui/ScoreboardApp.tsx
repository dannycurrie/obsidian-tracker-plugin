import { DEFAULT_TIMEZONE } from "../core/config";
import { buildScoreboardModel } from "../core/model";
import { isoWeekOf, type CalendarDate } from "../core/week";
import type { ScoreboardState } from "../core/viewState";
import { ConfigBanner } from "./ConfigBanner";
import { GoalCards } from "./GoalCards";
import { Header, type HeaderActions } from "./Header";
import { Projects } from "./Projects";

export interface ScoreboardAppProps extends HeaderActions {
  /** Today in the config timezone (computed at the edge with calendarDateIn). */
  today: CalendarDate;
  state: ScoreboardState;
}

/**
 * Root of the Scoreboard view. Builds the view model from store state and
 * composes the sections top to bottom as in the brief's Screen layout. Each
 * section lives in its own file; add a new section by creating a component
 * and adding one line here.
 */
export function ScoreboardApp({ today, state, onRefresh, onEnterValues }: ScoreboardAppProps) {
  const model = state.config ? buildScoreboardModel(state.config, state.data, today) : null;
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
        onRefresh={onRefresh}
        onEnterValues={state.config ? onEnterValues : undefined}
      />
      <ConfigBanner
        error={state.configError}
        problems={state.configProblems}
        usingLastValid={state.configValid}
        dataError={state.dataError}
      />
      <GoalCards goals={model?.goals ?? null} timeZone={timeZone} emptyMessage={emptyMessage} />
      <Projects />
    </div>
  );
}
