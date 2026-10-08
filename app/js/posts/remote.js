/**
 * Client for the shared, server-owned opportunity queue.
 *
 * A signed-in student board uses the real queue. The demo board on localhost
 * uses developer preview instead: the server checks the admin token and ranks
 * the same fresh posts, but records no assignment, so testing never spends a
 * student's slot on a post.
 */

import { PERSIST, isPlaceholder } from "../../../config.js?v=6ffcb17-202610080629";
import { persistToken } from "../session.js?v=6ffcb17-202610080629";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function endpointReady() {
  return Boolean(PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
}

export function queueEnabled(slug) {
  return Boolean(slug && slug !== "demo" && persistToken() && endpointReady());
}

export function isLocalDevHost(hostname = globalThis.location?.hostname) {
  return LOCAL_HOSTS.has(String(hostname ?? ""));
}

/** Developer preview: demo board, local machine, a token saved by the local admin console. */
export function previewEnabled(slug, hostname) {
  return Boolean(slug === "demo" && isLocalDevHost(hostname) && persistToken() && endpointReady());
}

export function queueMode(slug, hostname) {
  if (queueEnabled(slug)) return "live";
  if (previewEnabled(slug, hostname)) return "preview";
  return "off";
}

export async function fetchNextOpportunity(slug, interests) {
  return post(`/students/${encodeURIComponent(slug)}/opportunities/next`, { interests });
}

export async function markOpportunity(slug, id, state) {
  return post(`/students/${encodeURIComponent(slug)}/opportunities/state`, { id, state });
}

export async function fetchPreviewOpportunity(interests, exclude = []) {
  return post("/opportunities/preview", { interests, exclude });
}

export async function retireOpportunity(id) {
  return post("/opportunities/retire", { id });
}

async function post(path, body) {
  const token = persistToken();
  if (!token || !endpointReady()) {
    const error = new Error("The live opportunity queue is not connected for this board.");
    error.code = "QUEUE_OFF";
    throw error;
  }
  const base = String(PERSIST.endpoint).replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Opportunity queue returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}
