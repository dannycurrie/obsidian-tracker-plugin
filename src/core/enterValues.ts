/**
 * Enter values form logic (brief › Manual entry). Pure.
 *
 * - Lists only manual metrics, in config order.
 * - Per-week fields (weekly metrics, weekly-cadence untargeted) start blank,
 *   with last week's value as a hint; the entry replaces this week's entry.
 * - Latest-value fields (year metrics, ad-hoc untargeted) start pre-filled
 *   with the latest value; the entry replaces it (the 2027 running total).
 * - A blank field leaves that metric unchanged, and so does re-entering the
 *   value already stored. Everything is saved as one patch (one write).
 */
import { isEnteredPerWeek, manualMetrics, type MetricKind, type ScoreboardConfig } from "./config";
import { setManualLatestEntry, setManualWeeklyEntry, type DataPatchOp, type ScoreboardData } from "./data";
import { formatNumber, formatValue, NO_VALUE } from "./format";
import { manualLatestValue, manualWeekValue } from "./values";
import { addWeeks, isoWeekKey, type IsoWeek } from "./week";

export interface EnterValuesField {
  metricId: string;
  label: string;
  goalName: string;
  kind: MetricKind;
  unit: string;
  /** "week": one entry per ISO week. "latest": one value replacing the previous one. */
  mode: "week" | "latest";
  /** Initial input text: blank for per-week fields, the latest value for latest fields. */
  initial: string;
  /** Helper text under the field, e.g. "last week: 40 min". */
  hint: string;
  /** The value already stored in the slot this field writes (this week's entry, or the latest). */
  stored: number | null;
}

/** The form's fields for the week being entered (normally the current ISO week). */
export function buildEnterValuesFields(
  config: ScoreboardConfig,
  data: ScoreboardData,
  week: IsoWeek,
): EnterValuesField[] {
  const goalName = new Map(config.goals.map((g) => [g.id, g.name]));
  const weekKey = isoWeekKey(week);
  const lastWeekKey = isoWeekKey(addWeeks(week, -1));
  return manualMetrics(config).map((m) => {
    const base = { metricId: m.id, label: m.label, goalName: goalName.get(m.goalId) ?? m.goalId, kind: m.kind, unit: m.unit };
    if (isEnteredPerWeek(m)) {
      const lastWeek = manualWeekValue(data, m.id, lastWeekKey);
      const thisWeek = manualWeekValue(data, m.id, weekKey);
      const hint = [
        `last week: ${lastWeek ? formatValue(lastWeek.value, m.unit) : NO_VALUE}`,
        ...(thisWeek ? [`entered this week: ${formatValue(thisWeek.value, m.unit)}`] : []),
      ].join(" · ");
      return { ...base, mode: "week" as const, initial: "", hint, stored: thisWeek?.value ?? null };
    }
    const latest = manualLatestValue(data, m.id);
    return {
      ...base,
      mode: "latest" as const,
      initial: latest ? String(latest.value) : "",
      hint: m.kind === "year" ? "2027 running total so far" : "",
      stored: latest?.value ?? null,
    };
  });
}

export type ParsedInput = { kind: "blank" } | { kind: "number"; value: number } | { kind: "invalid" };

/** Parses a typed value. Accepts "1,200", "£1200", "40%", "70 min"-free numbers; blank means unchanged. */
export function parseEnteredNumber(text: string): ParsedInput {
  const cleaned = text.trim().replace(/[£$€%,\s]/g, "");
  if (cleaned === "") return { kind: "blank" };
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return { kind: "invalid" };
  return { kind: "number", value: Number(cleaned) };
}

export interface EnterValuesResult {
  /** One op per changed field. Empty means nothing to save. */
  patch: DataPatchOp[];
  /** metricId -> error message for fields that aren't numbers. Save nothing if non-empty. */
  errors: Record<string, string>;
}

/** Turns the submitted inputs (metricId -> text) into a data patch. */
export function enterValuesPatch(
  fields: readonly EnterValuesField[],
  inputs: Readonly<Record<string, string>>,
  week: IsoWeek,
  enteredAt: string,
): EnterValuesResult {
  const patch: DataPatchOp[] = [];
  const errors: Record<string, string> = {};
  const weekKey = isoWeekKey(week);
  for (const field of fields) {
    const parsed = parseEnteredNumber(inputs[field.metricId] ?? "");
    if (parsed.kind === "blank") continue;
    if (parsed.kind === "invalid") {
      errors[field.metricId] = "Enter a number, or leave blank to keep it unchanged.";
      continue;
    }
    if (parsed.value === field.stored) continue;
    const entry = { value: parsed.value, enteredAt };
    patch.push(
      field.mode === "week" ? setManualWeeklyEntry(field.metricId, weekKey, entry) : setManualLatestEntry(field.metricId, entry),
    );
  }
  return { patch, errors };
}

/** Notice copy after saving. */
export function savedMessage(changedCount: number): string {
  if (changedCount === 0) return "No values changed.";
  return `Saved ${formatNumber(changedCount)} value${changedCount === 1 ? "" : "s"}.`;
}
