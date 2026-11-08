# 02: A weekly manual metric, end to end

**What to build:** Goals and weekly metrics are read from the config file and rendered as goal cards (name, statement) with one row per weekly metric. Danny opens the Enter values form, types a week total for a manual weekly metric and saves; the value persists in the data file and the row shows "value / target" with either "N to go this week" or "Hit". The header's *This week* tile shows weekly targets hit so far / number of weekly metrics.

Manual weekly entry semantics: one total per week (or the latest reading for a level metric such as Tengu WAU), replacing any earlier entry that week. Weekly fields in the form start blank with last week's value as a hint; a blank field leaves that metric unchanged. The form lists only manual metrics and saves in one action.

**Blocked by:** 01 (Plugin shell and empty Scoreboard view)

**Status:** done

- [x] Goal cards and weekly metric rows render from the config file; UI copy says "target", never "goal", for the number (render tests in `src/ui/ScoreboardApp.test.tsx`; not seen inside Obsidian)
- [x] Enter values form lists only manual metrics; weekly fields are blank with a "last week: N" hint; blank means unchanged; saves in one action (`src/core/enterValues.test.ts`, `src/ui/EnterValuesForm.test.tsx`; the Obsidian modal itself not run)
- [ ] A saved week total replaces any earlier entry for that metric and week, and survives a restart — replace-and-persist is unit-tested (`data.test.ts`, `DataFileRepository.test.ts`: new repository instance reads the saved file), but a real Obsidian restart was not run (the agent could not launch Obsidian). Verify manually with `examples/scoreboard.yaml`.
- [x] A level weekly metric uses the latest reading in the week (`combineWeekReadings` in `values.test.ts`; a manual entry replaces the week's earlier one, so it is always the latest reading)
- [x] Row shows "N to go this week" until the target is reached, then "Hit"
- [x] *This week* tile = weekly metrics hit so far / number of weekly metrics
- [x] Hit rule and This week score are pure functions with unit tests (`src/core/weeklyScoring.ts`)

Notes for later tickets:
- Year fields in the form are already pre-filled and save as the running total (`manual.latest`); ticket 03 only needs to verify and add the year row/score.
- A minimal config/data problem banner (`src/ui/ConfigBanner.tsx`) lists problems with line numbers; ticket 06 owns full validation and the final banner.
