# 04: History strips and streaks

**What to build:** Each weekly metric row shows a strip of the last 8 completed weeks (filled = hit, grey = missed) and "Hit · streak N" when hit. History lives in week snapshots in the data file, so it survives restarts and syncs across devices.

Rules:
- A week snapshot updates on every refresh while the week runs and is frozen at the first refresh after the week ends. A frozen snapshot stores the target that applied that week and is scored against it; the current week uses the config as it stands.
- A completed week with no value counts as missed. Weeks before the first week with any data for a metric are not shown and never counted.
- Streak: consecutive completed weeks hit counting back from last week, plus the current week if already hit; never counts past the first week with data.
- The data file is one JSON document, overwritten on write. Re-read it immediately before every write and change only the fields that write touches. Write only when a value or verdict actually changed.

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** ready-for-agent

- [ ] 8-week strip renders from week snapshots in the data file and survives a restart
- [ ] Freezing, frozen targets, missing-week-is-missed, first-data cutoff and streak are pure functions with unit tests
- [ ] Changing a weekly target in config does not change frozen weeks' verdicts
- [ ] A refresh that changes nothing does not write the data file
- [ ] Every write re-reads the data file first and preserves fields it didn't touch (test with a concurrent change)
