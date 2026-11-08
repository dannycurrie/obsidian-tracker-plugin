# 02: A weekly manual metric, end to end

**What to build:** Goals and weekly metrics are read from the config file and rendered as goal cards (name, statement) with one row per weekly metric. Danny opens the Enter values form, types a week total for a manual weekly metric and saves; the value persists in the data file and the row shows "value / target" with either "N to go this week" or "Hit". The header's *This week* tile shows weekly targets hit so far / number of weekly metrics.

Manual weekly entry semantics: one total per week (or the latest reading for a level metric such as Tengu WAU), replacing any earlier entry that week. Weekly fields in the form start blank with last week's value as a hint; a blank field leaves that metric unchanged. The form lists only manual metrics and saves in one action.

**Blocked by:** 01 (Plugin shell and empty Scoreboard view)

**Status:** ready-for-agent

- [ ] Goal cards and weekly metric rows render from the config file; UI copy says "target", never "goal", for the number
- [ ] Enter values form lists only manual metrics; weekly fields are blank with a "last week: N" hint; blank means unchanged; saves in one action
- [ ] A saved week total replaces any earlier entry for that metric and week, and survives a restart
- [ ] A level weekly metric uses the latest reading in the week
- [ ] Row shows "N to go this week" until the target is reached, then "Hit"
- [ ] *This week* tile = weekly metrics hit so far / number of weekly metrics
- [ ] Hit rule and This week score are pure functions with unit tests
