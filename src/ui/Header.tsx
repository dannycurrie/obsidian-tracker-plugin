import { formatInstant } from "../core/format";
import { formatScore, type Score } from "../core/score";
import { weekOfYearLabel, type IsoWeek } from "../core/week";

export interface HeaderActions {
  onRefresh?: () => void;
  onEnterValues?: () => void;
  /** Export to Obsidian (ticket 09). */
  onExport?: () => void;
  /** Start coaching chat (ticket 10). */
  onStartCoaching?: () => void;
}

export interface HeaderProps extends HeaderActions {
  /** Today's ISO week in the config timezone. */
  week: IsoWeek;
  /** "This week" tile; omitted while there is no config. */
  thisWeek?: Score;
  /** "Year to date" tile; omitted while there is no config. */
  yearToDate?: Score;
  /** ISO instant of the last finished refresh; null before the first. */
  refreshedAt?: string | null;
  /** Timezone for the refreshed time. */
  timeZone?: string;
  /** One line per failing source, e.g. "Tracker: Tracker API error (HTTP 401): …". */
  sourceErrors?: readonly string[];
  /** Export button copy: label ("Export to Obsidian" / "Export week 18" on Mondays) and tooltip. */
  exportCopy?: { label: string; title: string };
  /** Why export is blocked (invalid config, …); shown as the tooltip. Clicking still explains in a notice. */
  exportBlockedReason?: string | null;
  /** Start coaching chat tooltip (which week it covers). */
  coachingTitle?: string;
}

/**
 * Scoreboard header: title, "Week N of 52", score tiles and action buttons.
 * Also the last-refreshed time and any failing source (ticket 07).
 * Export to Obsidian (ticket 09) and Start coaching chat (ticket 10).
 */
export function Header({
  week,
  thisWeek,
  yearToDate,
  onRefresh,
  onEnterValues,
  refreshedAt,
  timeZone,
  sourceErrors,
  onExport,
  exportCopy,
  exportBlockedReason,
  onStartCoaching,
  coachingTitle,
}: HeaderProps) {
  const refreshed = refreshedAt && timeZone ? formatInstant(refreshedAt, timeZone) : null;
  return (
    <header class="scoreboard-header">
      <div class="scoreboard-header__titles">
        <h1 class="scoreboard-header__title">2027 Scoreboard</h1>
        <div class="scoreboard-header__week">{weekOfYearLabel(week)}</div>
        {refreshed && <div class="scoreboard-header__refreshed">Refreshed {refreshed}</div>}
        {sourceErrors?.map((e, i) => (
          <div key={i} class="scoreboard-header__source-error" role="status">
            {e} Showing the last good values, marked stale.
          </div>
        ))}
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
        {onExport && (
          <button
            type="button"
            class="scoreboard-header__export"
            aria-disabled={exportBlockedReason ? "true" : undefined}
            title={exportBlockedReason ? `Export is blocked: ${exportBlockedReason}` : exportCopy?.title}
            onClick={onExport}
          >
            {exportCopy?.label ?? "Export to Obsidian"}
          </button>
        )}
        {onStartCoaching && (
          <button type="button" class="scoreboard-header__coaching" title={coachingTitle} onClick={onStartCoaching}>
            Start coaching chat
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
