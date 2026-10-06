/**
 * Admin persist calls. Desk only. Student boards never import this.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=e80d53a-202610060435";
import { persistToken } from "./session.js?v=e80d53a-202610060435";

function endpoint() {
  return String(PERSIST.endpoint || "").replace(/\/$/, "");
}

export function persistAdminReady() {
  return Boolean(endpoint() && !isPlaceholder(PERSIST.endpoint) && persistToken());
}

async function request(method, path, body) {
  const token = persistToken();
  if (!token) {
    const error = new Error("persist token missing");
    error.code = "NO_TOKEN";
    throw error;
  }
  const res = await fetch(`${endpoint()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.error || `persist ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function listPersistSlugs() {
  if (!persistAdminReady()) return [];
  try {
    const body = await request("GET", "/students");
    return Array.isArray(body.slugs) ? body.slugs : [];
  } catch {
    return [];
  }
}

export function listLeads(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request("GET", `/leads${query}`);
}

export function addLead(fields) {
  return request("POST", "/leads", fields);
}

export function declineLead(id, note) {
  return request("PATCH", `/leads/${id}`, { status: "declined", note });
}

export function enrollStudent(fields) {
  return request("POST", "/students", fields);
}

export function enrollLead(id, fields = {}) {
  return request("POST", `/leads/${id}/enroll`, fields);
}

export function rotateSeatToken(slug) {
  return request("POST", `/students/${slug}/rotate-token`, {});
}

/** Merge identity fields (e.g. the Discord ID) without minting invites or tokens. */
export function updateIdentity(slug, fields) {
  return request("PATCH", `/students/${slug}/identity`, fields);
}

/** The live overrides document, fresh (not the page cache). */
export function fetchSiteOverrides() {
  return request("GET", "/site");
}

/** Replace the live overrides document. Every board sees it on next load. */
export function saveSiteOverrides(doc) {
  return request("POST", "/site", { doc });
}

export function listVideoPlans() {
  return request("GET", "/videos");
}

export function fetchVideoPlan(slug) {
  return request("GET", `/videos/${encodeURIComponent(slug)}`);
}

/**
 * `base` is the updated_at this copy was loaded at. A newer save on another
 * device answers 409 instead of being overwritten; `force` overwrites anyway.
 */
export function saveVideoPlan(slug, doc, { base = null, force = false } = {}) {
  return request("POST", `/videos/${encodeURIComponent(slug)}`, { doc, base, force });
}

/** The newest stored map of one status, or null when there is none. */
export async function fetchStudentMap(slug, status) {
  try {
    return await request("GET", `/students/${encodeURIComponent(slug)}/map?status=${encodeURIComponent(status)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** Save a new map version. A 400 carries `payload.errors` from validate_map. */
export function saveStudentMap(slug, map, status, context) {
  return request("PUT", `/students/${encodeURIComponent(slug)}/map`, { map, status, context });
}

/**
 * Open the builder's draft stream (POST with a bearer token, so not
 * EventSource). Resolves to the Response once the server has accepted the
 * request; its body is SSE. Refusals before the stream (400/403/503) throw like
 * any other admin call.
 */
export async function openMapDraft(slug, body, { signal } = {}) {
  const token = persistToken();
  if (!token) {
    const error = new Error("persist token missing");
    error.code = "NO_TOKEN";
    throw error;
  }
  const res = await fetch(`${endpoint()}/students/${encodeURIComponent(slug)}/map/draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const error = new Error(payload.error || `persist ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return res;
}
