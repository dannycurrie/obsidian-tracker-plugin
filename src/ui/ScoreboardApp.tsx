import type { IsoWeek } from "../core/week";
import { GoalCards } from "./GoalCards";
import { Header } from "./Header";
import { Projects } from "./Projects";

export interface ScoreboardAppProps {
  /** Today's ISO week in Europe/London. */
  week: IsoWeek;
}

/**
 * Root of the Scoreboard view. Composes the sections top to bottom as in
 * the brief's Screen layout. Each section lives in its own file; add a new
 * section by creating a component and adding one line here.
 */
export function ScoreboardApp({ week }: ScoreboardAppProps) {
  return (
    <div class="scoreboard">
      <Header week={week} />
      <GoalCards />
      <Projects />
    </div>
  );
}
