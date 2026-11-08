# 2027 Scoreboard — product brief

Nov 8, 2026 · @Danny · revised after design review the same day (terms are defined in `GLOSSARY.md`)

## Purpose

Build a 2027 scoreboard that shows, at a glance, whether Danny is winning this week and on pace for the year across five goals, and lets him drill into the three active strategic projects. It replaces a flat plan file that he stopped looking at.

Success means:

- The weekly review takes under 10 minutes: tracker metrics fill themselves and everything else goes in one form.
- Every metric shows a clear win or lose state against a target, except ones explicitly marked as untargeted.
- One click exports the week to the 2027 Plan note and one click opens a coaching chat with the latest results.

Design reference: the "2027 scoreboard · 5 goals + projects" artboard on the [mockup canvas](https://claude.ai/artifact/U3Qn1NJTFHa4yuvSqhAU7T). The season / winning-weeks tile and the project stage bar in that mockup are dropped.

## Scope

Version 1 is a single scoreboard view inside Obsidian (see Architecture), on desktop and mobile.

| In v1 | Out of v1 |
| --- | --- |
| Header scores: this week's targets hit, year targets on pace | Season / winning-weeks score |
| Five goal cards with their metrics, as in the mockup | Phone home-screen widgets and e-ink display |
| Automatic metric updates from the Tracker API (meditation, feedback, homework) | Integrations with Vanguard, the mortgage lender or Ten's analytics |
| A quick manual-entry form for metrics with no automatic source | Editing goals and targets from the UI (done in a config file) |
| Three active strategic projects and an ordered backlog, each linked to its note | Pace-lines and campaign-map views |
| Export to Obsidian button | Multi-year history views |
| Start coaching chat button | Notifications or reminders |
| | Project stages; renaming a metric id while keeping its history |

## Terms

Goal = one of the five areas. Metric = a measured thing in a goal. Target = the number a metric is scored against. Hit = a weekly metric reached its target. On pace = a year metric is within tolerance of its plan curve. On track = hit or on pace. UI copy says "value / target", never "value / goal".

## Screen layout

One scrolling view, top to bottom. It must work from 360 px (phone) to 1440 px wide.

1. **Header.** "Week N of 52", the date data was last refreshed, and two score tiles: *This week* (weekly targets hit / total) and *Year to date* (year targets on pace / total). Also: Refresh, Enter values, Export to Obsidian, Start coaching chat.
   - If the config is invalid, a banner lists each problem with its line number (see Data model).
   - If any project notes are malformed, a small line reads "N project notes need fixing" and links to them.
2. **Legend.** Plan tick = where the plan says you should be today; filled square = week hit; grey square = week missed.
3. **Goal cards.** Five cards in a responsive grid. Each card has the goal name, its one-line statement, and an "x / y on track" badge. Badge colour: blue if all scored metrics are on track; orange if none are on track **and** at least one is actually behind or missed; grey otherwise. A weekly metric still in progress this week never turns a badge orange. Then one row per metric:
   - **Weekly metric:** value this week / target, a strip of the last 8 completed weeks, and either "Hit · streak N" or "N to go this week".
   - **Year metric:** value / target, a progress bar with a plan tick for today, and one of: "X ahead of pace", "On pace (−X)" (below plan but within tolerance), or "X behind pace" (outside tolerance). A manual year metric whose latest value is more than 4 weeks old also shows "updated N wks ago"; it is still scored normally.
   - **Untargeted metric:** value, change against 4 weeks ago (↑ / ↓ / → with the number), and the same 8-week strip without hit/miss colouring, labelled "no target set", with no bar. No metric is untargeted in v1, but the kind is supported.
4. **Active strategic projects.** Up to three cards, labelled "N of 3 slots in use". Each card has a goal tag, the project name (a link to its note) and its next action. No stage bar.
5. **Backlog.** A numbered list in pull order with a goal tag on each item. Each item links to its note.

Status colours: blue for on track or hit, orange for behind or missed, grey for neutral. Never use colour alone: every status also has words. Match the mockup's type and spacing; no other visual changes are needed for v1.

## Data model

Goals and metrics are defined in one config file in the vault, so targets can change without code changes. There are three kinds of metric:

- **weekly**: a target per ISO week of 2027 (W01–W52, Monday to Sunday, Europe/London). The week's value is one week total, or the latest reading in the week for a level metric.
- **year**: a running total or level against a 31 December target, with a plan curve, over **calendar** 2027 (1 Jan – 31 Dec). Note that 1–3 Jan 2027 fall in 2026-W53: they count toward year metrics but belong to no 2027 week.
- **untargeted**: shown with its trend and excluded from all scores.

v1 scores 5 weekly metrics and 6 year metrics:

| Goal | Metric | Kind | Target | Plan curve | Source |
| --- | --- | --- | --- | --- | --- |
| Finances | Saved in Vanguard (paid in during 2027, not account balance) | year | £12,000 | linear from £0 | manual |
| Finances | Mortgage overpayment | year | £10,000 | linear from £0 | manual |
| Career | Tengu WAU | weekly (level) | 25 | — | manual |
| Career | Non-telephony inbound requests serviced by ASL | year (level) | 100% by end of Q4 | quarterly from 0%: Q1 10%, Q2 50%, Q3 80%, Q4 100% | manual |
| Career | Clients migrated to new React platform | year (level) | 100% by end of Q4 | quarterly from 0%: Q1 10%, Q2 50%, Q3 80%, Q4 100% | manual |
| Family | Homework time with N | weekly | 60 min | — | tracker |
| Family | \[x\] with S | year | 12 | linear from 0 | manual |
| Self | Meditation | weekly | 100 min | — | tracker |
| Self | Feedback given | weekly | 10 | — | tracker |
| Creative | Music practice, playing, recording | weekly | 60 min | — | manual |
| Creative | EPs released | year | 5 | linear until release dates are set, then milestones | manual |

A plan curve gives the expected value on any date. There are three types: `linear` (baseline to target across the year), `quarterly` (a target per quarter end, interpolated between them) and `milestones` (a list of date and value steps, flat between steps). Without curve types, step-shaped metrics such as EPs show as "behind" for most of the year.

The pace tolerance lives only in the config: a global `paceTolerance` (default 0.95) with an optional per-metric override.

Example config (field names are a proposal):

```yaml
year: 2027
weekStart: monday
timezone: Europe/London
paceTolerance: 0.95
goals:
  - id: self
    name: Self
    statement: …
    metrics:
      - id: meditation
        label: Meditation
        kind: weekly
        target: 100
        unit: min
        source: { type: tracker, metric: "<tracker metric uuid>", aggregate: sum }  # Meditation
  - id: creative
    name: Creative
    statement: Put more music out into the world
    metrics:
      - id: music-practice
        label: Music practice, playing, recording
        kind: weekly
        target: 60
        unit: min
        source: { type: manual }
      - id: eps
        label: EPs released
        kind: year
        target: 5
        plan: { type: linear }   # switch to milestones once release dates are set
        paceTolerance: 0.9       # optional override
        source: { type: manual }
```

Config validation:

- If the file has a YAML error or an invalid field (unknown curve type, missing target, unknown tracker id…), the view keeps using the **last valid config**, shows a banner listing each problem with its line number, and refuses to export until it is fixed.
- A tracker source with a missing or unknown `metric` id produces an error that lists the available tracker metric names and ids, so one can be copied in.
- History is keyed by metric `id`. Changing a `label` is safe. If the data file holds records for an id no longer in the config, show a warning (no rename support in v1).

Projects are Obsidian notes, not config entries. Their fields are in the Project links section.

## Data sources and auto-update

Each metric has one source adapter, set in config. When the view opens, when Refresh is clicked, and every 15 minutes while the view is open, the dashboard asks each adapter for the current week's value, the last 8 completed weeks (weekly metrics) or the latest value (year metrics).

| Adapter | Reads | Metrics in v1 | Config |
| --- | --- | --- | --- |
| `tracker` | The tracker Metrics API | Meditation, Feedback given, Homework time with N | `metric` (tracker metric id), `aggregate` (`sum` → period `value`, `count` → `entryCount`) |
| `manual` | The latest value entered in the Enter values form | The other 8 metrics | `cadence` (weekly or ad hoc) |

Keep the adapter interface open so daily-note or tag-count adapters can be added later; they are not needed in v1.

### Tracker API (spike done)

Reference: [`server/README.md`](https://github.com/dannycurrie/tracker/blob/main/server/README.md) and `prds/008-metrics-api.md` in `dannycurrie/tracker`.

- Production: `https://tracker-metrics-api.vercel.app`. One endpoint: `GET /v1/metrics?from=<ISO-8601>&to=<ISO-8601>&granularity=day`, `Authorization: Bearer <API_KEY>`. Window is half-open `[from, to)`, max 2 years. Encode `+` offsets as `%2B`.
- One call returns **every** tracker metric, so one request per refresh serves all three tracker metrics. Request from the Monday 8 weeks before the current week to the end of the current week.
- Always request `granularity=day` and sum day buckets into ISO weeks in the plugin, so a metric's timeframe in the tracker app (weekly or monthly) doesn't matter. Day buckets are local days in `USER_TZ` (Europe/London) and sum exactly to weekly totals for `timed` and `cumulative` metrics.
- `timed` values are minutes; `cumulative` values are sums. Every bucket also carries `entryCount`.
- Errors come back as `{ error: { code, message } }`; any error or network failure marks the tracker metrics stale.
- The API sends no CORS headers; that is fine because Obsidian's `requestUrl` makes native requests on desktop and mobile. Tracker values are fetched on both. Confirm on a real mobile device during the build.
- Entries in a phone's offline queue only appear after that device syncs, so **tracker week values always follow the API**: every fetch rewrites the tracker values for the weeks in its window, including frozen weeks.

### Manual entry

- **Year metrics:** you enter the 2027 running total so far; it replaces the previous entry.
- **Weekly metrics:** you enter one total for the week (or the latest reading for a level metric such as WAU); it replaces any earlier entry that week.
- The Enter values form lists only manual metrics and saves in one action. Year fields are pre-filled with their latest value. Weekly fields start blank, with last week's value shown as a hint. A blank field leaves that metric unchanged.

### Rules

- Every value carries its source and fetch time; hovering a value shows both.
- A failing adapter shows that metric as "stale" with its last good value and its age. It never shows zero.
- Manual entries and a week snapshot of every metric are saved to one data file in the vault (`🗺️ Plans/🎯 2027 Plan/scoreboard-data.json`). This is the source for history strips, so history survives restarts and syncs across devices.
- The data file is one JSON document that is overwritten on write. To limit losses from Obsidian Sync conflicts between devices, re-read the file immediately before every write and change only the fields that write touches, and only write when a value or verdict has actually changed (refreshes that change nothing write nothing).
- **Week snapshots** update on every refresh while the week is running, and are frozen at the first refresh after the week ends. A frozen snapshot stores the target that applied that week. For tracker metrics, values in frozen weeks still follow the API; only the target is frozen.

## Scoring rules

Scores must be deterministic and unit-tested, because the dashboard is only useful if its verdicts are trusted.

- **Weekly metric hit:** the week's value is at or above that week's target. During the current week the row shows progress ("N to go") and counts as hit as soon as the target is reached. It is only a miss once the week has ended.
- **Missing data:** a completed week with no value (no manual entry, or no tracker data) counts as **missed**. Weeks before the first week with any data for that metric are not shown and are never counted.
- **Target changes:** a frozen week is scored against the target it stored. The current week and all year metrics use the config as it stands.
- **This week score:** weekly metrics hit so far / number of weekly metrics.
- **Streak:** consecutive completed weeks hit, counting back from last week, plus the current week if already hit. It never counts back past the first week with data.
- **Year metric on pace:** the current value is at least `paceTolerance` × the plan curve's value for today.
- **Pace delta:** the current value minus the plan value, shown in the metric's own unit (£, points, count). Labels: delta ≥ 0 → "X ahead of pace"; delta < 0 but on pace → "On pace (−X)"; not on pace → "X behind pace".
- **Year to date score:** year metrics on pace / number of year metrics.
- **Goal badge:** metrics on track / scored metrics in that goal. Untargeted metrics are left out of both numbers. Colour as in Screen layout: a weekly metric still in progress counts as not on track in the numbers, but never makes the badge orange.
- **Week number:** ISO week of the current date in Europe/London; "Week N of 52" (53 in a 53-week year).
- **Review week:** Export and Start coaching chat cover the current ISO week. If the view is used on a Monday, they offer the just-finished week instead. No general week picker.
- **Status labels for export and coaching:** while the week is running, an unhit weekly metric reads "N to go"; once the week has ended, "Missed (N short)".

## Project links to Obsidian

Strategic projects are read from notes in the vault. The note is the source of truth, and the dashboard never stores project data of its own.

A note in the 🚀 Projects folder (subfolders included) is a strategic project if its frontmatter has `type: strategic-project`. Its fields:

```yaml
type: strategic-project
goal: career          # goal id from the config
status: active        # active | backlog | done | dropped
rank: 2               # backlog pull order; ignored when active
```

There is no `stage` field. Finishing a project means setting `status: done`, which removes it from the dashboard.

- **Active cards** show notes with `status: active`. If more than three are active, show all of them and turn the slot label orange ("4 of 3 slots in use").
- **Backlog** shows `status: backlog`, sorted by `rank` and then by title.
- **Next action** is the first unchecked task (`- [ ]`) under the note's `## Next actions` heading. If there is none, show "No next action" in orange, because a project without a concrete next step is stalled.
- **Malformed notes:** a strategic-project note with a missing or unknown `status` is left out and listed under "N project notes need fixing". A note whose `goal` isn't in the config is still shown, with a grey "unknown goal" tag.
- Clicking a project name opens its note in the current Obsidian workspace (the standard internal-link behaviour, so Ctrl/Cmd-click opens a new pane).
- Changes to project notes appear on the dashboard without a manual refresh (listen to vault metadata change events).

## Export to Obsidian

The button adds a Markdown log of the review week's scoreboard (see Review week) to the end of the 2027 Plan note (🗺️ Plans/🎯 2027 Plan/2027 Plan.md, set in settings). Each week gets one **scoreboard entry**. Exporting again in the same week replaces that week's entry in place rather than adding a duplicate. The entry sits between HTML comment markers, so it can be found and replaced reliably.

Entry format (exported on Sunday, so the week is still running):

```markdown
<!-- scoreboard:2027-W18 -->
## Scoreboard — Week 18 (3 May 2027)

This week: 2/5 weekly targets hit · Year to date: 3/6 on pace · Exported 2027-05-09 18:40

| Goal | Metric | Value | Target | Status |
| --- | --- | --- | --- | --- |
| Finances | Saved in Vanguard | £4,300 | £12,000 | £150 ahead of pace |
| Self | Meditation | 70 min | 100 min | 30 to go |

**Active projects**
- [[Project note A]] — Next: <first open task>
<!-- /scoreboard:2027-W18 -->
```

- Project names are wikilinks, so the log links back to the notes.
- Untargeted metrics are listed with status "No target".
- The export also writes that week's snapshot to the data file. The entry is a picture of the week **as of export time**; activity logged later in the week updates the data file but not the entry. Re-export to bring the entry up to date.
- Export is blocked while the config is invalid.
- On success, show a notice with a link to the entry. On failure, write nothing and show the error.

## Start coaching chat

The button opens Danny's ongoing coaching chat in the 2027 Planning project on claude.ai, with the latest results ready to send. As far as is known, claude.ai can prefill only a **new** chat (`claude.ai/new?q=…`), not an existing one (not verified, and it doesn't change the decision), and keeping the ongoing thread matters more than saving a paste. So v1 copies the context to the clipboard and opens the existing chat. The prompt is pasted by hand. (No further spike needed.)

Behaviour:

1. Build a context message from the review week's scoreboard (format below).
2. Copy it to the clipboard.
3. Open the coaching chat URL saved in settings. If none is saved, open the 2027 Planning project page and show a notice asking for the chat URL to be pasted into settings.
4. Show a notice: "Coaching context copied — paste it into the chat."

Context message:

```markdown
Weekly scoreboard check-in — Week 18 of 52 (3–9 May 2027)

Scores: this week 2/5 weekly targets hit; year 3/6 on pace.

Behind or missed:
- Self · Meditation: 70 / 100 min (30 to go; streak at risk after 3 weeks)
- Finances · Mortgage overpayment: £2,900 vs £3,460 planned (−£560)

On track: <one line per metric>
Changed since last export: <metrics whose status flipped>
Active projects: <name — next action, one per line>
Stale data: <metrics whose source failed, if any>

Coach me on this week: challenge where I'm drifting and help me pick next week's focus.
```

- **Changed since last export** compares each metric's status with the most recent export of an **earlier** week (re-exports of the current week are ignored). A weekly metric still in progress is left out unless it is already hit.
- The last line is a configurable prompt template in settings.

## Architecture and tech constraints

Build it as an Obsidian community-style plugin that adds a custom view, not as a separate web app. The vault is where projects, daily notes and the 2027 Plan already live. A plugin gets native read and write access to the vault, internal links, and mobile sync through Obsidian Sync with no hosting.

&#91;embedded content: architecture · 4 sources, 1 view, 2 outputs\]

Constraints:

- TypeScript with the Obsidian plugin API. Render the view with a small framework (Preact or Svelte) or plain DOM; no heavy dependencies, since it must load fast on mobile.
- Network calls only to the Tracker API, through Obsidian's `requestUrl`.
- The Tracker API key unlocks all tracker data. Store it in Obsidian's secret storage API if the running Obsidian version provides one (verify during the build); otherwise in plugin settings (`.obsidian/plugins/<id>/data.json`), with a note in the settings tab that this file sits in the vault folder and may sync. Never in a note or the scoreboard data file.
- Keep scoring and plan-curve logic as pure functions in their own module, with unit tests (Vitest) covering every rule in Scoring rules.
- Never edit any note except the 2027 Plan note's scoreboard entries and the two data files (scoreboard data file and plugin settings).
- Settings: config path, data file path, 2027 Plan note path, projects folder, Tracker API URL and key, coaching chat URL, coaching prompt template. (Pace tolerance is in the config, not settings.)

Default paths, all inside the vault. They contain emoji, so test Unicode path handling on desktop and mobile:

| Item | Path |
| --- | --- |
| 2027 Plan note | `🗺️ Plans/🎯 2027 Plan/2027 Plan.md` |
| Config | `🗺️ Plans/🎯 2027 Plan/scoreboard.yaml` |
| Data file | `🗺️ Plans/🎯 2027 Plan/scoreboard-data.json` |
| Project notes | `🚀 Projects/` |
| Daily notes | `📅 Daily/` (not read in v1) |

## Open questions and acceptance criteria

Open questions for Danny. The build can start without answers, because each one only changes config:

- EPs: release dates are unknown. The curve stays linear until they are set in config.
- ASL % and React platform %: the quarterly ramp ends at 100%, not the 50% goal stated earlier. The config uses 100%; confirm which is the year target.
- The tracker metric ids for Meditation, Feedback given and Homework time with N (the config validator will list them once the API key is set).

For Claude Code — work in this order:

1. ~~Spike the Tracker API~~ — done; see Tracker API above. Remaining: confirm `requestUrl` against it on Obsidian mobile.
2. ~~Spike claude.ai prefilled-message URLs~~ — not needed; v1 keeps the ongoing chat with clipboard copy.
3. Build the scoring and plan-curve module with tests, then the adapters, then the view, then the two buttons.

Acceptance criteria:

- [ ] The view opens from the command palette and a ribbon icon, on desktop and on Obsidian mobile.
- [ ] All 11 metrics render from the config file; changing a target in config updates the view on refresh, and frozen weeks keep their stored target.
- [ ] An invalid config shows a banner with line numbers, keeps the last valid config, and blocks export.
- [ ] Meditation, Feedback given and Homework time with N update from the Tracker API without any manual step, on desktop and mobile.
- [ ] Manual metrics are entered in one form (weekly fields blank with a last-week hint, year fields pre-filled) and persist across restarts and devices.
- [ ] Header scores and goal badges match the scoring rules, and every rule has a passing unit test.
- [ ] A failing source shows "stale" with the last good value, never zero.
- [ ] Up to three active projects and the ranked backlog appear from note frontmatter; each name opens its note; malformed notes are listed as needing fixes.
- [ ] Export adds one entry per week to the 2027 Plan note, and exporting again in the same week replaces it.
- [ ] Start coaching chat copies the context message and opens the saved chat URL.
- [ ] The layout works at 360 px and 1440 px widths, and every status has a text label as well as a colour.
