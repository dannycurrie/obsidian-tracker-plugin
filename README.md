# 2027 Scoreboard (Obsidian plugin)

A Scoreboard view inside Obsidian showing whether this week's targets are hit and year metrics are on pace. Spec: `product-brief.md`; terms: `GLOSSARY.md`; tickets: `.scratch/2027-scoreboard/issues/`.

## Develop

Requires Node 18+.

```sh
npm install
npm run dev        # esbuild watch: rebuilds main.js on change
npm run build      # typecheck + production bundle to main.js
npm test           # Vitest, single run (npm run test:watch to watch)
npm run typecheck  # tsc --noEmit
```

## Source layout

- `src/core/` — pure domain logic (ISO weeks, settings defaults; later scoring, plan curves, config validation). Never imports `obsidian`. Tests sit next to the code as `*.test.ts`.
- `src/ui/` — Preact components. `ScoreboardApp.tsx` composes one component per section (`Header`, `GoalCards`, `Projects`, …).
- `src/obsidian/` — plugin entry (`main.ts`), the `ItemView`, settings tab, and later vault IO.
- `src/adapters/` — metric sources (manual, tracker), added in later tickets.

## Install into a vault

1. `npm run build`
2. Create `<vault>/.obsidian/plugins/weekly-scoreboard/`.
3. Copy `main.js`, `manifest.json` and `styles.css` into it.
4. In Obsidian: Settings → Community plugins → enable "2027 Scoreboard".
5. Open it from the ribbon (trophy icon) or the command palette: "2027 Scoreboard: Open scoreboard".

For mobile, put the same folder in the vault and let Obsidian Sync (or your sync tool) carry it to the device; sync must include community plugins.
