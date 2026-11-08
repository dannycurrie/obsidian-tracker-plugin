import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { emptyScoreboardData } from "../core/data";
import { buildEnterValuesFields } from "../core/enterValues";
import { EnterValuesForm } from "./EnterValuesForm";

const week = { year: 2027, week: 18 };

describe("EnterValuesForm", () => {
  it("renders one field per manual metric, weekly fields blank with a last-week hint", () => {
    const data = emptyScoreboardData();
    data.manual.weekly["music-practice"] = { "2027-W17": { value: 45, enteredAt: "x" } };
    data.manual.latest["eps"] = { value: 1, enteredAt: "x" };
    const fields = buildEnterValuesFields(sampleConfig(), data, week);
    const html = render(<EnterValuesForm week={week} fields={fields} onSave={async () => ({})} onCancel={() => {}} />);
    expect(html.match(/<input/g)).toHaveLength(5);
    expect(html).not.toContain("Meditation");
    expect(html).toContain("last week: 45 min");
    expect(html).toMatch(/id="scoreboard-enter-music-practice"[^>]*value( |="")/);
    expect(html).toMatch(/id="scoreboard-enter-eps"[^>]*value="1"/);
    expect(html).toContain("Leave a field blank to keep it unchanged");
    expect(html).toContain(">Save<");
  });
});
