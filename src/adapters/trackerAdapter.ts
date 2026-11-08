/**
 * The `tracker` source adapter: one GET to the tracker Metrics API per
 * refresh serves every tracker metric (brief › Tracker API). The HTTP call is
 * injected (Obsidian's `requestUrl` in the plugin, a fake in tests); the
 * parsing and week bucketing are pure functions in `core/tracker.ts`.
 *
 * On success the week values for the whole window (8 completed weeks and the
 * current one) are written into the week snapshots, frozen weeks included,
 * and unknown tracker ids are reported as config problems (or cleared). On
 * any failure (no key, network error, HTTP 4xx/5xx, unreadable body) nothing
 * is written: the stored values stay and are shown stale.
 */
import {
  parseTrackerResponse,
  trackerApply,
  trackerMetrics,
  trackerRequestUrl,
  trackerWindow,
} from "../core/tracker";
import { calendarDateIn } from "../core/week";
import type { SourceAdapter, SourceRefreshContext, SourceRefreshResult } from "./types";

/** A GET request; resolves with the status and body for any status, rejects only on network failure. */
export type HttpGet = (url: string, headers: Record<string, string>) => Promise<{ status: number; text: string }>;

export interface TrackerAdapterDeps {
  http: HttpGet;
  /** Base URL from settings, read on every refresh. */
  apiUrl: () => string;
  /** API key (secret storage or settings), read on every refresh. Empty = not set. */
  apiKey: () => string;
}

export const TRACKER_ADAPTER_ID = "tracker";

export function createTrackerAdapter(deps: TrackerAdapterDeps): SourceAdapter {
  return {
    id: TRACKER_ADAPTER_ID,
    async refresh({ config, data, now }: SourceRefreshContext): Promise<SourceRefreshResult> {
      if (trackerMetrics(config).length === 0) return { status: null, patch: [], problems: [] };
      const nowIso = now.toISOString();
      const fail = (error: string): SourceRefreshResult => ({
        status: { ok: false, error, failedAt: nowIso, lastFetchedAt: null },
        patch: [],
        problems: null,
      });
      const key = deps.apiKey().trim();
      if (!key) return fail("No tracker API key set. Add it in Settings → 2027 Scoreboard.");
      const window = trackerWindow(calendarDateIn(now, config.timezone), config.timezone);
      let response;
      try {
        const res = await deps.http(trackerRequestUrl(deps.apiUrl(), window), {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        });
        response = parseTrackerResponse(res.status, res.text);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return fail(e instanceof Error && e.name === "TrackerError" ? message : `Couldn't reach the tracker API: ${message}`);
      }
      const { patch, problems } = trackerApply(config, data, response, window, nowIso);
      return { status: { ok: true, fetchedAt: nowIso }, patch, problems };
    },
  };
}
