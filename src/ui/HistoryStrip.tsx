/**
 * The strip of the last 8 completed weeks on a weekly metric row: filled
 * square = week hit, grey square = week missed. Every square has a text
 * label (title) and the strip has a summary, so colour is never the only cue.
 */
import { formatValueOverTarget } from "../core/format";
import type { HistoryWeek } from "../core/history";

export interface HistoryStripProps {
  weeks: readonly HistoryWeek[];
  unit: string;
}

export function HistoryStrip({ weeks, unit }: HistoryStripProps) {
  if (weeks.length === 0) return null;
  const hits = weeks.filter((w) => w.hit).length;
  const summary = `Last ${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}: ${hits} hit, ${weeks.length - hits} missed`;
  return (
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
  );
}
