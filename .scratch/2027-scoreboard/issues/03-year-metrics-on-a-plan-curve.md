# 03: Year metrics on a plan curve

**What to build:** Year metrics render with value / target, a progress bar and a plan tick for today, and a pace label. Danny can see at a glance whether each year metric is on pace, and the header's *Year to date* tile shows year metrics on pace / number of year metrics.

Rules (all in `product-brief.md` Scoring rules):
- Plan curves over calendar 2027: `linear` (baseline to target), `quarterly` (target per quarter end, interpolated, starting from the baseline on 1 Jan), `milestones` (date/value steps, flat between steps).
- On pace: current value ≥ `paceTolerance` × plan value today. `paceTolerance` is a global config value (default 0.95) with an optional per-metric override.
- Labels: delta ≥ 0 → "X ahead of pace"; delta < 0 but on pace → "On pace (−X)"; not on pace → "X behind pace". Delta in the metric's own unit.
- Manual year entry is the 2027 running total so far, replacing the previous entry; the form pre-fills year fields with their latest value.
- A manual year value older than 4 weeks shows "updated N wks ago" and is still scored normally.

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** done

- [x] All three curve types are pure functions with unit tests, including year start, quarter ends and between milestones
- [x] On-pace rule, global and per-metric tolerance, pace delta and the three labels are unit-tested
- [x] Year rows show value / target, progress bar, plan tick and the pace label
- [x] *Year to date* tile is correct and unit-tested
- [x] Enter values form pre-fills year fields; saving replaces the running total
- [x] "updated N wks ago" appears only when a manual year value is more than 4 weeks old

**Notes (implementation):**
- Plan curves: `src/core/planCurve.ts` (`planValueOn`). Day-based: 1 Jan = baseline, 31 Dec = year-end value; clamped outside the year. Quarterly knots on 31 Mar, 30 Jun, 30 Sep, 31 Dec.
- Pace: `src/core/yearScoring.ts`. No value yet counts as 0. Pace deltas are rounded for display (whole numbers from 10 up, else 1 decimal); verdicts use the exact delta. A delta of exactly 0 reads "0 ahead of pace", as the rule says.
- "updated N wks ago" shows when a manual year value was entered more than 28 days ago (calendar days in the config timezone); N = whole weeks.
- Enter values pre-fill and replace-on-save already existed from ticket 02; a test now pins the replace behaviour.

**Manual checks in Obsidian:**
- Progress bar and plan tick look right (light and dark themes, 360 px and 1440 px).
- Year to date tile sits next to This week and wraps on mobile.
