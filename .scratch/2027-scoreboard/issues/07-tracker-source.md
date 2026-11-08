# 07: Tracker source

**What to build:** Meditation, Feedback given and Homework time with N fill themselves from the tracker Metrics API, with no manual step, on desktop and mobile. Values refresh when the view opens, on Refresh, and every 15 minutes while the view is open. Hovering any value (tracker or manual) shows its source and fetch time. If a source fails, the metric shows "stale" with its last good value and its age — never zero.

API facts (spike done; see `product-brief.md` › Tracker API and the tracker repo's `server/README.md`):
- `GET /v1/metrics?from&to&granularity=day` with a bearer key; one call returns every tracker metric. Window is half-open, max 2 years; encode `+` offsets.
- Always use day buckets and sum them into ISO weeks, so the metric's timeframe in the tracker app doesn't matter. `aggregate: sum` uses bucket `value`; `aggregate: count` uses `entryCount`.
- Config names a tracker metric by its id. An unknown or missing id is a config error that lists available tracker names and ids.
- Tracker week values always follow the API: each fetch rewrites values for weeks in its window, including frozen weeks (only their target stays frozen), because offline-queued entries can arrive late.
- Calls go through Obsidian's `requestUrl` (no CORS issue). Store the API key in Obsidian's secret storage if available; otherwise plugin settings, with a note in the settings tab that the file sits in the vault folder.

**Blocked by:** 04 (History strips and streaks), 06 (Config validation)

**Status:** done (live API and mobile verification pending, see below)

- [x] The three tracker metrics show current-week values and 8-week history from the API (verified against fixture responses through the store and view model; not yet against the live API)
- [x] Day-to-ISO-week bucketing and sum/count aggregation are unit-tested against recorded API responses, including a DST week (fixtures follow the documented response shape field for field, with the clocks-back 25 h and clocks-forward 23 h Sundays; they are not recordings of the live API, which needs the key)
- [x] Late-arriving entries update a frozen week's value but not its target
- [x] A failed or erroring request shows "stale" with the last good value and its age, never zero
- [x] Hover shows source and fetch time for every value (the value on every row; history-strip squares still show only the week value and verdict)
- [x] Refresh runs on open, on the Refresh button and every 15 minutes while the view is open
- [x] Unknown tracker id appears in the config banner with the list of available ids
- [x] API key uses secret storage when available, else plugin settings; never in a note or the data file
- [ ] Verified working on a real Obsidian mobile device

## Notes (build)

**Pending, needs Danny:** nothing here has called the live Tracker API (no key was available to the build), and nothing has run on Obsidian desktop or mobile. To check: set the key in settings, open the view, confirm the three metrics fill and the banner lists the real tracker names and ids for any placeholder `metric` ids (paste the right ids into the config). Then the same on a phone (`requestUrl` with no CORS headers).

- **Adapter interface:** `src/adapters/types.ts` (`SourceAdapter.refresh(ctx)` returns a status, a data-file patch and runtime config problems). The store runs adapters on every `reload()` before the snapshot step. Manual entry has no adapter: it needs no refresh step.
- **Where tracker values live:** in the week snapshots of the data file (`snapshotValuePatch`), for all 9 weeks in the window, frozen weeks included (target kept). `values.ts` reads tracker week values from there, so the last good value survives restarts. Writes only happen when a value changes.
- **Staleness:** `ScoreboardState.sources` holds each adapter's last outcome (kept in memory, not in the data file). After a failure, values show "stale · N h old" with the error in the hover; the header says which source failed. The age is counted from the last successful fetch this session or, after a restart, from when the stored value last changed (the fetch time isn't saved when nothing changed, so that refreshes write nothing).
- **API key:** the installed typings (obsidian 1.14.4) have `app.secretStorage: SecretStorage` (`getSecret`, `setSecret`, `listSecrets`; `@since 1.11.4`), `SecretComponent` (1.11.1/1.11.4) and a `secret` setting control (1.13.2). minAppVersion stays at 1.5.0: `app.secretStorage` is feature-detected. When it's there the key is stored under id `weekly-scoreboard-tracker-api-key` and any key left in settings is moved there and removed from `data.json`. Otherwise it goes in plugin settings, and the settings tab notes that the file sits in the vault folder and may sync. The secret storage path hasn't been tried in a running Obsidian.
- Not supported: tracker sources on year metrics (the fetch only covers 9 weeks), and `average` metrics (daily means would be summed).

