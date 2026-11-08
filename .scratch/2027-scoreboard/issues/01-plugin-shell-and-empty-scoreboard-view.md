# 01: Plugin shell and empty Scoreboard view

**What to build:** Danny installs the plugin and can open an (empty) Scoreboard view from a ribbon icon or the command palette, on desktop and Obsidian mobile. The header shows "Week N of 52" for today's ISO week in Europe/London (53 in a 53-week year). A settings tab holds config path, data file path, 2027 Plan note path, projects folder, Tracker API URL, coaching chat URL and coaching prompt template, with the default emoji paths from the brief. Build tooling and a Vitest setup exist so later tickets can work test-first.

See `product-brief.md` (Screen layout, Architecture) and `GLOSSARY.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The view opens from the ribbon icon and from a command palette command — implemented (`addRibbonIcon` + `open-scoreboard` command in `src/obsidian/main.ts`); builds and typechecks, but not run inside Obsidian (the agent could not launch Obsidian). Verify manually.
- [ ] The view loads on Obsidian mobile as well as desktop — `isDesktopOnly: false`, no Node/Electron APIs used; not verified on a device (the agent could not run Obsidian). Verify on desktop and mobile.
- [x] Header shows "Week N of 52" using the ISO week of the current date in Europe/London
- [x] ISO week calculation is a pure function with unit tests, including year boundaries (1–3 Jan 2027 fall in 2026-W53) and a 53-week year
- [x] Settings tab lists every setting from the brief with the default paths; pace tolerance is not a setting (defaults unit-tested; the tab itself not seen rendered in Obsidian)
- [x] Vitest runs from a single command (`npm test`)
