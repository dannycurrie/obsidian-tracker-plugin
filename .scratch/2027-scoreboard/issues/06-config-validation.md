# 06: Config validation

**What to build:** When Danny breaks the config file (YAML error, unknown curve type, missing target, unknown metric kind…), the view keeps working from the last valid config and shows a banner listing each problem with its line number. If the data file holds history for a metric id no longer in the config, the view warns about it (renaming ids is not supported in v1; changing labels is safe).

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** done

- [x] An invalid config shows a banner with each problem and its line number
- [x] The view keeps rendering from the last valid config while the current one is invalid
- [x] Fixing the config and refreshing clears the banner and applies the new config
- [x] Orphaned history (data for an id not in config) produces a warning
- [x] Validation is a pure function with unit tests for each error type
- [x] A validation state is exposed so later features (export) can refuse to run while the config is invalid

## Notes

- `src/core/configValidation.ts`: `validateConfigText(text)` (the store's default loader) = the lenient reader in `configLoad.ts` plus `checkConfigRules`: unknown fields (typos), pace tolerance in (0, 1], target > 0, fields that don't apply to the kind, plan baseline, milestones (real dates, within the config year, strictly in order, at least one step), manual cadence, tracker aggregate, `weekStart`, IANA `timezone`. Problems are sorted by line. New config fields must be added to the `*_KEYS` lists or they are reported as unknown.
- `src/core/configStatus.ts`: `configValidationState(state)` → `{ status: loading | valid | invalid | unreadable, problems, usingLastValid, blocksActions, blockedReason, orphanedHistory }`. Ticket 09 (export) refuses to run while `blocksActions` and shows `blockedReason`. `findOrphanedHistory` checks `manual.weekly`, `manual.latest` and `snapshots`; only computed against a valid config.
- Ticket 07 hook: `store.setSourceProblems(adapterId, SourceProblem[])` with `{ metricId, field?: ["source", "metric"], message }`. The store gives them the line from the current config file and merges them into `configProblems` (banner + blocks export) until the adapter reports again (`[]` clears). Multi-line messages (list of available tracker ids) keep their line breaks in the banner.
- Manual checks still to do in Obsidian: break the config (e.g. `kind: monthly`, a YAML error), Refresh → banner with line numbers, cards keep the old config; fix and Refresh → banner gone, change applied; rename a metric id that has entries → orphaned-history warning. Check the banner at 360 px.
