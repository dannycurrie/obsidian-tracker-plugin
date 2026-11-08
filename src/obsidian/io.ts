/**
 * Port for reading and writing vault text files. The Obsidian implementation
 * is `vaultIO.ts`; tests use an in-memory fake. Keep this file free of
 * `obsidian` imports so everything that depends on it stays testable.
 */
export interface TextFileIO {
  /** File text, or null if the file doesn't exist. */
  read(path: string): Promise<string | null>;
  /** Writes the whole file, creating parent folders as needed. */
  write(path: string, text: string): Promise<void>;
}
