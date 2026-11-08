/**
 * Loads and updates the scoreboard data file. No `obsidian` imports (IO comes
 * through TextFileIO), so it is unit-tested with a fake.
 *
 * Every update re-reads the file immediately before writing, applies the
 * patch to that latest document (changing only the patched fields), and
 * writes only if something changed. Updates from this process are queued so
 * they never interleave.
 */
import {
  applyDataPatch,
  parseDataDocument,
  readScoreboardData,
  serializeDataDocument,
  type DataPatch,
  type ScoreboardData,
} from "../core/data";
import type { TextFileIO } from "./io";

export interface DataUpdateResult {
  /** The data as written (or as read, if nothing changed). */
  data: ScoreboardData;
  /** Whether the file was written. */
  changed: boolean;
}

export class DataFileRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly io: TextFileIO,
    /** Read on every call so a settings change takes effect immediately. */
    private readonly path: () => string,
  ) {}

  /** Reads the data file. A missing file is empty data. Throws DataFileFormatError if unreadable. */
  async load(): Promise<ScoreboardData> {
    return readScoreboardData(parseDataDocument(await this.io.read(this.path())));
  }

  /**
   * Applies a patch to the latest file contents and writes if anything
   * changed. Throws (writing nothing) if the file is unreadable.
   */
  update(patch: DataPatch): Promise<DataUpdateResult> {
    const run = async (): Promise<DataUpdateResult> => {
      const path = this.path();
      const latest = parseDataDocument(await this.io.read(path));
      const { doc, changed } = applyDataPatch(latest, patch);
      if (changed) await this.io.write(path, serializeDataDocument(doc));
      return { data: readScoreboardData(doc), changed };
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
