# 06: Config validation

**What to build:** When Danny breaks the config file (YAML error, unknown curve type, missing target, unknown metric kind…), the view keeps working from the last valid config and shows a banner listing each problem with its line number. If the data file holds history for a metric id no longer in the config, the view warns about it (renaming ids is not supported in v1; changing labels is safe).

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** ready-for-agent

- [ ] An invalid config shows a banner with each problem and its line number
- [ ] The view keeps rendering from the last valid config while the current one is invalid
- [ ] Fixing the config and refreshing clears the banner and applies the new config
- [ ] Orphaned history (data for an id not in config) produces a warning
- [ ] Validation is a pure function with unit tests for each error type
- [ ] A validation state is exposed so later features (export) can refuse to run while the config is invalid
