# 05: Goal badges and untargeted metrics

**What to build:** Each goal card shows an "x / y on track" badge so Danny can see which goals are slipping. Untargeted metrics are supported: shown with their trend, labelled "no target set", and excluded from every score.

Rules:
- Badge: metrics on track / scored metrics in the goal; untargeted metrics are left out of both numbers. On track = hit (weekly) or on pace (year).
- Colour: blue if all scored metrics are on track; orange only if none is on track **and** at least one is actually behind or missed; grey otherwise. A weekly metric still in progress counts as not on track in the numbers but never turns the badge orange.
- Untargeted row: value, change against 4 weeks ago (↑ / ↓ / → with the number), and the 8-week strip without hit/miss colouring; no bar.
- Every status has a text label as well as a colour.

**Blocked by:** 03 (Year metrics on a plan curve), 04 (History strips and streaks)

**Status:** ready-for-agent

- [ ] Badge numbers and colour rule are pure functions with unit tests, including the Monday-morning case (all weekly rows in progress → grey, not orange)
- [ ] Untargeted metrics are excluded from header scores and badges (tested)
- [ ] An untargeted metric in config renders with "no target set", the 4-week change and an uncoloured strip
