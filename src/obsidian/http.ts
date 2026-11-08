import { requestUrl } from "obsidian";
import type { HttpGet } from "../adapters/trackerAdapter";

/**
 * GET through Obsidian's `requestUrl`: a native request on desktop and
 * mobile, so the tracker API needs no CORS headers. `throw: false` hands
 * 4xx/5xx back with their body (the API's `{ error }`); network failures reject.
 */
export const obsidianHttpGet: HttpGet = async (url, headers) => {
  const res = await requestUrl({ url, method: "GET", headers, throw: false });
  return { status: res.status, text: res.text };
};
