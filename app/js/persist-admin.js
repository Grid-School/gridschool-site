/**
 * Admin persist calls. Desk only. Student boards never import this.
 */

import { PERSIST, isPlaceholder } from "../../config.js";
import { persistToken } from "./session.js";

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
