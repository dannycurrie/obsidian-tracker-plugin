/**
 * The scoreboard data file (scoreboard-data.json): schema, tolerant reading,
 * and the pure "apply a patch to the latest document" step used on every
 * write. Pure: no Obsidian imports, no clock (callers pass timestamps).
 *
 * Write discipline (product brief › Rules): re-read the file immediately
 * before every write, change only the fields this write touches, and only
 * write when something actually changed. The IO side lives in
 * `src/obsidian/DataFileRepository.ts`; this module does the pure part:
 * `applyDataPatch(latestRawDocument, patch)`.
 *
 * Patches operate on the raw JSON document, not on the typed view, so fields
 * this version doesn't know (or entries it can't read) survive a write.
 *
 * Document shape (version 1):
 * {
 *   "version": 1,
 *   "manual": {
 *     "weekly": { "<metricId>": { "2027-W18": { "value": 40, "enteredAt": "<ISO instant>" } } },
 *     "latest": { "<metricId>": { "value": 4300, "enteredAt": "<ISO instant>" } }
 *   },
 *   "snapshots": { "2027-W18": WeekSnapshot },   // ticket 04
 *   "exports":   { "2027-W18": ExportRecord }    // ticket 09
 * }
 */

export const DATA_FILE_VERSION = 1;

/** One value typed into the Enter values form. */
export interface ManualEntry {
  value: number;
  /** ISO-8601 instant the value was saved. */
  enteredAt: string;
}

export interface ManualEntries {
  /** Per-week entries: metricId -> ISO week key ("2027-W18") -> entry. One per week; a new one replaces it. */
  weekly: Record<string, Record<string, ManualEntry>>;
  /**
   * Latest single value: metricId -> entry. Year metrics (the 2027 running
   * total, or the latest reading for a level metric) and ad-hoc untargeted
   * metrics. A new entry replaces it.
   */
  latest: Record<string, ManualEntry>;
}

/**
 * One metric's line in a week snapshot. Built and updated by
 * `src/core/snapshots.ts`; new fields must be optional (or bump the version).
 */
export interface WeekSnapshotMetric {
  /** The week value (weekly) or value at the time (year/untargeted); null = no data. */
  value: number | null;
  /**
   * The target that applied that week; null for untargeted. Once the
   * snapshot is frozen this never changes, and the week is scored against it.
   */
  target: number | null;
  /** Verdict at the time: weekly "hit" | "missed" | "in-progress" (year verdicts: ticket 03). */
  verdict?: string;
  /** Source and fetch time of the value (ticket 07 hover). */
  source?: "manual" | "tracker";
  fetchedAt?: string;
}

/** The recorded values and verdicts of every metric for one ISO week (ticket 04). */
export interface WeekSnapshot {
  /** True once the week has ended and the first refresh after it froze the snapshot. */
  frozen: boolean;
  /** ISO instant of the last update. */
  updatedAt: string;
  metrics: Record<string, WeekSnapshotMetric>;
}

/**
 * Record of the last export of a week (ticket 09; used for "Changed since
 * last export"). PLACEHOLDER shape, owned by ticket 09.
 */
export interface ExportRecord {
  exportedAt: string;
  /** metricId -> status label at export time. */
  statuses: Record<string, string>;
}

/** Typed view of the data file. */
export interface ScoreboardData {
  version: typeof DATA_FILE_VERSION;
  manual: ManualEntries;
  /** ISO week key -> snapshot. */
  snapshots: Record<string, WeekSnapshot>;
  /** ISO week key -> export record. */
  exports: Record<string, ExportRecord>;
}

/** A JSON object as read from disk. */
export type RawDataDocument = Record<string, unknown>;

export function emptyScoreboardData(): ScoreboardData {
  return { version: DATA_FILE_VERSION, manual: { weekly: {}, latest: {} }, snapshots: {}, exports: {} };
}

export class DataFileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataFileFormatError";
  }
}

/**
 * Parses data file text into a raw document. Empty or missing text gives a
 * new empty document. Throws DataFileFormatError if the text is not a JSON
 * object or has a version this build doesn't understand, so callers never
 * overwrite a file they can't read.
 */
export function parseDataDocument(text: string | null): RawDataDocument {
  if (text === null || text.trim() === "") return { version: DATA_FILE_VERSION };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new DataFileFormatError(`The data file is not valid JSON (${(e as Error).message}).`);
  }
  if (!isRecord(parsed)) throw new DataFileFormatError("The data file must contain a JSON object.");
  const version = parsed.version ?? DATA_FILE_VERSION;
  if (version !== DATA_FILE_VERSION) {
    throw new DataFileFormatError(
      `The data file has version ${JSON.stringify(version)}; this plugin understands version ${DATA_FILE_VERSION}. Update the plugin.`,
    );
  }
  return parsed;
}

/** Serialises a raw document for writing. */
export function serializeDataDocument(doc: RawDataDocument): string {
  return JSON.stringify(doc, null, 2) + "\n";
}

/**
 * Reads a raw document into the typed view, dropping (in the view only)
 * entries it can't read. Never throws.
 */
