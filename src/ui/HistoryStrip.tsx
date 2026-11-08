/**
 * The strip of the last 8 completed weeks on a weekly metric row: filled
 * square = week hit, grey square = week missed. Every square has a text
 * label (title), and the strip has a summary (aria-label, and a visible
 * "N/8 hit" beside it), so colour is never the only cue.
 */
import { formatValue, formatValueOverTarget } from "../core/format";
import type { HistoryWeek } from "../core/history";
import type { TrendWeek } from "../core/trend";

export interface HistoryStripProps {
  weeks: readonly HistoryWeek[];
  unit: string;
}

export function HistoryStrip({ weeks, unit }: HistoryStripProps) {
  if (weeks.length === 0) return null;
  const hits = weeks.filter((w) => w.hit).length;
  const summary = `Last ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}: ${hits} hit, ${weeks.length - hits} missed`;
  return (
    <div class="scoreboard-history-row">
      <ol class="scoreboard-history" aria-label={summary} title={summary}>
        {weeks.map((w) => {
          const verdict = w.hit ? "Hit" : "Missed";
        const label = `Week ${w.week.week}: ${formatValueOverTarget(w.value, w.target, unit)} · ${verdict}`;
          return (
            <li
              key={w.weekKey}
              class={`scoreboard-history__week ${w.hit ? "is-hit" : "is-missed"}`}
              data-week={w.weekKey}
              title={label}
              aria-label={label}
            />
          );
        })}
      </ol>
      {/* The strip's verdicts in words too, so colour is never the only cue (no hover on mobile). */}
      <span class="scoreboard-history__summary" aria-hidden="true">
        {hits}/{weeks.length} hit
      </span>
    </div>
  );
}

export interface TrendStripProps {
  weeks: readonly TrendWeek[];
  unit: string;
}

/**
 * The neutral variant for untargeted metrics: the same 8-week strip with no
 * hit/miss colouring. Each square's label gives the week's value.
 */
export function TrendStrip({ weeks, unit }: TrendStripProps) {
  if (weeks.length === 0) return null;
  const summary = `Last ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}, no target set`;
  return (
    <ol class="scoreboard-history is-neutral" aria-label={summary} title={summary}>
      {weeks.map((w) => {
        const label = `Week ${w.week.week}: ${w.value === null ? "no data" : formatValue(w.value, unit)}`;
        return (
          <li
            key={w.weekKey}
            class={`scoreboard-history__week ${w.value === null ? "is-no-data" : "is-neutral"}`}
            data-week={w.weekKey}
            title={label}
            aria-label={label}
          />
        );
      })}
    </ol>
  );
}
