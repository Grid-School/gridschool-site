/**
 * Compatibility surface. Persist lives in persist.js (split student /
 * instructor domains). Callers keep importing from here.
 */

export {
  overlayKey,
  readOverlay,
  writeOverlay,
  clearOverlay,
  patchOverlay,
  mergeStudent,
  read,
  clear,
  patchStudent,
  patchInstructor,
  requestReview,
  listEvents,
  STUDENT_KEYS,
  INSTRUCTOR_KEYS,
  ATTENTION_KINDS,
} from "./persist.js";
