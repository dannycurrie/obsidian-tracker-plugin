# 10: Start coaching chat

**What to build:** One click on Start coaching chat copies a context message for the review week to the clipboard and opens Danny's ongoing coaching chat on claude.ai, with a notice: "Coaching context copied — paste it into the chat." If no chat URL is saved, it opens the 2027 Planning project page and asks for the chat URL to be pasted into settings. Message format is in `product-brief.md` › Start coaching chat.

Rules:
- Message: week and dates, both scores, behind or missed metrics with numbers, on-track metrics, changed since last export, active projects (name — next action), stale data, then the configurable prompt template from settings.
- Changed since last export: compare each metric's status with the most recent export of an earlier week (ignore re-exports of the current week). Omit weekly metrics still in progress unless already hit.
- Uses the same review week and status labels as Export.
- Keeps the ongoing chat; no prefilled-URL integration in v1.

**Blocked by:** 09 (Export to Obsidian)

**Status:** ready-for-agent

- [ ] Context message rendering is a pure function with unit tests, including "changed since last export" and the in-progress exclusion
- [ ] Clicking the button copies the message and opens the saved chat URL, on desktop and mobile
- [ ] With no saved URL, the project page opens and a notice asks for the chat URL
- [ ] The final line comes from the prompt template setting
