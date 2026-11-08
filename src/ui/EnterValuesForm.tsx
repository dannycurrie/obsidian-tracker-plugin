import { useState } from "preact/hooks";
import type { EnterValuesField } from "../core/enterValues";
import { weekOfYearLabel, type IsoWeek } from "../core/week";

export interface EnterValuesFormProps {
  week: IsoWeek;
  fields: readonly EnterValuesField[];
  /**
   * Saves all inputs (metricId -> text) in one action. Resolves to per-field
   * errors (empty = saved), or rejects with a message to show.
   */
  onSave: (inputs: Record<string, string>) => Promise<Record<string, string>>;
  onCancel: () => void;
}

/** The Enter values form: one field per manual metric; blank leaves a metric unchanged. */
export function EnterValuesForm({ week, fields, onSave, onCancel }: EnterValuesFormProps) {
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.metricId, f.initial])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      setErrors(await onSave(inputs));
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (fields.length === 0) {
    return <p class="scoreboard-empty">No manual metrics in the config file.</p>;
  }

  return (
    <form class="scoreboard-enter-values" onSubmit={submit}>
      <p class="scoreboard-enter-values__intro">
        {weekOfYearLabel(week)}. Leave a field blank to keep it unchanged.
      </p>
      {fields.map((f) => {
        const id = `scoreboard-enter-${f.metricId}`;
        return (
          <div class="scoreboard-enter-values__field" key={f.metricId}>
            <label for={id}>
              <span class="scoreboard-enter-values__goal">{f.goalName}</span> {f.label}
              {f.unit && <span class="scoreboard-enter-values__unit"> ({f.unit})</span>}
            </label>
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={inputs[f.metricId] ?? ""}
              placeholder={f.mode === "week" ? "this week's total" : undefined}
              onInput={(e) => setInputs({ ...inputs, [f.metricId]: (e.currentTarget as HTMLInputElement).value })}
              aria-invalid={errors[f.metricId] ? true : undefined}
            />
            {f.hint && <div class="scoreboard-enter-values__hint">{f.hint}</div>}
            {errors[f.metricId] && <div class="scoreboard-enter-values__error">{errors[f.metricId]}</div>}
          </div>
        );
      })}
      {formError && <div class="scoreboard-enter-values__error">{formError}</div>}
      <div class="scoreboard-enter-values__buttons">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" class="mod-cta" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
