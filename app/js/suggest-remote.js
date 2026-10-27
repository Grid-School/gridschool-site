/**
 * The student's suggested map changes, to and from the server (maps_api.py).
 *
 *   listSuggestions   GET  /students/:slug/map/proposals   newest first
 *   sendSuggestion    POST /students/:slug/map/proposals   {base, ops, note}; supersedes an open one
 *   withdrawSuggestion POST /students/:slug/map/proposals/:id {action: "withdraw"}
 *
 * The draft being built lives in this browser until it is sent, so a reload
 * mid-thought keeps it. Nothing here can write the map itself.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=fc888f8-202610270442";
import { persistToken } from "./session.js?v=fc888f8-202610270442";

export function suggestReady(slug) {
  return Boolean(slug && slug !== "demo" && persistToken() && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
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
    error.errors = payload.errors ?? [];
    throw error;
  }
  return payload;
}

const path = (slug) => `/students/${encodeURIComponent(slug)}/map/proposals`;

export async function listSuggestions(slug) {
  const body = await call("GET", path(slug));
  return Array.isArray(body.proposals) ? body.proposals : [];
}

export async function sendSuggestion(slug, { base, ops, note }) {
  return (await call("POST", path(slug), { base, ops, note })).proposal;
}

export async function withdrawSuggestion(slug, id) {
  return (await call("POST", `${path(slug)}/${id}`, { action: "withdraw" })).proposal;
}

/* ---------- the draft, kept in this browser ---------- */

const key = (slug) => `gridschool.suggest.v1.${slug}`;

export function readDraft(slug) {
  try {
    const value = JSON.parse(localStorage.getItem(key(slug)) ?? "null");
    return value && Array.isArray(value.ops) ? value : null;
  } catch {
    return null;
  }
}

export function writeDraft(slug, draft) {
  try {
    if (draft && draft.ops.length) localStorage.setItem(key(slug), JSON.stringify(draft));
    else localStorage.removeItem(key(slug));
  } catch {
    /* private mode: the draft lives as long as the tab */
  }
}

/** A resolved suggestion the student has read the answer to. */
const seenKey = (slug) => `gridschool.suggest.seen.v1.${slug}`;

export function answerSeen(slug, id) {
  try {
    return localStorage.getItem(seenKey(slug)) === String(id);
  } catch {
    return false;
  }
}

export function markAnswerSeen(slug, id) {
  try {
    localStorage.setItem(seenKey(slug), String(id));
  } catch {
    /* fine */
  }
}
