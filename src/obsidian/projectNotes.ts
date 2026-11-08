/**
 * Obsidian side of strategic projects (ticket 08): reads project notes from
 * the vault (read-only: nothing here ever writes a note), watches for
 * changes, and opens notes with standard internal-link behaviour.
 */
import { Keymap, TFile, type App, type Component } from "obsidian";
import { isInFolder, isStrategicProject, parseProjectNote, type ProjectNote } from "../core/projects";
import type { ProjectsStore } from "./ProjectsStore";

/**
 * Every strategic-project note under `folder` (subfolders included).
 * Frontmatter comes from the metadata cache; only strategic-project notes
 * have their text read (cachedRead) for the next action.
 */
export async function readProjectNotes(app: App, folder: string): Promise<ProjectNote[]> {
  const files = app.vault.getMarkdownFiles().filter((f) => isInFolder(f.path, folder));
  const notes: ProjectNote[] = [];
  for (const file of files) {
    const frontmatter = (app.metadataCache.getFileCache(file)?.frontmatter ?? null) as Record<string, unknown> | null;
    if (!isStrategicProject(frontmatter)) continue;
    const markdown = await app.vault.cachedRead(file);
    const note = parseProjectNote({ path: file.path, title: file.basename, frontmatter, markdown });
    if (note) notes.push(note);
  }
  return notes;
}

/**
 * Re-reads the projects whenever a note in the projects folder changes, is
 * renamed into or out of it, or is deleted, and once the metadata cache has
 * finished its first index. Events are registered on `owner` (the view), so
 * they are removed when it closes.
 */
export function watchProjectNotes(owner: Component, app: App, folder: () => string, store: ProjectsStore): void {
  const inFolder = (path: string) => isInFolder(path, folder());
  owner.registerEvent(
    app.metadataCache.on("changed", (file) => {
      if (inFolder(file.path)) store.scheduleReload();
    }),
  );
  let resolvedOnce = false;
  owner.registerEvent(
    app.metadataCache.on("resolved", () => {
      if (resolvedOnce) return;
      resolvedOnce = true;
      store.scheduleReload();
    }),
  );
  owner.registerEvent(
    app.vault.on("delete", (file) => {
      if (file instanceof TFile && inFolder(file.path)) store.scheduleReload();
    }),
  );
  owner.registerEvent(
    app.vault.on("rename", (file, oldPath) => {
      if (inFolder(file.path) || inFolder(oldPath)) store.scheduleReload();
    }),
  );
}

/**
 * Opens a note like an internal link: plain click in the current pane,
 * Ctrl/Cmd-click (or middle-click) in a new one.
 */
export function openProjectNote(app: App, path: string, event: MouseEvent): void {
  void app.workspace.openLinkText(path, "", Keymap.isModEvent(event));
}
