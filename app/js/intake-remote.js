/**
 * The seat's intake on the server: read it, save one chunk (server/intake_api.py), and ask for the map to
 * rebuild itself from the answers (server/onboarding_api.py). The seat's own token, like resume-remote.js.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=9300f22-202610261745";
import { persistToken } from "./session.js?v=9300f22-202610261745";

export function intakeReady() {
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

const seat = (slug) => `/students/${encodeURIComponent(slug)}`;

export const loadIntake = (slug) => call("GET", `${seat(slug)}/intake`);
export const saveChunk = (slug, body) => call("PUT", `${seat(slug)}/intake`, body);
export const rebuildMap = (slug) => call("POST", `${seat(slug)}/map/rebuild`, {});
export const loadSeeds = (slug) => call("GET", `${seat(slug)}/seeds`);
