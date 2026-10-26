/**
 * The studio's routes (server/studio_api.py): project ideas, the voice doc, post ideas and drafts.
 * Same shape as resume-remote.js: a failed call throws with the server's own sentence.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=4f66e99-202610260029";
import { persistToken } from "./session.js?v=4f66e99-202610260029";

export function studioReady() {
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
    error.payload = payload;
    throw error;
  }
  return payload;
}

const base = (slug) => `/students/${encodeURIComponent(slug)}/studio`;

export const loadStudio = (slug) => call("GET", base(slug));
export const makeProjects = (slug) => call("POST", `${base(slug)}/projects`, {});
export const pickProject = (slug, id) => call("POST", `${base(slug)}/pick`, { id });
export const buildVoice = (slug, samples) => call("POST", `${base(slug)}/voice`, { samples });
export const editVoice = (slug, edited) => call("POST", `${base(slug)}/voice`, { edited });
export const makePostIdeas = (slug) => call("POST", `${base(slug)}/post-ideas`, {});
export const draftFromIdea = (slug, ideaId) => call("POST", `${base(slug)}/draft`, { idea_id: ideaId });
export const draftOwnIdea = (slug, hook, angle) => call("POST", `${base(slug)}/draft`, { idea: { hook, angle } });
export const saveDraft = (slug, draftId, text) => call("POST", `${base(slug)}/save`, { draft_id: draftId, text });
export const markPosted = (slug, draftId, url) => call("POST", `${base(slug)}/posted`, { draft_id: draftId, url: url || undefined });
