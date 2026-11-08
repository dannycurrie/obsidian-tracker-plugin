import { describe, expect, it, vi } from "vitest";
import { secretStorageOf, TRACKER_SECRET_ID, TrackerApiKey, type SecretStorageLike } from "./trackerApiKey";

function fakeSecrets(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const secrets: SecretStorageLike = {
    getSecret: (id) => map.get(id) ?? null,
    setSecret: (id, v) => void map.set(id, v),
  };
  return { map, secrets };
}

describe("secretStorageOf", () => {
  it("finds app.secretStorage only when it has the methods", () => {
    const { secrets } = fakeSecrets();
    expect(secretStorageOf({ secretStorage: secrets })).toBe(secrets);
    expect(secretStorageOf({})).toBeNull(); // Obsidian before 1.11.4
    expect(secretStorageOf({ secretStorage: {} })).toBeNull();
    expect(secretStorageOf(null)).toBeNull();
  });

  it("uses a valid secret id (lowercase letters, digits, dashes)", () => {
    expect(TRACKER_SECRET_ID).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("TrackerApiKey", () => {
  it("keeps the key in secret storage, never in settings", async () => {
    const { map, secrets } = fakeSecrets();
    const settings = { trackerApiKey: "" };
    const save = vi.fn(async () => {});
    const key = new TrackerApiKey(secrets, settings, save);
    await key.set("secret-key");
    expect(map.get(TRACKER_SECRET_ID)).toBe("secret-key");
    expect(settings.trackerApiKey).toBe("");
    expect(save).not.toHaveBeenCalled();
    expect(key.get()).toBe("secret-key");
    expect(key.usesSecretStorage).toBe(true);
  });

  it("moves a key left in settings into secret storage and clears it from settings", async () => {
    const { map, secrets } = fakeSecrets();
    const settings = { trackerApiKey: "old-key" };
    const save = vi.fn(async () => {});
    await new TrackerApiKey(secrets, settings, save).migrate();
    expect(map.get(TRACKER_SECRET_ID)).toBe("old-key");
    expect(settings.trackerApiKey).toBe("");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps an existing secret over a key found in settings", async () => {
    const { map, secrets } = fakeSecrets({ [TRACKER_SECRET_ID]: "current" });
    const settings = { trackerApiKey: "stale" };
    await new TrackerApiKey(secrets, settings, async () => {}).migrate();
    expect(map.get(TRACKER_SECRET_ID)).toBe("current");
    expect(settings.trackerApiKey).toBe("");
  });

  it("falls back to plugin settings without secret storage", async () => {
    const settings = { trackerApiKey: "" };
    const save = vi.fn(async () => {});
    const key = new TrackerApiKey(null, settings, save);
    await key.migrate();
    expect(save).not.toHaveBeenCalled();
    await key.set("k");
    expect(settings.trackerApiKey).toBe("k");
    expect(save).toHaveBeenCalledTimes(1);
    expect(key.get()).toBe("k");
    expect(key.usesSecretStorage).toBe(false);
  });
});
