import { countProblems, type ConfigValidationState, type OrphanedHistory } from "../core/configStatus";

export interface ConfigBannerProps {
  /** From `configValidationState(state)`. */
  validation: ConfigValidationState;
  /** The data file couldn't be read. */
  dataError: string | null;
}

/**
 * Config problems banner (brief › Data model › Config validation): lists each
 * problem with its line number, says whether the last valid config is in use
 * and that export is blocked, and warns about history for metric ids no
 * longer in the config. Also shows a data file read error.
 */
export function ConfigBanner({ validation, dataError }: ConfigBannerProps) {
  const { status, problems, error, usingLastValid, orphanedHistory } = validation;
  const broken = status === "invalid" || status === "unreadable";
  const fallback = usingLastValid
    ? " The scoreboard is showing the last valid config until it is fixed; export is blocked."
    : " Export is blocked until it is fixed.";
  return (
    <>
      {(broken || dataError) && (
        <div class="scoreboard-banner" role="alert">
          {error && (
            <p class="scoreboard-banner__line">
              {error}
              {fallback}
            </p>
          )}
          {!error && problems.length > 0 && (
            <p class="scoreboard-banner__line">
              The config file has {countProblems(problems.length)}.{fallback}
            </p>
          )}
          {problems.length > 0 && (
            <ul class="scoreboard-banner__list">
              {problems.map((p, i) => (
                <li key={i}>
                  {p.line !== undefined ? `Line ${p.line}: ` : ""}
                  {p.message}
                </li>
              ))}
            </ul>
          )}
          {dataError && (
            <p class="scoreboard-banner__line">Data file: {dataError} Values can't be saved until it is fixed.</p>
          )}
        </div>
      )}
      {orphanedHistory.length > 0 && <OrphanedHistoryWarning orphans={orphanedHistory} />}
    </>
  );
}

function OrphanedHistoryWarning({ orphans }: { orphans: readonly OrphanedHistory[] }) {
  return (
    <div class="scoreboard-banner scoreboard-banner--warning" role="status">
      <p class="scoreboard-banner__line">
        The data file has history for {orphans.length === 1 ? "a metric id" : `${orphans.length} metric ids`} not in the
        config. Metric ids can't be renamed (changing a label is safe): put the old id back to see its history.
      </p>
      <ul class="scoreboard-banner__list">
        {orphans.map((o) => (
          <li key={o.metricId}>
            {o.metricId}: {describeOrphan(o)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function describeOrphan(o: OrphanedHistory): string {
  const parts: string[] = [];
  if (o.weeklyEntries > 0) parts.push(`${o.weeklyEntries} weekly ${o.weeklyEntries === 1 ? "entry" : "entries"}`);
  if (o.latestValue) parts.push("a latest value");
  if (o.snapshots > 0) parts.push(`${o.snapshots} week ${o.snapshots === 1 ? "snapshot" : "snapshots"}`);
  return parts.join(", ");
}
