/**
 * The job radar and the role pack, from the board and the desk.
 *
 *   matchedRoles   GET /roles/match: fresh radar roles scored against a title
 *                  cluster on the server (role_match.py), light rows only.
 *   prepareRole    POST /students/:slug/roles/pack: one role prepared for one
 *                  student (role_pack.py): fit, what to lead with, a note, who
 *                  to reach and what to say, a proof idea, likely questions.
 *
 * When the radar is off the match is simply empty and the page says so.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=15fea56-202610100117";
import { persistToken } from "./session.js?v=15fea56-202610100117";

export function radarReady() {
  return Boolean(persistToken() && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
}

async function call(method, path, body) {
  const response = await fetch(`${PERSIST.endpoint.replace(/\/$/, "")}${path}`, {
    method,
    headers: { Authorization: `Bearer ${persistToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `the server answered ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

/* The desk re-renders every 15 seconds; the radar changes every few hours. */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

export async function matchedRoles({ titles = [], years = null, days = 14, limit = 30, fresh = false } = {}) {
  if (!radarReady()) return { roles: [], off: true };
  const query = new URLSearchParams({ titles: titles.join("|"), days: String(days), limit: String(limit) });
  if (years != null) query.set("years", String(years));
  const key = query.toString();
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const result = { ...(await call("GET", `/roles/match?${key}`)), off: false };
  cache.set(key, { at: Date.now(), result });
  return result;
}

/** `roleKey` for a radar role, or `role` {title, company, description, url} for a pasted posting. */
export function prepareRole(slug, { roleKey, role }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/roles/pack`, roleKey ? { roleKey } : { role });
}

/** Their prepared roles kept on the server (Prepare and the overnight run), by role key. */
export async function fetchPacks(slug) {
  if (!radarReady()) return {};
  const payload = await call("GET", `/students/${encodeURIComponent(slug)}/roles/packs`);
  return payload.packs ?? {};
}
