/**
 * Where the Tracker API key lives (brief › Architecture: secret storage if
 * the running Obsidian provides it, else plugin settings, never a note or
 * the scoreboard data file).
 *
 * Obsidian 1.11.4+ has `app.secretStorage` (`getSecret`, `setSecret`,
 * `listSecrets`). The manifest's minAppVersion is lower, so it is
 * feature-detected at runtime; without it the key falls back to the
 * plugin's settings (`.obsidian/plugins/<id>/data.json`). No `obsidian`
 * import, so it is unit-tested with a fake.
 */

/** The secret's id in Obsidian's secret storage (lowercase, digits and dashes). */
export const TRACKER_SECRET_ID = "weekly-scoreboard-tracker-api-key";

/** The part of Obsidian's SecretStorage used here. */
export interface SecretStorageLike {
  getSecret(id: string): string | null;
  setSecret(id: string, secret: string): void;
}

/** `app.secretStorage` if this Obsidian version has it, else null. */
export function secretStorageOf(app: unknown): SecretStorageLike | null {
  const s = (app as { secretStorage?: Partial<SecretStorageLike> } | null)?.secretStorage;
  return s && typeof s.getSecret === "function" && typeof s.setSecret === "function" ? (s as SecretStorageLike) : null;
}

export class TrackerApiKey {
  constructor(
    private readonly secrets: SecretStorageLike | null,
    /** The plugin settings object (fallback store). */
    private readonly settings: { trackerApiKey: string },
    private readonly saveSettings: () => Promise<void>,
  ) {}

  /** True when the key is kept in Obsidian's secret storage. */
  get usesSecretStorage(): boolean {
    return this.secrets !== null;
  }

  /** The key, or "" if none is set. */
  get(): string {
    if (this.secrets) return this.secrets.getSecret(TRACKER_SECRET_ID) ?? "";
    return this.settings.trackerApiKey;
  }

  async set(value: string): Promise<void> {
    if (this.secrets) {
      this.secrets.setSecret(TRACKER_SECRET_ID, value);
      if (this.settings.trackerApiKey !== "") {
        this.settings.trackerApiKey = "";
        await this.saveSettings();
      }
      return;
    }
    this.settings.trackerApiKey = value;
    await this.saveSettings();
  }

  /**
   * With secret storage: moves a key left in plugin settings (from an older
   * version or a device without secret storage) into it, unless one is
   * already stored, and removes it from settings.
   */
  async migrate(): Promise<void> {
    if (!this.secrets || this.settings.trackerApiKey === "") return;
    if (!this.secrets.getSecret(TRACKER_SECRET_ID)) this.secrets.setSecret(TRACKER_SECRET_ID, this.settings.trackerApiKey);
    this.settings.trackerApiKey = "";
    await this.saveSettings();
  }
}
