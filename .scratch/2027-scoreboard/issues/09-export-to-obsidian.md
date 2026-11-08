# 09: Export to Obsidian

**What to build:** One click on Export to Obsidian writes a scoreboard entry for the review week to the end of the 2027 Plan note, and Danny gets a notice linking to it. Exporting again in the same week replaces that week's entry in place. Entry format is in `product-brief.md` › Export to Obsidian.

Rules:
- Review week: the current ISO week; if used on a Monday, the just-finished week is offered instead.
- Entry sits between `scoreboard:<YYYY-Www>` HTML comment markers and contains the header line (This week x/5 · Year to date x/6 · exported time), a table of every metric, and active projects as wikilinks with their next action.
- Status labels: unhit weekly metric reads "N to go" while the week runs and "Missed (N short)" once it has ended; year metrics use the pace labels; untargeted metrics read "No target".
- Export also writes that week's snapshot to the data file. The entry is a picture as of export time; later activity updates the data file, not the entry.
- Export is refused while the config is invalid.
- On failure, nothing is written and the error is shown.
- The only note ever edited is the 2027 Plan note, and only inside scoreboard markers.

**Blocked by:** 04 (History strips and streaks), 05 (Goal badges and untargeted metrics), 06 (Config validation), 08 (Strategic projects and backlog)

**Status:** ready-for-agent

- [ ] First export of a week appends one entry at the end of the 2027 Plan note
- [ ] Re-export in the same week replaces that entry in place, leaving the rest of the note untouched
- [ ] Monday export offers the just-finished week
- [ ] In-progress vs ended-week status labels are correct (unit-tested entry rendering)
- [ ] Export writes the week snapshot to the data file
- [ ] Export is blocked with an explanation while the config is invalid
- [ ] Success notice links to the entry; on failure nothing is written
- [ ] Works with the default emoji paths
