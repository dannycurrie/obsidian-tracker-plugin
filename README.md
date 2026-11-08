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

- `src/core/` — pure domain logic. Never imports `obsidian` and never reads the clock (callers pass `today` / timestamps). Tests sit next to the code as `*.test.ts`.
  - `config.ts` config schema types; `configLoad.ts` YAML text → config with line-numbered problems (`yaml` package).
  - `data.ts` data file schema (versioned), tolerant reading, and `applyDataPatch` (patch the latest document, touching only patched fields).
  - `values.ts` metric values from sources; `weeklyScoring.ts` hit rule and This week score; `model.ts` + `rows/` the view model, one row builder per metric kind.
  - `enterValues.ts` Enter values form fields and submission → patch; `format.ts` number/unit copy; `week.ts` ISO weeks.
- `src/ui/` — Preact components. `ScoreboardApp.tsx` composes one component per section (`Header`, `ConfigBanner`, `GoalCards`, `Projects`, …); `MetricRows.tsx` has one row component per kind.
- `src/obsidian/` — plugin entry (`main.ts`), the `ItemView`, settings tab, Enter values modal, and vault IO. `ScoreboardStore` (view state, `reload()`, `updateData(patch)`) and `DataFileRepository` (re-read → patch → write if changed) talk to the vault only through the `TextFileIO` port, so they are unit-tested with an in-memory fake.
- `src/adapters/` — metric sources (tracker), added in later tickets.
- `tests/fixtures/` — sample config and test helpers. `examples/scoreboard.yaml` is a full 11-metric config for manual testing: copy it to the config path in settings.

## Install into a vault

1. `npm run build`
2. Create `<vault>/.obsidian/plugins/weekly-scoreboard/`.
3. Copy `main.js`, `manifest.json` and `styles.css` into it.
4. In Obsidian: Settings → Community plugins → enable "2027 Scoreboard".
5. Open it from the ribbon (trophy icon) or the command palette: "2027 Scoreboard: Open scoreboard".

For mobile, put the same folder in the vault and let Obsidian Sync (or your sync tool) carry it to the device; sync must include community plugins.
