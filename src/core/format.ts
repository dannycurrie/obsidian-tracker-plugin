/** Number and unit formatting for UI copy. Pure. */

const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });

/** Units written before the number ("£4,300"); every other unit goes after it. */
const PREFIX_UNITS = new Set(["£", "$", "€"]);
/** Units written straight after the number with no space ("40%"). */
const TIGHT_SUFFIX_UNITS = new Set(["%"]);

/** Formats a plain number: thousands separators, at most 2 decimals. */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** Formats a value with its unit: "£4,300", "40%", "70 min", "12". */
export function formatValue(n: number, unit: string): string {
  const num = formatNumber(n);
  if (!unit) return num;
  if (PREFIX_UNITS.has(unit)) return n < 0 ? `-${unit}${formatNumber(-n)}` : `${unit}${num}`;
  if (TIGHT_SUFFIX_UNITS.has(unit)) return `${num}${unit}`;
  return `${num} ${unit}`;
}

/** Shown in place of a value when there is no data. */
export const NO_VALUE = "–";

/**
 * "value / target" copy: "70 / 100 min", "£4,300 / £12,000", "– / 60 min".
 * Prefix units appear on both sides, suffix units only after the target.
 */
export function formatValueOverTarget(value: number | null, target: number, unit: string): string {
  const left = value === null ? NO_VALUE : PREFIX_UNITS.has(unit) ? formatValue(value, unit) : formatNumber(value);
  return `${left} / ${formatValue(target, unit)}`;
}

/**
 * Hover text for a value: its source and when it was entered/fetched,
 * e.g. "Manual entry · 5 May 2027, 11:00", "Tracker · fetched 5 May 2027,
 * 11:00". A stale value (its source failed on the last refresh) says so,
 * with the error: "Tracker · last fetched … · stale: <error>".
 */
export function valueSourceTitle(
  value: { source: "manual" | "tracker"; at: string; stale?: { error: string } },
  timeZone: string,
): string {
  const label = value.source === "manual" ? "Manual entry" : "Tracker";
  const when = formatInstant(value.at, timeZone);
  const stale = value.stale ? ` · stale: ${value.stale.error}` : "";
  if (when === null) return label + stale;
  if (value.source === "manual") return `${label} · ${when}${stale}`;
  return `${label} · ${value.stale ? "last fetched" : "fetched"} ${when}${stale}`;
}

/** An ISO instant as "5 May 2027, 11:00" in `timeZone`; null if unparseable. */
export function formatInstant(iso: string, timeZone: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}
