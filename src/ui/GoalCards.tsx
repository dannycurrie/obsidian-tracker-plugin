import { goalBadgeLabel, type BadgeTone } from "../core/goalBadge";
import type { GoalCardModel } from "../core/model";
import { MetricRow } from "./MetricRows";

export interface GoalCardsProps {
  /** Null while there is no config to render. */
  goals: readonly GoalCardModel[] | null;
  timeZone: string;
  /** Shown when there are no goals. */
  emptyMessage?: string;
}

/** Goal cards section: one card per goal in a responsive grid. */
export function GoalCards({ goals, timeZone, emptyMessage }: GoalCardsProps) {
  if (!goals || goals.length === 0) {
    return (
      <section class="scoreboard-section scoreboard-goals" aria-label="Goals">
        <p class="scoreboard-empty">{emptyMessage ?? "No goals yet. Add goals and metrics to the config file."}</p>
      </section>
    );
  }
  return (
    <section class="scoreboard-section scoreboard-goals" aria-label="Goals">
      {goals.map((g) => (
        <GoalCard key={g.goal.id} card={g} timeZone={timeZone} />
      ))}
    </section>
  );
}

/** Badge colour class: blue all on track, orange none on track and some behind, grey otherwise. */
const BADGE_CLASS: Record<BadgeTone, string> = { "on-track": "is-on-track", behind: "is-behind", neutral: "is-neutral" };

export function GoalCard({ card, timeZone }: { card: GoalCardModel; timeZone: string }) {
  const { goal, rows, badge } = card;
  return (
    <article class="scoreboard-goal" data-goal-id={goal.id}>
      <header class="scoreboard-goal__header">
        <h2 class="scoreboard-goal__name">{goal.name}</h2>
        <span class={`scoreboard-goal__badge ${BADGE_CLASS[badge.tone]}`}>{goalBadgeLabel(badge)}</span>
      </header>
      {goal.statement && <p class="scoreboard-goal__statement">{goal.statement}</p>}
      {rows.length > 0 ? (
        <ul class="scoreboard-goal__metrics">
          {rows.map((r) => (
            <MetricRow key={r.metric.id} row={r} timeZone={timeZone} />
          ))}
        </ul>
      ) : (
        <p class="scoreboard-empty">No metrics for this goal.</p>
      )}
    </article>
  );
}
