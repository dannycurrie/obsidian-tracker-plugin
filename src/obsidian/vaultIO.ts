import { normalizePath, type DataAdapter } from "obsidian";
import type { TextFileIO } from "./io";

/**
 * TextFileIO over the vault adapter. Works on desktop and mobile and with the
 * emoji default paths; doesn't depend on the file being indexed by the vault.
 */
export function vaultTextIO(adapter: DataAdapter): TextFileIO {
  return {
    async read(path) {
      const p = normalizePath(path);
      return (await adapter.exists(p)) ? adapter.read(p) : null;
    },
    async write(path, text) {
      const p = normalizePath(path);
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) {
        const dir = parts.slice(0, i).join("/");
        if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
      }
      await adapter.write(p, text);
    },
  };
}
