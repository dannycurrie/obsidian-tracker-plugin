# 07: Tracker source

**What to build:** Meditation, Feedback given and Homework time with N fill themselves from the tracker Metrics API, with no manual step, on desktop and mobile. Values refresh when the view opens, on Refresh, and every 15 minutes while the view is open. Hovering any value (tracker or manual) shows its source and fetch time. If a source fails, the metric shows "stale" with its last good value and its age — never zero.

API facts (spike done; see `product-brief.md` › Tracker API and the tracker repo's `server/README.md`):
- `GET /v1/metrics?from&to&granularity=day` with a bearer key; one call returns every tracker metric. Window is half-open, max 2 years; encode `+` offsets.
- Always use day buckets and sum them into ISO weeks, so the metric's timeframe in the tracker app doesn't matter. `aggregate: sum` uses bucket `value`; `aggregate: count` uses `entryCount`.
- Config names a tracker metric by its id. An unknown or missing id is a config error that lists available tracker names and ids.
- Tracker week values always follow the API: each fetch rewrites values for weeks in its window, including frozen weeks (only their target stays frozen), because offline-queued entries can arrive late.
- Calls go through Obsidian's `requestUrl` (no CORS issue). Store the API key in Obsidian's secret storage if available; otherwise plugin settings, with a note in the settings tab that the file sits in the vault folder.

**Blocked by:** 04 (History strips and streaks), 06 (Config validation)

**Status:** ready-for-agent

- [ ] The three tracker metrics show current-week values and 8-week history from the API
- [ ] Day-to-ISO-week bucketing and sum/count aggregation are unit-tested against recorded API responses, including a DST week
- [ ] Late-arriving entries update a frozen week's value but not its target
- [ ] A failed or erroring request shows "stale" with the last good value and its age, never zero
- [ ] Hover shows source and fetch time for every value
- [ ] Refresh runs on open, on the Refresh button and every 15 minutes while the view is open
- [ ] Unknown tracker id appears in the config banner with the list of available ids
- [ ] API key uses secret storage when available, else plugin settings; never in a note or the data file
- [ ] Verified working on a real Obsidian mobile device
