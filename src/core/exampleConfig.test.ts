import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateConfigText } from "./configValidation";

describe("examples/scoreboard.yaml", () => {
  it("passes full validation with no problems", () => {
    const text = readFileSync(new URL("../../examples/scoreboard.yaml", import.meta.url), "utf8");
    expect(validateConfigText(text).problems).toEqual([]);
  });
});
