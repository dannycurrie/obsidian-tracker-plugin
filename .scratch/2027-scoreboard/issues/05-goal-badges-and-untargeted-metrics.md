# 05: Goal badges and untargeted metrics

**What to build:** Each goal card shows an "x / y on track" badge so Danny can see which goals are slipping. Untargeted metrics are supported: shown with their trend, labelled "no target set", and excluded from every score.

Rules:
- Badge: metrics on track / scored metrics in the goal; untargeted metrics are left out of both numbers. On track = hit (weekly) or on pace (year).
- Colour: blue if all scored metrics are on track; orange only if none is on track **and** at least one is actually behind or missed; grey otherwise. A weekly metric still in progress counts as not on track in the numbers but never turns the badge orange.
- Untargeted row: value, change against 4 weeks ago (↑ / ↓ / → with the number), and the 8-week strip without hit/miss colouring; no bar.
- Every status has a text label as well as a colour.

**Blocked by:** 03 (Year metrics on a plan curve), 04 (History strips and streaks)

**Status:** done

- [x] Badge numbers and colour rule are pure functions with unit tests, including the Monday-morning case (all weekly rows in progress → grey, not orange)
- [x] Untargeted metrics are excluded from header scores and badges (tested)
- [x] An untargeted metric in config renders with "no target set", the 4-week change and an uncoloured strip (verified in render tests; check by eye in Obsidian)

Notes:
- `src/core/goalBadge.ts`: `metricTrackState(row)` gives each row's verdict (`on-track` / `behind` / `in-progress` / `unscored`), reusable by export and coaching; `goalBadge(rows)` → `{ onTrack, scored, tone }`; `goalBadgeLabel`. `GoalCardModel.badge` holds it.
- A goal with no scored metrics (none, or only untargeted) shows a grey "no targets set" badge instead of "0 / 0 on track".
- Orange needs a year metric behind pace (or a missed weekly row, which cannot happen in the current week). So a goal whose year metric is behind and whose weekly metric is still in progress is orange.
- `src/core/trend.ts`: a past week's value is the week snapshot's stored value, else the source for per-week metrics. Ad-hoc metrics have past values only through snapshots. Change = current value − the value 4 weeks back (`current − 4`). There is no change when either value is missing. For a per-week accumulating metric this compares this week so far with that whole week.
- `TrendStrip` in `HistoryStrip.tsx` is the neutral strip: grey squares, dashed outline for a week with no data, and each square labelled with its value.
- Test fixture: added `resting-hr` (untargeted, ad hoc, bpm) to Self. `gigs` (untargeted, weekly cadence) was already there.
- Manual check in Obsidian (not done here): the badge's look and wrapping in the card header at 360 px and 1440 px, and the neutral strip's contrast in light and dark themes.
