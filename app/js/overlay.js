/**
 * Compatibility surface. Persist lives in persist.js (split student /
 * instructor domains). Console writes go through here and flush remotely
 * when the API is up. Demo never leaves the browser.
 */

import {
  overlayKey,
  readOverlay,
  writeOverlay,
  clearOverlay as clearOverlayLocal,
  patchOverlay as patchOverlayLocal,
  mergeStudent,
  read,
  readDoc,
  replace,
  clear,
  patchStudent,
  patchInstructor,
  requestReview,
  listEvents,
  STUDENT_KEYS,
  INSTRUCTOR_KEYS,
  ATTENTION_KINDS,
  ATTENTION_LABELS,
} from "./persist.js";
import { flushAfterLocalWrite, remoteEnabled } from "./persist-remote.js";

export {
  overlayKey,
  readOverlay,
  writeOverlay,
  mergeStudent,
  read,
  readDoc,
  replace,
  clear,
  patchStudent,
  patchInstructor,
  requestReview,
  listEvents,
  STUDENT_KEYS,
  INSTRUCTOR_KEYS,
  ATTENTION_KINDS,
  ATTENTION_LABELS,
};

/** True when the write is the record (remote landed, or remote is off). */
export function remoteLanded(result) {
  const remote = result?.remote;
  if (!remote) return true;
  if (remote.ok) return true;
  if (remote.skipped && !remote.error && remote.reason !== "no-token") return true;
  return false;
}

export async function patchOverlay(slug, patch) {
  const overlay = patchOverlayLocal(slug, patch);
  if (!remoteEnabled(slug)) return { overlay, remote: { skipped: true } };
  const keys = Object.keys(patch ?? {});
  const studentHit = keys.some((key) => STUDENT_KEYS.includes(key));
  const instructorHit = keys.some((key) => !STUDENT_KEYS.includes(key));
  const jobs = [];
  if (instructorHit) {
    const event = patch?.reviews
      ? { kind: "review.returned", payload: {} }
      : null;
    jobs.push(flushAfterLocalWrite(slug, "instructor", { event }));
  }
  if (studentHit) jobs.push(flushAfterLocalWrite(slug, "student"));
  const results = await Promise.all(jobs);
  const failed = results.find((result) => result && result.skipped && (result.error || result.reason));
  return {
    overlay,
    remote: failed ? { skipped: true, error: failed.error, reason: failed.reason } : { ok: true },
  };
}

/** Discard the local cache only. Next hydrate brings the server copy back. */
export function clearOverlay(slug) {
  clearOverlayLocal(slug);
}
