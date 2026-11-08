import type { TextFileIO } from "../../src/obsidian/io";

/** In-memory TextFileIO for tests. `files` is inspectable; `writes` counts writes per path. */
export function memoryIO(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  /** Optional hook run after each read, to simulate another device writing in between. */
  let afterRead: ((path: string) => void) | null = null;
  const io: TextFileIO = {
    async read(path) {
      const text = files.get(path) ?? null;
      afterRead?.(path);
      return text;
    },
    async write(path, text) {
      writes.push(path);
      files.set(path, text);
    },
  };
  return {
    io,
    files,
    writes,
    onAfterRead(fn: ((path: string) => void) | null) {
      afterRead = fn;
    },
  };
}
