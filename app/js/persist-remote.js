/**
 * Remote persist driver. Demo never calls this. Failures stay local so the
 * board still works when the API is down.
 *
 * Spec: ops/student-data.md
 */

import { PERSIST, isPlaceholder } from "../../config.js";
import { persistToken } from "./session.js";
import { readDoc, replace } from "./persist.js";

const POLL_MS = 15000;
let inflight = 0;
let pollTimer = null;
let pollSlug = null;
const lastStamp = new Map();

export function remoteEnabled(slug) {
  if (!slug || slug === "demo") return false;
  const endpoint = PERSIST?.endpoint;
  return typeof endpoint === "string" && !isPlaceholder(endpoint);
}

function endpoint() {
  return String(PERSIST.endpoint).replace(/\/$/, "");
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

function stampOf(snap) {
  return `${snap?.student_updated_at ?? ""}|${snap?.instructor_updated_at ?? ""}`;
}

export async function hydrateFromRemote(slug, { force = false } = {}) {
  if (!remoteEnabled(slug)) return null;
  try {
    const snap = await request("GET", `/students/${slug}`);
    const stamp = stampOf(snap);
    if (!force && lastStamp.get(slug) === stamp) return { ...snap, unchanged: true };
    replace(slug, {
      student: snap.student ?? {},
      instructor: snap.instructor ?? {},
      events: snap.events ?? [],
    });
    lastStamp.set(slug, stamp);
    return snap;
  } catch (error) {
    if (error.code === "NO_TOKEN" || error.status === 404) return null;
    if (error.status === 401) {
      error.code = "BAD_TOKEN";
      throw error;
    }
    console.warn("persist hydrate failed", error);
    return null;
  }
}

export function startPolling(slug, onChange) {
  stopPolling();
  if (!remoteEnabled(slug) || !persistToken()) return;
  pollSlug = slug;
  const tick = async () => {
    if (document.hidden || inflight > 0 || pollSlug !== slug) return;
    const snap = await hydrateFromRemote(slug);
    if (snap && !snap.unchanged) onChange?.(snap);
  };
  pollTimer = setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

export function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pollSlug = null;
}

export async function flushAfterLocalWrite(slug, domain, extra = {}) {
  if (!remoteEnabled(slug)) return { skipped: true };
  inflight += 1;
  try {
    let snap = null;
    if (domain === "student") {
      const doc = readDoc(slug);
      snap = await request("PATCH", `/students/${slug}/student`, {
        patch: doc.student,
        event: extra.event ?? null,
      });
    } else if (domain === "instructor") {
      const doc = readDoc(slug);
      snap = await request("PATCH", `/students/${slug}/instructor`, {
        patch: doc.instructor,
        event: extra.event ?? null,
      });
    } else if (domain === "review-request") {
      snap = await request("POST", `/students/${slug}/review-request`, extra.review ?? {});
    } else {
      return { skipped: true };
    }
    if (snap) lastStamp.set(slug, stampOf(snap));
    return snap;
  } catch (error) {
    if (error.code === "NO_TOKEN") return { skipped: true, reason: "no-token" };
    console.warn("persist flush failed", error);
    return { skipped: true, error: error.message };
  } finally {
    inflight -= 1;
  }
}
