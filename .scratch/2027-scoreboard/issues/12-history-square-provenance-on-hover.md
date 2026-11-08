# 12: Source and fetch time on history-strip squares

**What to build:** Hovering a square in a weekly metric's 8-week strip shows where that week's value came from and when, like every other value on the scoreboard. Today the square's hover text gives only the week, value / target and verdict ("Week 16: 50 / 60 min · Missed").

**Found in:** the ticket 11 acceptance run (brief › Data sources › Rules: "Every value carries its source and fetch time; hovering a value shows both"). Ticket 07 noted the gap; it is not one of the brief's acceptance criteria, so it doesn't block v1.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] `HistoryWeek` (src/core/history.ts) carries the week value's provenance: source (manual / tracker) and entered / fetched time, from the week snapshot or the manual entry
- [ ] The square's title reads e.g. "Week 16: 50 / 60 min · Missed · Tracker · fetched 21 Apr 2027, 09:00" (reuse `valueSourceTitle`); a week with no data says "no data"
- [ ] Untargeted (trend) squares get the same
- [ ] Unit test for the provenance and a render test for the title
