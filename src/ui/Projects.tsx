import {
  needsFixingLabel,
  slotLabel,
  type MalformedProjectNote,
  type ProjectGoalTag,
  type ProjectsModel,
} from "../core/projects";

/** Opens a project note; the view decides current vs new pane from the event's modifier keys. */
export type OpenNoteHandler = (path: string, event: MouseEvent) => void;

export interface ProjectsProps {
  /** Null until the project notes have been read: renders nothing. */
  projects: ProjectsModel | null;
  onOpenNote?: OpenNoteHandler;
}

/**
 * Active strategic projects and backlog section (ticket 08): active cards
 * with goal tag, linked name and next action, the slot label, and the
 * numbered backlog in pull order.
 */
export function Projects({ projects, onOpenNote }: ProjectsProps) {
  if (!projects) return null;
  const { active, backlog, overSlotLimit } = projects;
  return (
    <div class="scoreboard-projects-row">
      <section class="scoreboard-section scoreboard-projects" aria-label="Active strategic projects">
        <header class="scoreboard-projects__header">
          <h2 class="scoreboard-projects__title">Active strategic projects</h2>
          <span class={`scoreboard-projects__slots${overSlotLimit ? " is-behind" : ""}`}>
            {slotLabel(projects)}
            {overSlotLimit && " · over the limit"}
          </span>
        </header>
        {active.length > 0 ? (
          <ul class="scoreboard-projects__cards">
            {active.map((p) => (
              <li key={p.path} class="scoreboard-project">
                <GoalTag tag={p.goal} />
                <ProjectLink path={p.path} title={p.title} onOpenNote={onOpenNote} class="scoreboard-project__name" />
                {p.nextAction !== null ? (
                  <div class="scoreboard-project__next">
                    <span class="scoreboard-project__next-label">Next: </span>
                    {p.nextAction}
                  </div>
                ) : (
                  <div class="scoreboard-project__next is-behind">No next action</div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p class="scoreboard-empty">No active projects.</p>
        )}
      </section>
      <section class="scoreboard-section scoreboard-backlog" aria-label="Backlog">
        <header class="scoreboard-projects__header">
          <h2 class="scoreboard-projects__title">Backlog</h2>
          <span class="scoreboard-projects__slots">in pull order</span>
        </header>
        {backlog.length > 0 ? (
          <ol class="scoreboard-backlog__list">
            {backlog.map((p) => (
              <li key={p.path} class="scoreboard-backlog__item">
                <ProjectLink path={p.path} title={p.title} onOpenNote={onOpenNote} class="scoreboard-backlog__name" />
                <GoalTag tag={p.goal} />
              </li>
            ))}
          </ol>
        ) : (
          <p class="scoreboard-empty">The backlog is empty.</p>
        )}
      </section>
    </div>
  );
}

export interface ProjectNotesNeedingFixProps {
  notes: readonly MalformedProjectNote[];
  onOpenNote?: OpenNoteHandler;
}

/** Header line "N project notes need fixing" with a link and the problem for each note. Nothing when none. */
export function ProjectNotesNeedingFix({ notes, onOpenNote }: ProjectNotesNeedingFixProps) {
  if (notes.length === 0) return null;
  return (
    <details class="scoreboard-project-fixes">
      <summary class="scoreboard-project-fixes__summary is-behind">{needsFixingLabel(notes.length)}</summary>
      <ul class="scoreboard-project-fixes__list">
        {notes.map((n) => (
          <li key={n.path}>
            <ProjectLink path={n.path} title={n.title} onOpenNote={onOpenNote} />
            <span class="scoreboard-project-fixes__problem"> — {n.problem}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function GoalTag({ tag }: { tag: ProjectGoalTag }) {
  return (
    <span class={`scoreboard-project-tag${tag.unknown ? " is-unknown" : ""}`} title={tag.goalId ?? undefined}>
      {tag.label}
    </span>
  );
}

function ProjectLink({
  path,
  title,
  onOpenNote,
  class: className,
}: {
  path: string;
  title: string;
  onOpenNote?: OpenNoteHandler;
  class?: string;
}) {
  const open = (e: MouseEvent) => {
    e.preventDefault();
    onOpenNote?.(path, e);
  };
  return (
    <a
      class={`internal-link${className ? ` ${className}` : ""}`}
      href={path}
      data-href={path}
      onClick={open}
      onAuxClick={(e) => {
        if (e.button === 1) open(e);
      }}
    >
      {title}
    </a>
  );
}
