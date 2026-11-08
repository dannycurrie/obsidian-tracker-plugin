import type { ConfigProblem } from "../core/configLoad";

export interface ConfigBannerProps {
  /** The config file couldn't be read at all. */
  error: string | null;
  problems: readonly ConfigProblem[];
  /** True if the view is showing an earlier valid config. */
  usingLastValid: boolean;
  /** The data file couldn't be read. */
  dataError: string | null;
}

/**
 * Minimal problem banner. Ticket 06 owns the final copy and behaviour
 * (orphaned-history warnings, export blocking).
 */
export function ConfigBanner({ error, problems, usingLastValid, dataError }: ConfigBannerProps) {
  if (!error && problems.length === 0 && !dataError) return null;
  return (
    <div class="scoreboard-banner" role="alert">
      {error && <p class="scoreboard-banner__line">{error}</p>}
      {problems.length > 0 && (
        <>
          <p class="scoreboard-banner__line">
            The config file has {problems.length === 1 ? "a problem" : `${problems.length} problems`}
            {usingLastValid ? "; showing the last valid config." : "."}
          </p>
          <ul class="scoreboard-banner__list">
            {problems.map((p, i) => (
              <li key={i}>
                {p.line !== undefined ? `Line ${p.line}: ` : ""}
                {p.message}
              </li>
            ))}
          </ul>
        </>
      )}
      {dataError && <p class="scoreboard-banner__line">Data file: {dataError} Values can't be saved until it is fixed.</p>}
    </div>
  );
}
