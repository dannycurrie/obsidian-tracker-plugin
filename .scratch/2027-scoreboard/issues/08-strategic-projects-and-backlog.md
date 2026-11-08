# 08: Strategic projects and backlog

**What to build:** Below the goal cards, Danny sees his active strategic projects and his backlog, read live from notes in the projects folder (subfolders included) whose frontmatter has `type: strategic-project`. The notes are the source of truth; the dashboard stores no project data.

Rules:
- Fields: `goal` (goal id), `status` (active | backlog | done | dropped), `rank` (backlog pull order). There is no stage.
- Active cards: goal tag, project name linking to the note, next action. Label "N of 3 slots in use"; if more than three are active, show all and turn the label orange.
- Next action: first unchecked task under the note's "Next actions" heading; if none, "No next action" in orange.
- Backlog: `status: backlog`, numbered, sorted by rank then title, each with a goal tag and a link.
- Malformed notes (missing or unknown status) are left out and listed under "N project notes need fixing" with links. An unknown goal shows a grey "unknown goal" tag.
- Clicking a name opens the note with standard internal-link behaviour (Ctrl/Cmd-click opens a new pane).
- Edits to project notes appear without a manual refresh.

**Blocked by:** 02 (A weekly manual metric, end to end)

**Status:** ready-for-agent

- [ ] Active cards and backlog render from note frontmatter with correct ordering
- [ ] Slot label turns orange with more than three active projects
- [ ] Next action extraction and the "No next action" case are unit-tested
- [ ] Malformed notes are listed as needing fixes; unknown goals get a grey tag
- [ ] Project names open their notes; Ctrl/Cmd-click opens a new pane
- [ ] Editing a project note's frontmatter or next actions updates the view without Refresh
- [ ] No project note is ever written to