export function readScoreboardData(doc: RawDataDocument): ScoreboardData {
  const data = emptyScoreboardData();
  const manual = isRecord(doc.manual) ? doc.manual : {};

  for (const [metricId, weeks] of entriesOf(manual.weekly)) {
    const out: Record<string, ManualEntry> = {};
    for (const [weekKey, entry] of entriesOf(weeks)) {
      const e = readEntry(entry);
      if (e) out[weekKey] = e;
    }
    data.manual.weekly[metricId] = out;
  }
  for (const [metricId, entry] of entriesOf(manual.latest)) {
    const e = readEntry(entry);
    if (e) data.manual.latest[metricId] = e;
  }
  for (const [weekKey, snap] of entriesOf(doc.snapshots)) {
    const s = readSnapshot(snap);
    if (s) data.snapshots[weekKey] = s;
  }
  // Exports: shape owned by ticket 09; pass through objects as-is.
  for (const [weekKey, rec] of entriesOf(doc.exports)) {
    if (isRecord(rec)) data.exports[weekKey] = rec as unknown as ExportRecord;
  }
  return data;
}

/**
 * One change to the document: set the value at `path` (creating parent
 * objects as needed), or delete it when `value` is undefined.
 * Build ops with the helpers below (or add new helpers next to them).
 */
export interface DataPatchOp {
  path: readonly string[];
  value: unknown;
}

export type DataPatch = readonly DataPatchOp[];

/** Sets (or replaces) the manual entry for a metric in one ISO week. */
export function setManualWeeklyEntry(metricId: string, weekKey: string, entry: ManualEntry): DataPatchOp {
  return { path: ["manual", "weekly", metricId, weekKey], value: entry };
}

/** Sets (or replaces) a metric's latest manual value (year running total, ad-hoc reading). */
export function setManualLatestEntry(metricId: string, entry: ManualEntry): DataPatchOp {
  return { path: ["manual", "latest", metricId], value: entry };
}

/** Sets (or replaces) a whole week snapshot. Finer-grained ops live in snapshots.ts. */
export function setWeekSnapshot(weekKey: string, snapshot: WeekSnapshot): DataPatchOp {
  return { path: ["snapshots", weekKey], value: snapshot };
}

/** Sets (or replaces) a week's export record (ticket 09). */
export function setExportRecord(weekKey: string, record: ExportRecord): DataPatchOp {
  return { path: ["exports", weekKey], value: record };
}

export interface ApplyPatchResult {
  /** The new document (the input is not mutated). */
  doc: RawDataDocument;
  /** False if every op left its path's value deep-equal to before: don't write. */
  changed: boolean;
}

/**
 * Applies a patch to the latest document read from disk, touching only the
 * patched paths. Pure: returns a new document and whether anything changed.
 */
export function applyDataPatch(latest: RawDataDocument, patch: DataPatch): ApplyPatchResult {
  let doc: RawDataDocument = latest;
  let changed = false;
  for (const op of patch) {
    if (op.path.length === 0) throw new Error("A data patch op needs a non-empty path.");
    if (deepEqual(getAt(doc, op.path), op.value)) continue;
    doc = setAt(doc, op.path, op.value === undefined ? undefined : cloneJson(op.value));
    changed = true;
  }
  if (changed && doc.version === undefined) doc = { ...doc, version: DATA_FILE_VERSION };
  return { doc, changed };
}

function getAt(doc: unknown, path: readonly string[]): unknown {
  let cur: unknown = doc;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** Immutable set: copies only the objects along the path. */
function setAt(obj: RawDataDocument, path: readonly string[], value: unknown): RawDataDocument {
  const [key, ...rest] = path as [string, ...string[]];
  const copy: RawDataDocument = { ...obj };
  if (rest.length === 0) {
    if (value === undefined) delete copy[key];
    else copy[key] = value;
    return copy;
  }
  const child = isRecord(obj[key]) ? (obj[key] as RawDataDocument) : {};
  copy[key] = setAt(child, rest, value);
  return copy;
}

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Deep equality for JSON values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  const ar = a as Record<string, unknown>;
  const br = b as Record<string, unknown>;
  const ak = Object.keys(ar).filter((k) => ar[k] !== undefined);
  const bk = Object.keys(br).filter((k) => br[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => deepEqual(ar[k], br[k]));
}

function readEntry(v: unknown): ManualEntry | null {
  if (!isRecord(v) || typeof v.value !== "number" || !Number.isFinite(v.value)) return null;
  return { value: v.value, enteredAt: typeof v.enteredAt === "string" ? v.enteredAt : "" };
}

function readSnapshot(v: unknown): WeekSnapshot | null {
  if (!isRecord(v) || !isRecord(v.metrics)) return null;
  const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const metrics: Record<string, WeekSnapshotMetric> = {};
  for (const [metricId, line] of entriesOf(v.metrics)) {
    if (!isRecord(line)) continue;
    const out: WeekSnapshotMetric = { value: num(line.value), target: num(line.target) };
    if (typeof line.verdict === "string") out.verdict = line.verdict;
    if (line.source === "manual" || line.source === "tracker") out.source = line.source;
    if (typeof line.fetchedAt === "string") out.fetchedAt = line.fetchedAt;
    metrics[metricId] = out;
  }
  return { frozen: v.frozen === true, updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : "", metrics };
}

function entriesOf(v: unknown): [string, unknown][] {
  return isRecord(v) ? Object.entries(v) : [];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
