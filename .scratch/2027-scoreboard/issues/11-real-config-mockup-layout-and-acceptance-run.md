# 11: Real 2027 config, mockup layout and acceptance run

**What to build:** The scoreboard is ready for Danny's 2027: the real config file defines all five goals and 11 metrics from the brief's table, the layout matches the "2027 scoreboard · 5 goals + projects" mockup artboard (minus the season tile and stage bar) from 360 px to 1440 px, and every acceptance criterion in the brief has been checked on desktop and mobile.

**Blocked by:** 05 (Goal badges and untargeted metrics), 07 (Tracker source), 08 (Strategic projects and backlog), 10 (Start coaching chat)

**Status:** done (automatable parts; the unticked items need Danny in Obsidian, see `../ACCEPTANCE.md`)

- [ ] `scoreboard.yaml` defines all 11 metrics with the kinds, targets, plan curves and sources from the brief (tracker ids filled in from the API listing): everything but the ids is done and pinned by `exampleConfig.test.ts`; the three tracker ids are marked placeholders until the API key is set (ACCEPTANCE C-1, A-4)
- [ ] Layout matches the mockup's type and spacing at 360 px and 1440 px; goal cards form a responsive grid: done against the mockup artboard and checked in a static preview at both widths; not yet seen inside Obsidian (ACCEPTANCE C-2, A-11)
- [x] Every status has a text label as well as a colour (audit in ACCEPTANCE C-3)
- [ ] Emoji default paths work on desktop and Obsidian mobile (ACCEPTANCE C-4; the dev vault uses them)
- [ ] Every acceptance criterion in `product-brief.md` is ticked, with any failures written up as new tickets: run done, 5 of 11 verified by tests, 6 need Obsidian / phone / API key; no open failures; ticket 12 filed for a minor gap (ACCEPTANCE C-5)

## Notes (build)

- **Config** (`examples/scoreboard.yaml`, copied into the dev vault):
  - Goal statements come from the mockup artboard.
  - Year metrics use `cadence: ad-hoc` and weekly manual ones `cadence: weekly` (the defaults, made explicit).
  - The EPs `paceTolerance: 0.9` override from the brief's example was dropped: the brief's table has no override, so EPs use the global 0.95.
  - All three tracker metrics use `aggregate: sum`, Feedback given included. That works for a cumulative metric, and equals `count` when each entry is logged as 1; the config comment says when to switch.
  - Tracker ids are `TODO-tracker-id-…` placeholders. Static validation accepts them; the live API reports them in the banner with the real ids.
- **Mockup:** read from the canvas artboard "2027 scoreboard · 5 goals + projects" (`project/Scoreboard.dc.html`). Changes to match it:
  - Header: an uppercase "2027 Scoreboard" kicker and a large "Week N of 52" title. Tiles show "3 / 5" with the total small and muted; This week is the dark tile. Actions are on their own row.
  - A legend row (it was missing).
  - Goal cards: 16 px radius, 20 px padding, 22 px names, a tinted badge pill.
  - Metric rows: label plus an uppercase cadence ("This week", "Year total", "Ramp to Dec", "Trend"), a 24 px value with a small "/ target", a 10 px bar with a 3 × 18 px plan tick, and full-width strip squares.
  - Projects and backlog sit side by side (flex 640 / 320 basis, wrapping). The backlog is one card with numbered rows.
  - Max width 1360 px. Goal grid `auto-fit, minmax(min(100%, 240px), 1fr)` (5 columns at 1440).
  - Colours: Obsidian's `--color-blue` / `--color-orange`, with `color-mix` text tones and rgba tints. No web fonts.
  - Narrow panes and phones use a container query (≤ 560 px). `.is-mobile` gives 44 px tap targets.
  - This also fixed two unclosed CSS blocks that had disabled every later rule.
- **Mobile clipboard:** Start coaching chat no longer awaits a refresh first. `startCoachingChat` starts the copy and calls `openUrl` synchronously, before its first await, so both stay inside the tap's user activation; it uses the current (auto-refreshed) state.
- **Tools:**
  - `npm run preview`: a static HTML render of the app with the real config and sample data, in `.scratch/2027-scoreboard/preview/`.
  - `preview/screenshot.sh`: headless Chrome screenshots.
  - `npm run install:dev-vault`: build and install into `.scratch/2027-scoreboard/dev-vault/`.
