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

import { PERSIST, isPlaceholder } from "../../config.js?v=3a2df55-202611042206";
import { persistToken } from "./session.js?v=3a2df55-202611042206";
import { plainError } from "./plain-error.js?v=3a2df55-202611042206";

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
    const error = plainError(response.status, payload);
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
 * The approach to one target (approach_draft.py): the company model, the people ladder with peers first, the
 * hooks, the call sheet and the warm path up. Then the first no-ask note to one person the student found.
 */
export function draftApproach(slug, { roleKey, role }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "approach", ...(roleKey ? { roleKey } : { role }) });
}

export function draftNote(slug, { company, person, approach }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "note", company, person, approach });
}

/** Who to write to, from a pasted LinkedIn results page: picks with a plain reason each, and who to skip. */
export function pickPeople(slug, { company, roleKey, role, approach, text }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "pick", company, ...(roleKey ? { roleKey } : role ? { role } : {}), approach, text });
}

/** What someone wrote back, read: which kind of reply it is and the next line to send (approach_draft.py). */
export function draftReply(slug, { company, person, approach, text, sent }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "reply", company, person, approach, text, sent });
}

/** The note to the hiring manager, written once the name and the call's handle exist (approach_draft.py). */
export function draftManager(slug, { company, manager, peer, handle }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "manager", company, manager, peer, handle });
}

/** How to reach one person by email: the page, their GitHub commits, the company's pattern, the web (reach.py). */
export function findReach(slug, { company, person, text, domain, known, knownNames }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "reach", company, person, text, domain, known, knownNames });
}

/** One person's pasted profile page, read: how long they've been there, shared ground, whether they're active,
 * where to send it, the one thing to write about, and the first note. */
export function readProfile(slug, { company, person, approach, text }) {
  return call("POST", `/students/${encodeURIComponent(slug)}/approach/draft`, { kind: "profile", company, person, approach, text });
}

/**
 * Their own positioning (positioning_api.py): headline, About, story and the titles to search under, drafted
 * from the lines they confirmed in the resume builder. Saved to their profile unless their coach wrote one.
 */
export function draftPositioning(slug, { goal = "" } = {}) {
  return call("POST", `/students/${encodeURIComponent(slug)}/career/position`, goal ? { goal } : {});
}
