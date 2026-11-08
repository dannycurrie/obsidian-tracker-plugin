# 2027 Scoreboard

A personal scoreboard inside Obsidian that shows whether Danny is winning this week and on pace for the year across five goals, alongside the strategic projects being worked on.

## Goals and metrics

**Goal**:
One of the five life areas (Finances, Career, Family, Self, Creative), each with a one-line statement.
_Avoid_: Area, category, (using "goal" for a number)

**Metric**:
A measured quantity belonging to exactly one goal, of kind weekly, year or untargeted.
_Avoid_: KPI, measure, stat

**Target**:
The number a metric is scored against: per ISO week for weekly metrics, by 31 December for year metrics.
_Avoid_: Goal (as a number)

**Weekly metric**:
A metric scored once per ISO week of 2027 (Monday to Sunday, Europe/London); its week value is a single week total, or the latest reading for a level metric.

**Year metric**:
A metric scored against a plan curve over calendar 2027; its value is the 2027 running total so far, or the latest reading for a level metric.

**Untargeted metric**:
A metric shown with its trend but excluded from every score.

**Level metric**:
A metric whose value is a reading of a current state (e.g. WAU, % migrated) rather than an accumulated amount.
_Avoid_: Snapshot metric, gauge

**Source**:
Where a metric's values come from: the tracker app (via its Metrics API) or manual entry in the Enter values form.
_Avoid_: Provider, feed, integration

**Plan curve**:
The expected value of a year metric on any date of the year: linear, quarterly or milestones.
_Avoid_: Pace line, trajectory

## Verdicts

**Hit**:
A weekly metric whose week value has reached its target.

**Missed**:
A weekly metric whose week has ended without being hit, including a week with no data.

**On pace**:
A year metric whose current value is within the pace tolerance of its plan curve today.
_Avoid_: On target, ahead

**On track**:
The shared verdict across kinds: hit for a weekly metric, on pace for a year metric.

**Streak**:
The run of consecutive weeks a weekly metric was hit, counting back from last week, plus the current week if already hit.

## Records

**Week snapshot**:
The recorded values and verdicts of every metric for one ISO week; it keeps changing until the week ends, then is frozen.
_Avoid_: History entry, week record

**Stale**:
A metric whose source failed on the last refresh, shown with its last good value and that value's age.

**Scoreboard entry**:
The log of one week's scoreboard in the 2027 Plan note, as it stood at export time; one per week, replaced on re-export.
_Avoid_: Export, weekly log, report

## Projects

**Strategic project**:
A note in the Projects folder marked as a strategic project, linked to one goal, with a status of active, backlog, done or dropped.
_Avoid_: Initiative, epic

**Backlog**:
The strategic projects with status backlog, in pull order.

**Next action**:
The first unchecked task under a strategic project's "Next actions" heading.
