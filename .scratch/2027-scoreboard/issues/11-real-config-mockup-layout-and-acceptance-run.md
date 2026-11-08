# 11: Real 2027 config, mockup layout and acceptance run

**What to build:** The scoreboard is ready for Danny's 2027: the real config file defines all five goals and 11 metrics from the brief's table, the layout matches the "2027 scoreboard · 5 goals + projects" mockup artboard (minus the season tile and stage bar) from 360 px to 1440 px, and every acceptance criterion in the brief has been checked on desktop and mobile.

**Blocked by:** 05 (Goal badges and untargeted metrics), 07 (Tracker source), 08 (Strategic projects and backlog), 10 (Start coaching chat)

**Status:** ready-for-agent

- [ ] `scoreboard.yaml` defines all 11 metrics with the kinds, targets, plan curves and sources from the brief (tracker ids filled in from the API listing)
- [ ] Layout matches the mockup's type and spacing at 360 px and 1440 px; goal cards form a responsive grid
- [ ] Every status has a text label as well as a colour
- [ ] Emoji default paths work on desktop and Obsidian mobile
- [ ] Every acceptance criterion in `product-brief.md` is ticked, with any failures written up as new tickets
