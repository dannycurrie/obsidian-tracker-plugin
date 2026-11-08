# 10: Start coaching chat

**What to build:** One click on Start coaching chat copies a context message for the review week to the clipboard and opens Danny's ongoing coaching chat on claude.ai, with a notice: "Coaching context copied — paste it into the chat." If no chat URL is saved, it opens the 2027 Planning project page and asks for the chat URL to be pasted into settings. Message format is in `product-brief.md` › Start coaching chat.

Rules:
- Message: week and dates, both scores, behind or missed metrics with numbers, on-track metrics, changed since last export, active projects (name — next action), stale data, then the configurable prompt template from settings.
- Changed since last export: compare each metric's status with the most recent export of an earlier week (ignore re-exports of the current week). Omit weekly metrics still in progress unless already hit.
- Uses the same review week and status labels as Export.
- Keeps the ongoing chat; no prefilled-URL integration in v1.

**Blocked by:** 09 (Export to Obsidian)

**Status:** done

- [x] Context message rendering is a pure function with unit tests, including "changed since last export" and the in-progress exclusion
- [x] Clicking the button copies the message and opens the saved chat URL, on desktop and mobile (unit-tested with fakes; real clipboard / URL opening still to check by hand, see below)
- [x] With no saved URL, the project page opens and a notice asks for the chat URL
- [x] The final line comes from the prompt template setting

## Notes (implementation)

- `src/core/coachingMessage.ts` (`renderCoachingMessage`, `changesSinceLastExport`) renders from `buildReviewReport`, so labels and the review week match Export. Tests: `coachingMessage.test.ts`.
  - Sections are "Heading:" plus "- " lines; an empty section reads "Heading: none". "Stale data: none" is always shown (tells the coach the data is fresh). Untargeted metrics get their own "No target:" section, omitted when there are none.
  - Weekly lines: "value / target unit (N to go)", "(missed by N)", "(hit; streak N)"; a previous streak of 2+ adds "streak at risk after N weeks" (week running) or "streak broken after N weeks" (ended). Year lines: "£X vs £Y planned (−£Z)", plus ", within tolerance" when below plan but on pace.
  - Changed since last export: the latest export of an earlier week (re-exports of the review week ignored); weekly baselines come from that week's frozen snapshot verdict when there is one, else the record's state. Weekly metrics in progress now are left out; heading names the compared week. No earlier export → "Changed since last export: No earlier export".
- `src/obsidian/startCoachingChat.ts`: refresh (in the view) → build → copy → open. Refuses only with no config or an unreadable data file; an invalid config warns that the last valid config is used (only Export is blocked). Copy failure still opens the chat and the notice says copying failed. No URL or a non-http(s) URL opens https://claude.ai/projects with a notice asking for the chat URL in settings. Blank prompt template falls back to the default.

## Manual checks in Obsidian (not yet done)

- [ ] Desktop: click Start coaching chat → the clipboard holds the message (paste into a note), the saved chat opens in the browser, notice "Coaching context copied — paste it into the chat."
- [ ] Mobile (iOS/Android): same; check `navigator.clipboard.writeText` works and that `window.open` opens the chat (in-app browser or the Claude app). (Ticket 11 removed the refresh `await` before the copy: copy and open now run synchronously in the tap, from the current state.)
- [ ] With the URL setting empty: claude.ai/projects opens and the settings notice shows.
