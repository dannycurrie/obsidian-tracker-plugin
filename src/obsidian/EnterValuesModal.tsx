import { Modal, Notice, type App } from "obsidian";
import { render } from "preact";
import { buildEnterValuesFields, enterValuesPatch, savedMessage } from "../core/enterValues";
import { calendarDateIn, isoWeekOf } from "../core/week";
import { EnterValuesForm } from "../ui/EnterValuesForm";
import type { ScoreboardStore } from "./ScoreboardStore";

/**
 * The Enter values form in an Obsidian modal. Fields are built from the
 * store's current config and data for the current ISO week; Save writes all
 * changed values in one data-file update.
 */
export class EnterValuesModal extends Modal {
  constructor(
    app: App,
    private readonly store: ScoreboardStore,
  ) {
    super(app);
  }

  onOpen(): void {
    const { config, data } = this.store.getState();
    this.titleEl.setText("Enter values");
    this.modalEl.addClass("scoreboard-enter-values-modal");
    if (!config) {
      this.contentEl.setText("No config loaded.");
      return;
    }
    // Edge: the only place this flow reads the clock.
    const week = isoWeekOf(calendarDateIn(new Date(), config.timezone));
    const fields = buildEnterValuesFields(config, data, week);

    const onSave = async (inputs: Record<string, string>) => {
      const { patch, errors } = enterValuesPatch(fields, inputs, week, new Date().toISOString());
      if (Object.keys(errors).length > 0) return errors;
      await this.store.updateData(patch);
      new Notice(savedMessage(patch.length));
      this.close();
      return {};
    };

    render(<EnterValuesForm week={week} fields={fields} onSave={onSave} onCancel={() => this.close()} />, this.contentEl);
  }

  onClose(): void {
    render(null, this.contentEl);
    this.contentEl.empty();
  }
}
