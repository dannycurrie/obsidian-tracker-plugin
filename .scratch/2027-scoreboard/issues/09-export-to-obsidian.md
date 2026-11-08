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

**Status:** done

- [x] First export of a week appends one entry at the end of the 2027 Plan note
- [x] Re-export in the same week replaces that entry in place, leaving the rest of the note untouched
- [x] Monday export offers the just-finished week
- [x] In-progress vs ended-week status labels are correct (unit-tested entry rendering)
- [x] Export writes the week snapshot to the data file
- [x] Export is blocked with an explanation while the config is invalid
- [ ] Success notice links to the entry; on failure nothing is written (nothing-written is unit-tested; the notice link needs a manual check)
- [ ] Works with the default emoji paths (unit tests use them; needs a manual check in Obsidian, desktop and mobile)

**Implementation notes:**
- `src/core/report.ts` — the review week report, the single source for Export and ticket 10's coaching message. `reviewWeekFor(today)`: the current ISO week, or on a Monday the just-finished one (`ended: true`). `buildReviewReport({ config, data, today, sources, projects })` gives the scores, every metric (config order) with value / target text, `state` (`metricTrackState`: on-track / behind / in-progress / unscored), `statusLabel`, `stale`, weekly status + streak and year status + plan value, the stale list and active projects.
  - Weekly: the review week's value against its stored snapshot target once ended (else the config's). Labels "Hit", "N to go" (week running), "Missed (N short)" (ended).
  - Year: the latest value against the plan on the review week's Sunday if it has ended (Monday export), else today. Labels are the dashboard's pace labels ("£150 ahead of pace", "On pace (−£40)", "X behind pace"); the brief's sample row "On pace (+£150)" predates those labels, so the entry follows the Scoring rules.
  - Untargeted: "No target", target "–".
  - Stale values get " (stale)" in the Value column.
- `src/core/scoreboardEntry.ts` — `renderScoreboardEntry` (brief format; `|` escaped in cells; exported time in the config timezone, 24 h) and `upsertScoreboardEntry`: replaces the week's marker block in place, or appends after one blank line (never trims the note). Refuses with `ScoreboardMarkerError`, note unchanged, on an opening marker without a closing one (or the reverse), duplicate or reversed markers, or another week's marker inside the block. Keeps CRLF notes CRLF.
- Export record (`exports[weekKey]` in the data file, `exportRecordOf`): `{ exportedAt, week, weekEnded, thisWeek, yearToDate, metrics: { [metricId]: { state, label } } }`. A re-export replaces it. A record exported while its week ran may hold "in-progress" weekly states; ticket 10 can use the frozen snapshot of that week for the final verdict.
- `src/obsidian/exportReviewWeek.ts` (Obsidian-free, tested with fakes): refuse while `configValidationState` blocks, the data file is unreadable or the project notes couldn't be read → compute report, entry and data patch (`snapshotRefreshPatch` for today, which also freezes last week on a Monday, plus the export record) → write the note → write the data file. A failure before or during the note write writes nothing. The two files can't be written atomically together: if the data write fails after the note write, the success notice says so and asks for a re-export (which replaces the entry and retries the data write).
- `src/obsidian/planNote.ts`: `vault.process` on the plan note path from settings (atomic read-modify-write). A missing note is an error; the export never creates the note. The success notice links to `<note path without .md>#<entry heading>` via `openLinkText`.
- The view refreshes (same as Refresh) before exporting so the entry shows the latest values; clicks during an export are ignored. The header button reads "Export to Obsidian" (tooltip names the week), or "Export week N" on a Monday; while the config is invalid it looks unavailable, its tooltip gives the reason, and a click shows the reason in a notice.

**Manual checks in Obsidian (not yet done):**
- Export with the default emoji paths: the entry is appended to `🗺️ Plans/🎯 2027 Plan/2027 Plan.md`; "Open entry" in the notice opens the note at the entry heading. Same on mobile.
- Export again the same day: the entry is replaced in place, the rest of the note unchanged; `scoreboard-data.json` has `exports["2027-Www"]` and that week's snapshot.
- On a Monday: the button reads "Export week N" for last week and the entry shows "Missed (N short)" for unhit weekly metrics.
- Break the config: the button greys out and a click explains; delete the closing marker of this week's entry: export fails with the marker error and nothing changes; rename the plan note away: export fails with "No note at …".
