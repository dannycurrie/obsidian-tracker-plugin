import { formatScore, type Score } from "../core/score";
import { weekOfYearLabel, type IsoWeek } from "../core/week";

export interface HeaderActions {
  onRefresh?: () => void;
  onEnterValues?: () => void;
  // Later: onExport (ticket 09), onStartCoaching (ticket 10).
}

export interface HeaderProps extends HeaderActions {
  /** Today's ISO week in the config timezone. */
  week: IsoWeek;
  /** "This week" tile; omitted while there is no config. */
  thisWeek?: Score;
  /** "Year to date" tile; omitted while there is no config. */
  yearToDate?: Score;
  // Ticket 07: last-refreshed date.
}

/**
 * Scoreboard header: title, "Week N of 52", score tiles and action buttons.
 * Later tickets add the last-refreshed date (07),
 * Export (09) and Start coaching chat (10).
 */
export function Header({ week, thisWeek, yearToDate, onRefresh, onEnterValues }: HeaderProps) {
  return (
    <header class="scoreboard-header">
      <div class="scoreboard-header__titles">
        <h1 class="scoreboard-header__title">2027 Scoreboard</h1>
        <div class="scoreboard-header__week">{weekOfYearLabel(week)}</div>
      </div>
      <div class="scoreboard-header__tiles">
        {thisWeek && <ScoreTile label="This week" score={thisWeek} caption="weekly targets hit" />}
        {yearToDate && <ScoreTile label="Year to date" score={yearToDate} caption="year targets on pace" />}
      </div>
      <div class="scoreboard-header__actions">
        {onRefresh && (
          <button type="button" onClick={onRefresh}>
            Refresh
          </button>
        )}
        {onEnterValues && (
          <button type="button" class="mod-cta" onClick={onEnterValues}>
            Enter values
          </button>
        )}
      </div>
    </header>
  );
}

export interface ScoreTileProps {
  label: string;
  score: Score;
  /** e.g. "weekly targets hit", "year targets on pace". */
  caption: string;
}

export function ScoreTile({ label, score, caption }: ScoreTileProps) {
  return (
    <div class="scoreboard-tile" aria-label={`${label}: ${score.achieved} of ${score.total} ${caption}`}>
      <div class="scoreboard-tile__label">{label}</div>
      <div class="scoreboard-tile__score">{formatScore(score)}</div>
      <div class="scoreboard-tile__caption">{caption}</div>
    </div>
  );
}
