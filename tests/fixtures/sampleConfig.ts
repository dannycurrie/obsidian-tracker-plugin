/** Test helpers for the sample config fixture. Test-only (uses node:fs). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ScoreboardConfig } from "../../src/core/config";
import { loadConfigFromYaml } from "../../src/core/configLoad";

const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

/** Text of tests/fixtures/sample-config.yaml. */
export const sampleConfigText: string = readFileSync(here("./sample-config.yaml"), "utf8");

/** Text of examples/scoreboard.yaml (the full 11-metric dev sample). */
export const exampleConfigText: string = readFileSync(here("../../examples/scoreboard.yaml"), "utf8");

/** The parsed sample config; throws if it has any problem. */
export function sampleConfig(): ScoreboardConfig {
  const { config, problems } = loadConfigFromYaml(sampleConfigText);
  if (!config || problems.length > 0) throw new Error(`sample config invalid: ${JSON.stringify(problems)}`);
  return config;
}
