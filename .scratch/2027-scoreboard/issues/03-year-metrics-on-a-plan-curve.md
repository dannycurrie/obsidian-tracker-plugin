# 03: Year metrics on a plan curve

**What to build:** Year metrics render with value / target, a progress bar and a plan tick for today, and a pace label. Danny can see at a glance whether each year metric is on pace, and the header's *Year to date* tile shows year metrics on pace / number of year metrics.

Rules (all in `product-brief.md` Scoring rules):
- Plan curves over calendar 2027: `linear` (baseline to target), `quarterly` (target per quarter end, interpolated, starting from the baseline on 1 Jan), `milestones` (date/value steps, flat between steps).
- On pace: current value ≥ `paceTolerance` × plan value today. `paceTolerance` is a global config value (default 0.95) with an optional per-metric override.
- Labels: delta ≥ 0 → "X ahead of pace"; delta < 0 but on pace → "On pace (−X)"; not on pace → "X behind pace". Delta in the metric's own unit.
- Manual year entry is the 2027 running total so far, replacing the previous entry; the form pre-fills year fields with their latest value.
- A manual year value older than 4 weeks shows "updated N wks ago" and is still scored normally.

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** ready-for-agent

- [ ] All three curve types are pure functions with unit tests, including year start, quarter ends and between milestones
- [ ] On-pace rule, global and per-metric tolerance, pace delta and the three labels are unit-tested
- [ ] Year rows show value / target, progress bar, plan tick and the pace label
- [ ] *Year to date* tile is correct and unit-tested
- [ ] Enter values form pre-fills year fields; saving replaces the running total
- [ ] "updated N wks ago" appears only when a manual year value is more than 4 weeks old
