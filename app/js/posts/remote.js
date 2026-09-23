/** Authenticated client for the shared, server-owned opportunity queue. */

import { PERSIST, isPlaceholder } from "../../../config.js";
import { persistToken } from "../session.js";

export function queueEnabled(slug) {
  return Boolean(
    slug &&
      slug !== "demo" &&
      persistToken() &&
      PERSIST?.endpoint &&
      !isPlaceholder(PERSIST.endpoint)
  );
}

export async function fetchNextOpportunity(slug, interests) {
  return request(slug, "next", { interests });
}

export async function markOpportunity(slug, id, state) {
  return request(slug, "state", { id, state });
}

async function request(slug, action, body) {
  const token = persistToken();
  if (!queueEnabled(slug) || !token) {
    const error = new Error("The live opportunity queue is not connected for this board.");
    error.code = "QUEUE_OFF";
    throw error;
  }
  const base = String(PERSIST.endpoint).replace(/\/$/, "");
  const response = await fetch(`${base}/students/${encodeURIComponent(slug)}/opportunities/${action}`, {
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
