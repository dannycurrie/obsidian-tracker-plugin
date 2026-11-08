/**
 * "stale · 3 h old" after a value whose source failed on the last refresh
 * (brief › Rules). The value shown is the last good one, never zero; the
 * hover text on the value gives the error and the last fetch time.
 */
import { staleAgeLabel } from "../core/sources";
import type { MetricValue } from "../core/values";

export function StaleBadge({ value }: { value: MetricValue | null }) {
  if (!value?.stale) return null;
  return <span class="scoreboard-stale"> stale · {staleAgeLabel(value)}</span>;
}
