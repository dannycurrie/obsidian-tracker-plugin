# 2027 Scoreboard: acceptance run (ticket 11)

Run on 8 Nov 2026 against `master` after ticket 11. `npm test` (36 files, 394 tests), `npm run typecheck` and `npm run build` pass.

Covers every acceptance criterion in `product-brief.md` (section A), every unticked or manual check in tickets 01–10 (section B), and ticket 11's own criteria (section C).

**Status key**
- ✅ verified by an automated test (named), or by a check that needs no Obsidian
- ⏳ needs a manual check in Obsidian: exact steps given. Any automated coverage is listed too.
- ❌ failing (none left open; see "Fixed during this run")

The agent could not run Obsidian (desktop or mobile) and had no Tracker API key, so anything that needs a running Obsidian, a phone, Obsidian Sync or the live API is ⏳.

## Summary

| | ✅ | ⏳ | ❌ |
| --- | --- | --- | --- |
| A. Brief acceptance criteria (11) | 5 | 6 | 0 |
| B. Ticket 01–10 manual checks (21) | 0 | 21 | 0 |
| C. Ticket 11 criteria (5) | 1 | 4 | 0 |
| **Total (37)** | **6** | **31** | **0** |

New ticket: `issues/12-history-square-provenance-on-hover.md` (a small gap against the brief's Rules, not an acceptance criterion).

### Fixed during this run

- ❌ → fixed: **styles.css had two unclosed rule blocks** (`.scoreboard-project-fixes__problem` and `.scoreboard-history__week.is-no-data`). With CSS nesting, every rule after them became a nested selector that never matched, so in Obsidian the year progress bar and plan tick, the goal badge colours, the untargeted strip and the stale / refreshed / source-error styles would all have been unstyled. styles.css was rewritten to the mockup's layout (ticket 11) and the preview screenshots show these styles applied.
- ❌ → fixed: **the legend (brief › Screen layout 2) was missing.** Added `src/ui/Legend.tsx` under the header (render test: "shows the legend in words under the header once there are goals").
- ❌ → fixed: **Start coaching chat copied to the clipboard and called `window.open` after `await this.reload()`.** On iOS the click's user activation can lapse across an await, so the copy fails and the popup can be blocked. It now copies and opens synchronously in the click from the current state (refreshed on open, every 15 minutes and by Refresh). Test: `startCoachingChat.test.ts` › "starts the copy and opens the URL synchronously, inside the click's user gesture". Still ⏳ on a real phone (B-21).
- Goal badge colour now has words: a hover title / accessible name for each tone. The history strip has a visible "N/8 hit" next to the squares (no hover on mobile).

## Setup for the manual checks (dev vault)

1. `npm run install:dev-vault`: builds, then copies `main.js`, `manifest.json` and `styles.css` into `.scratch/2027-scoreboard/dev-vault/.obsidian/plugins/weekly-scoreboard/`. (To install into another vault: `npm run build && node scripts/install-dev-vault.mjs "<vault folder>"`.)
2. Obsidian → Open folder as vault → `.scratch/2027-scoreboard/dev-vault`. Settings → Community plugins → Turn on community plugins → enable **2027 Scoreboard**.
3. The dev vault has:
   - `🗺️ Plans/🎯 2027 Plan/2027 Plan.md`: a plan note with existing content.
   - `🗺️ Plans/🎯 2027 Plan/scoreboard.yaml`: a copy of `examples/scoreboard.yaml`, the real 2027 config, with placeholder tracker ids.
   - `🚀 Projects/`:
     - Active: Tengu launch, Remortgage, and EP two (no next action).
     - Backlog: `Career/ASL coverage for email` (rank 1, in a subfolder) and Morning routine (rank 2).
     - Malformed: Studio rebuild (`status: actve`).
     - Not a project: Reading list.
   - `📅 Daily/`: one note, not read in v1.
   - The data file `scoreboard-data.json` is created on first save (git-ignored).
4. Tracker checks need the API key: Settings → 2027 Scoreboard → Tracker API key.
5. Mobile: put the dev vault (plugin folder included) on the phone with Obsidian Sync (sync community plugins on), or install the plugin into the real vault.
6. Static layout preview, no Obsidian needed:
   - `npm run preview` writes `.scratch/2027-scoreboard/preview/{index,dark,phone,states,states-phone}.html`. The phone pages pin the view to 360 px.
   - `sh .scratch/2027-scoreboard/preview/screenshot.sh` writes `preview/screenshots/*.png` with headless Chrome.

## A. Brief acceptance criteria

**A-1. The view opens from the command palette and a ribbon icon, on desktop and on Obsidian mobile. ⏳**
- Desktop: after setup, click the trophy ribbon icon, which opens the Scoreboard view. Close it. Cmd/Ctrl-P → "2027 Scoreboard: Open scoreboard" opens it again, and a second run focuses the existing view.
- Mobile: same from the ribbon menu and the command palette.
- Code: `addRibbonIcon` + `addCommand` in `src/obsidian/main.ts`. `isDesktopOnly: false`, and no Node or Electron APIs are used.

**A-2. All 11 metrics render from the config file; changing a target in config updates the view on refresh, and frozen weeks keep their stored target. ✅**
- `exampleConfig.test.ts` › "defines the brief's 11 metrics with their kinds, targets, plan curves and sources", and "passes full validation with no problems".
- `model.test.ts` › "builds one card per goal and one row per metric, in config order".
- `ScoreboardStore.test.ts` › "validates fully by default, keeps the last valid config, and applies the fix on reload", and "freezes after the week ends; a later target change leaves frozen verdicts alone, across restarts".
- `snapshots.test.ts` › "follows target changes while the week runs", and "never changes a frozen week's target, even when the config changes".
- `history.test.ts` › "scores frozen weeks against their stored target, not the config's".
- Seeing it in Obsidian is B-12 and C-2.

**A-3. An invalid config shows a banner with line numbers, keeps the last valid config, and blocks export. ✅**
- `configValidation.test.ts`: one test per error type, each with its line.
- `ScoreboardStore.test.ts` › "keeps the last valid config when the file becomes invalid, and lists the problems".
- `ScoreboardApp.test.tsx` › "lists config problems with line numbers".
- `exportReviewWeek.test.ts` › "is blocked with an explanation while the config is invalid, writing nothing".
- In-Obsidian check: B-12.

**A-4. Meditation, Feedback given and Homework time with N update from the Tracker API without any manual step, on desktop and mobile. ⏳**
1. Set the API key in settings and open the view. The banner lists the three placeholder ids as unknown, with every tracker metric's name and id.
2. Paste the real ids into `🗺️ Plans/🎯 2027 Plan/scoreboard.yaml` (and `examples/scoreboard.yaml`), then Refresh. The banner clears.
3. The three rows show this week's values, and the strips show past weeks. Hovering a value shows "Tracker · fetched …".
4. Log a meditation in the tracker app and wait for the 15-minute auto refresh (or press Refresh). The value updates.
5. Repeat on the phone (`requestUrl`, no CORS).

Also check Feedback given: the config uses `aggregate: sum`. If each piece of feedback is logged as one entry with some value other than 1, switch it to `count`.

Automated (fixtures only):
- `trackerAdapter.test.ts` › "makes one GET with the bearer key for the whole window, and writes week values".
- `ScoreboardStore.tracker.test.ts` › "fills the tracker metric's current week and history from one request, and saves them", and "lists an unknown tracker id in the config problems with the available ids, and clears it once fixed".
- `tracker.test.ts`: DST weeks and sum / count.

**A-5. Manual metrics are entered in one form (weekly fields blank with a last-week hint, year fields pre-filled) and persist across restarts and devices. ⏳**
Form and restart are covered:
- `enterValues.test.ts` › "lists only manual metrics, in config order", "starts weekly fields blank with a 'last week: N' hint", and "pre-fills year fields with the latest value".
- `EnterValuesForm.test.tsx`.
- `DataFileRepository.test.ts` › "creates the file on first change and persists across instances (restart)", and "re-reads before writing and keeps a concurrent change from another device".

Manual steps:
1. Click Enter values. The form has 8 fields: the 3 weekly ones blank, the 5 year ones pre-filled once they have values.
2. Enter Music practice 45, Saved in Vanguard 4300 → Save. The rows update.
3. Quit and reopen Obsidian. The values are still there.
4. On the phone after Sync, the same values show. Enter a value on the phone, and it shows on desktop after Sync.

**A-6. Header scores and goal badges match the scoring rules, and every rule has a passing unit test. ✅** Rule → test:

| Rule | Test |
| --- | --- |
| Weekly hit | `weeklyScoring.test.ts` › "is hit at or above the target", "counts as hit during the week as soon as the target is reached", "is only missed once the week has ended, including no data" |
| Missing data | `history.test.ts` › "counts a completed week with no value as missed", "leaves out weeks before the first week with data" |
| Target changes | `history.test.ts` › "scores frozen weeks against their stored target, not the config's"; `snapshots.test.ts` › "follows target changes while the week runs" |
| This week score | `weeklyScoring.test.ts` › "is weekly metrics hit so far / number of weekly metrics"; `model.test.ts` › "counts weekly metrics hit so far / weekly metrics in the This week score" |
| Streak | `history.test.ts` › weeklyStreak (7 tests, including "never counts back past the first week with data") |
| Year on pace | `yearScoring.test.ts` › "is on pace at or above tolerance × plan value", "uses the global value unless the metric overrides it" |
| Pace delta labels | `yearScoring.test.ts` › "is ahead when the delta is ≥ 0", "is on pace (−X) when below plan but within tolerance", "is behind when outside tolerance", "shows the delta in the metric's unit…" |
| Year to date score | `yearScoring.test.ts` › "is year metrics on pace / number of year metrics"; `model.test.ts` › "counts year metrics on pace / year metrics in the Year to date tile" |
| Goal badge | `goalBadge.test.ts` (12 tests, including the Monday-morning grey case); `ScoreboardApp.test.tsx` › "shows an 'x / y on track' badge on each goal card, coloured and worded" |
| Untargeted excluded | `model.test.ts` › "are excluded from both header scores and from badges, whatever their values" |
| Week number | `week.test.ts` (Europe/London, 2026-W53, 53-week years) |
| Plan curves | `planCurve.test.ts` (linear, quarterly, milestones) |
| Review week | `report.test.ts` › "is the current ISO week from Tuesday to Sunday", "is the just-finished week on a Monday" |
| Export / coaching status labels | `report.test.ts` › "reads 'N to go' while the week runs…", "on a Monday reports last week: 'Missed (N short)'…" |

**A-7. A failing source shows "stale" with the last good value, never zero. ✅**
- `ScoreboardStore.tracker.test.ts` › "on failure shows the last good value as stale with its age, never zero", and "after a restart with the API down, shows the value saved in the data file as stale".
- `SourceStatus.test.tsx` › "marks a failed source's values stale with their age, and says why in the header".
- `sources.test.ts`.
- Seen in `preview/states*.html`.

**A-8. Up to three active projects and the ranked backlog appear from note frontmatter; each name opens its note; malformed notes are listed as needing fixes. ⏳**
Frontmatter, order and malformed handling are covered by `projects.test.ts`, `Projects.test.tsx` and `ProjectsStore.test.ts`. The dev vault's notes were also run through `parseProjectNote` / `buildProjectsModel`: 3 active (EP two with no next action), backlog ranks 1–2 (one from a subfolder), and Studio rebuild malformed.

Manual steps:
1. In the dev vault, the Active strategic projects section shows "3 of 3 slots in use" with Tengu launch, Remortgage and EP two. EP two shows "No next action" in orange.
2. The Backlog shows "1 ASL coverage for email · Career" and "2 Morning routine · Self".
3. Near the header, "1 project note needs fixing" expands to Studio rebuild — unknown status "actve".
4. Click each name: the note opens. Name-click details are B-14.

**A-9. Export adds one entry per week to the 2027 Plan note, and exporting again in the same week replaces it. ✅**
- `exportReviewWeek.test.ts` › "appends the first entry of a week to the end of the plan note and links its heading", and "re-export in the same week replaces the entry in place".
- `scoreboardEntry.test.ts` › "replaces the week's entry in place, leaving the rest of the note untouched", and "re-exporting twice gives the same note as exporting once".
- The Obsidian write (`vault.process`) and the notice link: B-16 to B-19.

**A-10. Start coaching chat copies the context message and opens the saved chat URL. ⏳**
Automated with fakes in `startCoachingChat.test.ts`, including the new synchronous-gesture test. Manual: B-19 to B-21.

**A-11. The layout works at 360 px and 1440 px widths, and every status has a text label as well as a colour. ⏳**
Text labels ✅: see C-3.

Layout checked in the static preview (`preview/screenshots/index-1440.png`, `phone-360.png`, `dark-1440.png`, `states-*.png`): 5 goal columns at 1440, 1 column at 360, no horizontal overflow, tiles side by side and buttons in a 2 × 2 grid at 360. That preview uses a shim of Obsidian's theme variables, not Obsidian.

Manual steps:
1. Desktop: make the window about 1440 px wide with the sidebars collapsed. There are 5 goal cards in one row, and projects and backlog sit side by side.
2. Drag a split pane narrow (under 560 px). It reflows like the phone (container query).
3. On a phone (360–390 px): the page has no sideways scroll, the buttons are at least 44 px tall, and the backlog rows and project names are easy to tap.
4. Switch to the dark theme and check contrast: neutral strip squares, orange text, and the dark "This week" tile (which turns light in dark mode).

## B. Ticket 01–10 manual checks

**B-1. (01) The view opens from the ribbon and the command palette. ⏳** Same as A-1.

**B-2. (01) The view loads on mobile as well as desktop. ⏳** A-1, mobile step.

**B-3. (01) The settings tab renders with every setting and the emoji default paths. ⏳**
Defaults are covered by `settings.test.ts` › "defaults to the brief's emoji paths".
1. Open Settings → 2027 Scoreboard. It lists the config path, data file path, plan note path, projects folder, Tracker API URL and key, coaching chat URL and prompt template.
2. There is no pace tolerance setting, and the key field notes where the key is stored.

**B-4. (02) A saved week total replaces any earlier entry and survives a restart. ⏳**
Covered by `enterValues.test.ts` › "replaces this week's earlier entry and keeps other weeks" and `DataFileRepository.test.ts`.
1. Enter values: Music practice 30 → Save, then 45 → Save. The row shows 45 / 60 min.
2. Restart Obsidian. It still shows 45.

**B-5. (03) The progress bar and plan tick look right (light and dark, 360 and 1440 px). ⏳**
1. Enter Saved in Vanguard 4300 and EPs released 1.
2. The bars fill in blue or orange with a dark tick at today's plan position (light tick in dark theme). Compare with `preview/screenshots/index-1440.png`.

**B-6. (03) The Year to date tile sits next to This week and wraps on mobile. ⏳** At 1440 the tiles sit right of "Week N of 52". On a phone they sit side by side below the title.

**B-7. (05) The badge looks right and wraps in the card header at 360 and 1440 px. ⏳** On a phone, a long goal name with its badge wraps without clipping, and the pill's text stays on one line.

**B-8. (05) The neutral strip has enough contrast in light and dark themes. ⏳**
No metric is untargeted in v1. To check:
1. Temporarily add an untargeted metric to the dev vault config, for example `{ id: gigs, label: Gigs, kind: untargeted, source: { type: manual, cadence: weekly } }` under creative.
2. Enter a few weeks of values. The strip is grey and readable, and the row reads "no target set".

**B-9. (06) Breaking the config shows a banner with line numbers, and the cards keep the old config. ⏳**
1. In the dev vault's `scoreboard.yaml`, change `kind: weekly` on meditation to `kind: monthly`, then Refresh.
2. A banner reads "Line N: …" and says it is showing the last valid config and that export is blocked. The Export button greys out.
3. Then add a YAML error (an unclosed `[`) and Refresh. The banner shows the YAML error with its line.

**B-10. (06) Fixing the config clears the banner and applies the change. ⏳** Undo both edits and change Meditation's `target: 100` to `120`, then Refresh. The banner is gone and the row reads "… / 120 min".

**B-11. (06) Renaming a metric id that has entries gives an orphaned-history warning. ⏳** Enter Music practice, rename `id: music-practice` to `music`, then Refresh. A warning names `music-practice` with "1 weekly entry". Rename it back.

**B-12. (06) The banner works at 360 px. ⏳** Repeat B-9 on a phone. Long problem lines wrap, with no sideways scroll. Compare `preview/screenshots/states-phone-360.png`.

**B-13. (07) Live Tracker API and a real Obsidian mobile device. ⏳**
1. Do A-4 on desktop, then on the phone.
2. Also put the phone in airplane mode and Refresh. The tracker rows show "stale · N h old" with their last values, never zero, and the header says the tracker failed.
3. The API key is in secret storage (Obsidian ≥ 1.11.4): `.obsidian/plugins/weekly-scoreboard/data.json` must not contain it.

**B-14. (08) Project names open their notes; Ctrl/Cmd-click and middle-click open a new pane. ⏳** In the dev vault:
1. Click "Tengu launch". It opens in the current pane.
2. Cmd-click (Ctrl on Windows) "Remortgage". It opens in a new pane.
3. Middle-click a backlog item. It opens in a new pane.
4. Click the Studio rebuild link in "needs fixing". It opens.

**B-15. (08) Editing project notes updates the view without Refresh, including the emoji folder with subfolders on desktop and mobile. ⏳**
Covered by `ProjectsStore.test.ts` › "batches change events into one read".
1. In `EP two.md`, add `- [ ] Book studio time` under `## Next actions`. Within about a second the card shows "Next: Book studio time".
2. Set `Morning routine.md` to `status: active`. The slot label turns orange: "4 of 3 slots in use · over the limit".
3. Fix Studio rebuild's status to `backlog`. The "needs fixing" line goes away.
4. Move `Career/ASL coverage for email.md` out of `🚀 Projects/`. It disappears.
5. Repeat one edit on the phone.

**B-16. (09) The success notice links to the entry. ⏳**
1. Click Export to Obsidian. A notice reads "Week N exported to the 2027 Plan note. Open entry".
2. Click Open entry. `🗺️ Plans/🎯 2027 Plan/2027 Plan.md` opens at "## Scoreboard — Week N (…)". The note's existing content above is unchanged.

**B-17. (09) Export works with the default emoji paths on desktop and mobile. ⏳**
1. Do B-16, then click Export again. The notice says "updated", and the note has one entry for the week, replaced in place.
2. `scoreboard-data.json` has `exports["2027-Www"]` and that week's snapshot.
3. Repeat on the phone.

**B-18. (09) Monday, invalid config, broken marker, and missing note. ⏳**
1. On a Monday, the button reads "Export week N" (last week), and unhit weekly metrics show "Missed (N short)".
2. With a broken config (B-9), clicking explains the block and writes nothing.
3. Delete this week's `<!-- /scoreboard:… -->` and Export. It fails with the marker error, and the note is unchanged.
4. Rename the plan note and Export. It fails with "No note at …". Rename it back.

**B-19. (10) Desktop coaching chat: clipboard, browser and notice. ⏳**
1. Paste a chat URL into Settings → Coaching chat URL.
2. Click Start coaching chat. The chat opens in the browser, and the notice reads "Coaching context copied — paste it into the chat."
3. Paste into a note. It starts "Weekly scoreboard check-in — Week N of 52 (…)" and ends with the prompt template.

**B-20. (10) An empty URL setting opens claude.ai/projects and shows the settings notice. ⏳** Clear the setting and click the button. claude.ai/projects opens, and the notice asks for the chat URL.

**B-21. (10) Mobile (iOS / Android) clipboard and `window.open`. ⏳**
1. Do B-19 on the phone. The copy now happens synchronously in the tap, so it should succeed. If it fails, the notice says "Couldn't copy …" and to retry.
2. The chat opens in the in-app browser or the Claude app.
3. Note: the message uses the data as last refreshed. Press Refresh first if the tracker app was just used.

## C. Ticket 11 criteria

**C-1. `scoreboard.yaml` defines all 11 metrics with the brief's kinds, targets, plan curves and sources, with tracker ids filled in from the API listing. ⏳**
Everything but the ids is ✅ (`exampleConfig.test.ts`). The ids are placeholders (`TODO-tracker-id-…`) until the API key is set; then do A-4, steps 1–2.

**C-2. The layout matches the mockup's type and spacing at 360 and 1440 px, and goal cards form a responsive grid. ⏳**
Aligned with the mockup artboard (read from the canvas). Checked in the static preview only. In Obsidian: A-11.

**C-3. Every status has a text label as well as a colour. ✅** Audit of every coloured status:

| Status | Words |
| --- | --- |
| Weekly row | "Hit · streak N", "N to go this week", "Missed (N short)" |
| Year row | "X ahead of pace", "On pace (−X)", "X behind pace" |
| Year row, stale value | "updated N wks ago" |
| Untargeted row | "↑/↓/→ N vs 4 wks ago · no target set" |
| Stale values | "stale · N h old"; the header line names the failing source |
| History strip | Visible "N/8 hit", plus per-square and summary labels |
| Goal badge | "x / y on track", plus a tone description as title / accessible name |
| Slot label | "· over the limit" |
| Project with no next action | "No next action" |
| Project with unknown goal | "unknown goal" |
| Malformed project notes | "N project notes need fixing" |
| Config and data banners | Words |
| Export blocked | Banner, tooltip, and a notice on click |
| Legend | Words for each swatch |

Tests:
- `ScoreboardApp.test.tsx` › "shows an 'x / y on track' badge on each goal card, coloured and worded", "renders the history strip … 'Hit · streak N'" (including "2/3 hit"), and "shows the legend in words …".
- `Projects.test.tsx` › "turns the slot label orange with words when more than three are active".

**C-4. Emoji default paths work on desktop and Obsidian mobile. ⏳**
- Covered: `settings.test.ts` › "defaults to the brief's emoji paths", `projects.test.ts` › "compares Unicode paths in NFC", and `exportReviewWeek` / `ScoreboardStore` tests that use the emoji paths.
- Manual: the dev vault uses the default paths with no settings changed. A-5, B-15 and B-17 on desktop and phone cover config, data file, projects and plan note.

**C-5. Every acceptance criterion in `product-brief.md` is ticked, with failures written up as new tickets. ⏳** No open failures; ticket 12 was filed for a minor gap. Tick the brief's boxes once the ⏳ items above pass.
