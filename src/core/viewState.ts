/**
 * The Scoreboard view state the UI renders: config + data as loaded by the
 * store (src/obsidian/ScoreboardStore.ts). Pure types.
 */
import type { ScoreboardConfig } from "./config";
import type { ConfigProblem } from "./configLoad";
import { emptyScoreboardData, type ScoreboardData } from "./data";

export interface ScoreboardState {
  /** "loading" until the first reload() finishes. */
  status: "loading" | "ready";
  /** The config in use: the last valid one, or best-effort if none was valid yet. Null if none could be read. */
  config: ScoreboardConfig | null;
  /** True when `config` passed with no problems. */
  configValid: boolean;
  /** Problems in the config file as it is now (with line numbers). */
  configProblems: ConfigProblem[];
  /** The config file couldn't be read at all (e.g. missing); human-readable. */
  configError: string | null;
  data: ScoreboardData;
  /** The data file couldn't be read; writes are refused until fixed. */
  dataError: string | null;
  /** ISO instant of the last finished reload. */
  loadedAt: string | null;
}

export function initialScoreboardState(): ScoreboardState {
  return {
    status: "loading",
    config: null,
    configValid: false,
    configProblems: [],
    configError: null,
    data: emptyScoreboardData(),
    dataError: null,
    loadedAt: null,
  };
}
