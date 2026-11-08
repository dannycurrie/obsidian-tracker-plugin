import { describe, expect, it } from "vitest";
import { render } from "preact-render-to-string";
import { sampleConfig } from "../../tests/fixtures/sampleConfig";
import { buildProjectsModel, type ProjectNote } from "../core/projects";
import { initialScoreboardState } from "../core/viewState";
import { ProjectNotesNeedingFix, Projects } from "./Projects";
import { ScoreboardApp } from "./ScoreboardApp";

const goals = [
  { id: "career", name: "Career" },
  { id: "creative", name: "Creative" },
];

function note(title: string, overrides: Partial<ProjectNote> = {}): ProjectNote {
  return {
    path: `🚀 Projects/${title}.md`,
    title,
    status: "active",
    rawStatus: "active",
    goalId: "career",
    rank: null,
    nextAction: `Next for ${title}`,
    ...overrides,
  };
}

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("Projects", () => {
  it("renders nothing until notes are read", () => {
    expect(render(<Projects projects={null} />)).toBe("");
  });

  it("renders active cards with goal tag, linked name and next action", () => {
    const html = render(
      <Projects projects={buildProjectsModel([note("Tengu launch"), note("EP one", { goalId: "creative", nextAction: null })], goals)} />,
    );
    expect(html).toContain('data-href="🚀 Projects/Tengu launch.md"');
    expect(html).toContain('class="internal-link scoreboard-project__name"');
    expect(text(html)).toContain("Career Tengu launch Next: Next for Tengu launch");
    expect(text(html)).toContain("Creative EP one No next action");
    expect(html).toMatch(/class="scoreboard-project__next is-behind">No next action</);
    expect(html).toMatch(/class="scoreboard-projects__slots">2 of 3 slots in use</);
  });

  it("turns the slot label orange with words when more than three are active", () => {
    const html = render(<Projects projects={buildProjectsModel(["A", "B", "C", "D"].map((t) => note(t)), goals)} />);
    expect(html).toContain('class="scoreboard-projects__slots is-behind"');
    expect(text(html)).toContain("4 of 3 slots in use · over the limit");
    expect(html.match(/class="scoreboard-project"/g)).toHaveLength(4);
  });

  it("renders the backlog as a numbered list in pull order with goal tags", () => {
    const html = render(
      <Projects
        projects={buildProjectsModel(
          [
            note("Second", { status: "backlog", rank: 2 }),
            note("First", { status: "backlog", rank: 1, goalId: "nope" }),
          ],
          goals,
        )}
      />,
    );
    expect(html).toContain('<ol class="scoreboard-backlog__list">');
    expect(text(html)).toMatch(/First unknown goal Second Career/);
    expect(html).toContain('class="scoreboard-project-tag is-unknown"');
  });

  it("shows empty states", () => {
    const html = text(render(<Projects projects={buildProjectsModel([], goals)} />));
    expect(html).toContain("0 of 3 slots in use");
    expect(html).toContain("No active projects.");
    expect(html).toContain("The backlog is empty.");
  });
});

describe("ProjectNotesNeedingFix", () => {
  it("renders nothing when no notes need fixing", () => {
    expect(render(<ProjectNotesNeedingFix notes={[]} />)).toBe("");
  });

  it("lists each malformed note with a link and its problem", () => {
    const model = buildProjectsModel(
      [note("Typo", { status: null, rawStatus: "actve" }), note("Blank", { status: null, rawStatus: null })],
      goals,
    );
    const html = render(<ProjectNotesNeedingFix notes={model.malformed} />);
    expect(text(html)).toContain("2 project notes need fixing");
    expect(html).toContain('data-href="🚀 Projects/Typo.md"');
    expect(text(html)).toContain('Typo — unknown status &quot;actve&quot;');
    expect(text(html)).toContain("Blank — missing status");
  });
});

describe("ScoreboardApp with projects", () => {
  it("shows the fixing line near the header and the projects below the goal cards", () => {
    const state = { ...initialScoreboardState(), status: "ready" as const, config: sampleConfig(), configValid: true };
    const html = render(
      <ScoreboardApp
        today={{ year: 2027, month: 5, day: 5 }}
        state={state}
        projectNotes={[note("Tengu"), note("Broken", { status: null, rawStatus: "x" })]}
      />,
    );
    const fix = html.indexOf("1 project note needs fixing");
    const goalsAt = html.indexOf("scoreboard-goals");
    const projectsAt = html.indexOf("Active strategic projects");
    expect(fix).toBeGreaterThan(html.indexOf("scoreboard-header"));
    expect(fix).toBeLessThan(goalsAt);
    expect(projectsAt).toBeGreaterThan(goalsAt);
  });
});
