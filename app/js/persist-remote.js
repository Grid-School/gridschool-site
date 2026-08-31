/**
 * Remote persist driver. Demo never calls this. Failures stay local so the
 * board still works when the API is down.
 *
 * Spec: ops/student-data.md
 */

import { PERSIST, isPlaceholder } from "../../config.js";
import { persistToken } from "./session.js";
import { readDoc, replace, pendingOf, hasPending, markFlushed } from "./persist.js";

const POLL_MS = 15000;
let inflight = 0;
let pollTimer = null;
let pollSlug = null;
const lastStamp = new Map();
const statusListeners = new Set();
let currentStatus = { state: "off", slug: null, error: null };

export function persistStatus() {
  return { ...currentStatus };
}

export function subscribeStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function emitStatus(next) {
  currentStatus = { state: "off", slug: null, error: null, ...next };
  statusListeners.forEach((listener) => listener(persistStatus()));
}

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

/** GET the snapshot without writing the local cache. Used when Pages has no seed file. */
export async function fetchSnapshot(slug) {
  if (!remoteEnabled(slug)) return null;
  try {
    return await request("GET", `/students/${slug}`);
  } catch (error) {
    if (error.code === "NO_TOKEN" || error.status === 404) return null;
    if (error.status === 401) {
      error.code = "BAD_TOKEN";
      throw error;
    }
    console.warn("persist snapshot failed", error);
    return null;
  }
}

async function flushPending(slug) {
  const pending = pendingOf(slug);
  if (!pending.student && !pending.instructor) return null;
  const jobs = [];
  if (pending.student) jobs.push(flushAfterLocalWrite(slug, "student"));
  if (pending.instructor) jobs.push(flushAfterLocalWrite(slug, "instructor"));
  const results = await Promise.all(jobs);
  return results.find((result) => result && result.skipped && (result.error || result.reason)) ?? null;
}

export async function hydrateFromRemote(slug, { force = false } = {}) {
  if (!remoteEnabled(slug)) {
    emitStatus({ state: "off", slug });
    return null;
  }

  const failed = await flushPending(slug);
  if (failed || hasPending(slug)) {
    emitStatus({
      state: "local-only",
      slug,
      error: failed?.error ?? failed?.reason ?? "pending-unflushed",
    });
    return { skipped: true, reason: "pending-unflushed", unchanged: true };
  }

  try {
    const snap = await request("GET", `/students/${slug}`);
    const stamp = stampOf(snap);
    if (!force && lastStamp.get(slug) === stamp) {
      emitStatus({ state: "ok", slug, error: null });
      return { ...snap, unchanged: true };
    }
    if (hasPending(slug)) {
      emitStatus({ state: "local-only", slug, error: "pending-unflushed" });
      return { skipped: true, reason: "pending-unflushed", unchanged: true };
    }
    replace(slug, {
      student: snap.student ?? {},
      instructor: snap.instructor ?? {},
      events: snap.events ?? [],
    });
    lastStamp.set(slug, stamp);
    emitStatus({ state: "ok", slug, error: null });
    return snap;
  } catch (error) {
    if (error.code === "NO_TOKEN" || error.status === 404) {
      emitStatus(
        hasPending(slug)
          ? { state: "local-only", slug, error: error.code || String(error.status) }
          : { state: "off", slug, error: error.code || String(error.status) }
      );
      return null;
    }
    if (error.status === 401) {
      error.code = "BAD_TOKEN";
      emitStatus({ state: "local-only", slug, error: "BAD_TOKEN" });
      throw error;
    }
    console.warn("persist hydrate failed", error);
    if (hasPending(slug)) emitStatus({ state: "local-only", slug, error: error.message });
    return null;
  }
}

export function startPolling(slug, onChange) {
  stopPolling();
  if (!remoteEnabled(slug) || !persistToken()) return;
  pollSlug = slug;
  const tick = async () => {
    if (document.hidden || inflight > 0 || pollSlug !== slug) return;
    try {
      const snap = await hydrateFromRemote(slug);
      if (snap && !snap.unchanged && !snap.skipped) onChange?.(snap);
    } catch (error) {
      if (error.code === "BAD_TOKEN") return;
      console.warn("persist poll failed", error);
    }
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
  if (!remoteEnabled(slug)) {
    emitStatus({ state: "off", slug });
    return { skipped: true };
  }
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
    markFlushed(slug, domain);
    if (snap) lastStamp.set(slug, stampOf(snap));
    emitStatus({
      state: hasPending(slug) ? "local-only" : "ok",
      slug,
      error: null,
    });
    return snap;
  } catch (error) {
    if (error.code === "NO_TOKEN") {
      emitStatus({ state: "local-only", slug, error: "no-token" });
      return { skipped: true, reason: "no-token" };
    }
    console.warn("persist flush failed", error);
    emitStatus({ state: "local-only", slug, error: error.message });
    return { skipped: true, error: error.message };
  } finally {
    inflight -= 1;
  }
}
