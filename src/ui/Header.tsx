import { weekOfYearLabel, type IsoWeek } from "../core/week";

export interface HeaderProps {
  /** Today's ISO week in Europe/London. */
  week: IsoWeek;
}

/**
 * Scoreboard header. Later tickets add: last-refreshed date, the
 * "This week" and "Year to date" score tiles, the action buttons
 * (Refresh, Enter values, Export to Obsidian, Start coaching chat),
 * the config-problem banner and the "project notes need fixing" line.
 */
export function Header({ week }: HeaderProps) {
  return (
    <header class="scoreboard-header">
      <div class="scoreboard-header__titles">
        <h1 class="scoreboard-header__title">2027 Scoreboard</h1>
        <div class="scoreboard-header__week">{weekOfYearLabel(week)}</div>
      </div>
    </header>
  );
}
