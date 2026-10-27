/**
 * Where you're going (server/path_api.py): the questions, the honest read, the titles chosen. Every write
 * sends the version it read; a 409 answers with the current record, which the page takes and keeps going.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=89ee485-202610270208";
import { persistToken } from "./session.js?v=89ee485-202610270208";

export function pathReady() {
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

const base = (slug) => `/students/${encodeURIComponent(slug)}/path`;

export const loadPath = (slug) => call("GET", base(slug));
export const answerPath = (slug, version, id, answer) => call("POST", `${base(slug)}/answer`, { version, id, answer });
export const skipPath = (slug, version, id) => call("POST", `${base(slug)}/answer`, { version, id, skip: true });
export const assessPath = (slug, version, run) => call("POST", `${base(slug)}/assess`, { version, run });
export const chooseTitles = (slug, version, titles, run) => call("POST", `${base(slug)}/choose`, { version, titles, run });
