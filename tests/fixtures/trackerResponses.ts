/**
 * Tracker Metrics API response fixtures, in the shape documented in
 * dannycurrie/tracker `server/README.md` and `prds/008-metrics-api.md`
 * (granularity=day; USER_TZ Europe/London). Bucket bounds are written out
 * literally with their offsets, including the DST days, so the plugin's own
 * date code isn't used to build its test inputs.
 *
 * Not recorded from the live API (no key available to the build); shapes
 * follow the docs field for field.
 */

export interface DayBucket {
  start: string;
  end: string;
  partial: boolean;
  entryCount: number;
  value: number | null;
}

/** A day bucket: local midnight `date` (offset `off`) to the next local midnight (offset `offEnd`). */
export function day(date: string, value: number | null, entryCount: number, off = "+01:00", offEnd = off): DayBucket {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  return { start: `${date}T00:00:00${off}`, end: `${nextDate}T00:00:00${offEnd}`, partial: false, entryCount, value };
}

/** Clocks go back on Sunday 25 Oct 2026 (25 h day): 2026-W43 is Mon 19 – Sun 25 Oct. */
export const clocksBackWeek: DayBucket[] = [
  day("2026-10-19", 10, 1),
  day("2026-10-20", 0, 0),
  day("2026-10-21", 15, 1),
  day("2026-10-22", 0, 0),
  day("2026-10-23", 20, 2),
  day("2026-10-24", 0, 0),
  // 25 h: 00:00+01:00 → next midnight +00:00. Entries late on Sunday belong to W43.
  day("2026-10-25", 30, 2, "+01:00", "+00:00"),
];

/** Monday 26 Oct 2026, the first day of 2026-W44 (GMT). */
export const mondayAfterClocksBack: DayBucket = day("2026-10-26", 5, 1, "+00:00");

/** Clocks go forward on Sunday 28 Mar 2027 (23 h day): 2027-W12 is Mon 22 – Sun 28 Mar. */
export const clocksForwardWeek: DayBucket[] = [
  day("2027-03-22", 20, 1, "+00:00"),
  day("2027-03-23", 0, 0, "+00:00"),
  day("2027-03-24", 0, 0, "+00:00"),
  day("2027-03-25", 25, 1, "+00:00"),
  day("2027-03-26", 0, 0, "+00:00"),
  day("2027-03-27", 0, 0, "+00:00"),
  // 23 h: 00:00+00:00 → next midnight +01:00.
  day("2027-03-28", 40, 3, "+00:00", "+01:00"),
];

/** Days of one ISO week starting Monday `monday` (all in the same offset), one value per day. */
export function week(monday: string, values: readonly number[], off = "+01:00"): DayBucket[] {
  const out: DayBucket[] = [];
  const d = new Date(`${monday}T12:00:00Z`);
  for (const v of values) {
    out.push(day(d.toISOString().slice(0, 10), v, v > 0 ? 1 : 0, off));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const MEDITATION_ID = "00000000-0000-0000-0000-000000000001";
export const READING_ID = "00000000-0000-0000-0000-0000000000aa";

/** A 200 body around the given metrics (the API's top-level fields). */
export function okBody(
  metrics: { id: string; name: string; type?: string; periods: unknown[] }[],
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    from: "2027-03-08T00:00:00Z",
    to: "2027-05-10T00:00:00+01:00",
    timezone: "Europe/London",
    granularity: "day",
    metrics: metrics.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type ?? "timed",
      timeframe: "weekly",
      source: "user",
      unit: m.type === "cumulative" ? null : "minutes",
      periods: m.periods,
    })),
    ...extra,
  });
}

/** Error bodies as documented: `{ error: { code, message } }`. */
export const errorBodies = {
  unauthorized: JSON.stringify({ error: { code: "unauthorized", message: "Missing or invalid API key" } }),
  rangeTooLarge: JSON.stringify({ error: { code: "range_too_large", message: "The range can be at most 2 years" } }),
  internal: JSON.stringify({ error: { code: "internal_error", message: "Something went wrong" } }),
  misconfigured: JSON.stringify({ error: { code: "server_misconfigured", message: "Server is missing configuration" } }),
};
