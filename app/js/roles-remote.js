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

import { PERSIST, isPlaceholder } from "../../config.js?v=759fedf-202610271938";
import { persistToken } from "./session.js?v=759fedf-202610271938";

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

/** Whether #wins is set up, and which of their sends they've already shared ("appId:stage"). */
export async function winsState(slug) {
  if (!radarReady()) return { on: false, shared: [] };
  return call("GET", `/students/${encodeURIComponent(slug)}/wins`);
}

/**
 * Share one of their own sends to #wins (community_jobs.py). The server writes the message from their
 * record: first name, the stage, the company only when they ticked it. `dryRun` returns that text only.
 */
export function shareWin(slug, { appId, includeCompany = false, dryRun = false }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/wins/share`, { appId, includeCompany, dryRun });
}

/** A multi-channel campaign for one target (campaign_draft.py): radar roleKey, or a role {company, title, url, description}. */
/** This month's campaign drafts for a seat: {limit, used, left}; limit -1 means unlimited (the desk). */
export function campaignAllowance(slug) {
  return call("GET", `/students/${encodeURIComponent(slug)}/campaign/allowance`);
}

export function draftCampaign(slug, { roleKey, role, insider = "", portfolio = "" }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/campaign/draft`, { ...(roleKey ? { roleKey } : { role }), insider, portfolio });
}

/**
 * Their own positioning (positioning_api.py): headline, About, story and the titles to search under, drafted
 * from the lines they confirmed in the resume builder. Saved to their profile unless their coach wrote one.
 */
export function draftPositioning(slug, { goal = "" } = {}) {
  return call("POST", `/students/${encodeURIComponent(slug)}/career/position`, goal ? { goal } : {});
}
