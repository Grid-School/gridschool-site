/**
 * Persist seam for the student lab notebook.
 *
 * localStorage is the cache. When PERSIST.endpoint is set, persist-remote.js
 * hydrates/flushes to Postgres on GridSchool AWS (643600678330). Demo never
 * leaves this browser. Do not invent a second student shape.
 *
 * Spec: ops/student-data.md
 */

export const STUDENT_KEYS = [
  "evidence",
  "tasks",
  "layout",
  "stepFlags",
  "chat",
  "memory",
  "usage",
  "readReviews",
  "questions",
];

export const INSTRUCTOR_KEYS = [
  "focus",
  "next",
  "reviews",
  "extraNodes",
  "nodeOverrides",
  "quotaLog",
];

/** Kinds that Telegram Aden (email if Telegram is down). */
export const ATTENTION_KINDS = new Set([
  "evidence.submitted",
  "review.requested",
  "question.asked",
  "chat.needs_human",
]);

export const ATTENTION_LABELS = {
  "evidence.submitted": "URL landed",
  "review.requested": "Review requested",
  "question.asked": "Question",
  "chat.needs_human": "Coach needs you",
};

const MAP_KEYS = new Set(["evidence", "tasks", "layout", "nodeOverrides", "stepFlags"]);

export const storageKey = (slug) => `gridschool.persist.v1.${slug}`;
/** Pre-split overlay key. Migrated on read. */
export const legacyOverlayKey = (slug) => `gridschool.overlay.v1.${slug}`;

function emptyPending() {
  return { student: false, instructor: false };
}

function emptyDoc() {
  return { student: {}, instructor: {}, events: [], pending: emptyPending() };
}

function normalizePending(pending) {
  return {
    student: Boolean(pending?.student),
    instructor: Boolean(pending?.instructor),
  };
}

function withPending(doc, patch) {
  return { ...normalizePending(doc?.pending), ...patch };
}

function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function mergeMaps(base, patch) {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (MAP_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = { ...(base[key] ?? {}), ...value };
    } else {
      next[key] = value;
    }
  }
  return next;
}

function flatten(doc) {
  return { ...(doc.student ?? {}), ...(doc.instructor ?? {}) };
}

function splitFlat(flat) {
  return {
    student: pick(flat, STUDENT_KEYS),
    instructor: pick(flat, INSTRUCTOR_KEYS),
  };
}

function readRaw(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          student: parsed.student ?? {},
          instructor: parsed.instructor ?? {},
          events: Array.isArray(parsed.events) ? parsed.events : [],
          pending: normalizePending(parsed.pending),
        };
      }
    }
  } catch {
    /* fall through to legacy */
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(legacyOverlayKey(slug)) || "null");
    if (legacy && typeof legacy === "object") {
      const split = splitFlat(legacy);
      const doc = { ...split, events: [], pending: emptyPending() };
      writeRaw(slug, doc);
      return doc;
    }
  } catch {
    /* empty */
  }

  return emptyDoc();
}

function writeRaw(slug, doc) {
  try {
    localStorage.setItem(
      storageKey(slug),
      JSON.stringify({
        student: doc.student ?? {},
        instructor: doc.instructor ?? {},
        events: doc.events ?? [],
        pending: normalizePending(doc.pending),
      })
    );
    return true;
  } catch {
    return false;
  }
}

function pushEvent(doc, kind, payload = {}) {
  if (!kind) return doc;
  const event = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    payload,
    created_at: new Date().toISOString(),
    notified_at: null,
    attention: ATTENTION_KINDS.has(kind),
  };
  return { ...doc, events: [event, ...(doc.events ?? [])] };
}

/** Flat overlay (student + instructor keys) for mergeStudent / store. */
export function read(slug) {
  return flatten(readRaw(slug));
}

/** Split document (student / instructor / events) for the remote driver. */
export function readDoc(slug) {
  return readRaw(slug);
}

export function pendingOf(slug) {
  return normalizePending(readRaw(slug).pending);
}

export function hasPending(slug) {
  const pending = pendingOf(slug);
  return pending.student || pending.instructor;
}

export function markFlushed(slug, domain) {
  const doc = readRaw(slug);
  const pending = normalizePending(doc.pending);
  if (domain === "student") pending.student = false;
  else if (domain === "instructor" || domain === "review-request") pending.instructor = false;
  writeRaw(slug, { ...doc, pending });
  return pending;
}

/** Replace the local cache from a remote snapshot. Refuses while a domain is pending. */
export function replace(slug, doc) {
  const current = readRaw(slug);
  if (current.pending.student || current.pending.instructor) return flatten(current);
  writeRaw(slug, {
    student: pick(doc?.student ?? {}, STUDENT_KEYS),
    instructor: pick(doc?.instructor ?? {}, INSTRUCTOR_KEYS),
    events: Array.isArray(doc?.events) ? doc.events : [],
    pending: emptyPending(),
  });
  return flatten(readRaw(slug));
}

export function clear(slug) {
  try {
    localStorage.removeItem(storageKey(slug));
    localStorage.removeItem(legacyOverlayKey(slug));
  } catch {
    /* ignore */
  }
  return emptyDoc();
}

/**
 * Student-domain patch. Only STUDENT_KEYS apply. Optional attention/silent event.
 * API driver: PATCH /students/:slug/student
 */
export function patchStudent(slug, patch, event = null) {
  const doc = readRaw(slug);
  const allowed = pick(patch, STUDENT_KEYS);
  const student = mergeMaps(doc.student, allowed);
  let next = { ...doc, student, pending: withPending(doc, { student: true }) };
  if (event?.kind) next = pushEvent(next, event.kind, event.payload ?? {});
  writeRaw(slug, next);
  return flatten(next);
}

/**
 * Instructor-domain patch. Only INSTRUCTOR_KEYS apply.
 * API driver: PATCH /students/:slug/instructor
 */
export function patchInstructor(slug, patch, event = null) {
  const doc = readRaw(slug);
  const allowed = pick(patch, INSTRUCTOR_KEYS);
  const instructor = mergeMaps(doc.instructor, allowed);
  let next = { ...doc, instructor, pending: withPending(doc, { instructor: true }) };
  if (event?.kind) next = pushEvent(next, event.kind, event.payload ?? {});
  writeRaw(slug, next);
  return flatten(next);
}

/**
 * Student sends work for review: append an in-review item without wiping returns.
 * API: POST /students/:slug/review-request (append, never replace returns).
 */
export function requestReview(slug, review) {
  const doc = readRaw(slug);
  const reviews = [...(doc.instructor.reviews ?? [])];
  const entry = {
    id: review.id ?? `rv-${Date.now()}`,
    state: "in-review",
    sent: review.sent ?? new Date().toISOString().slice(0, 10),
    ...review,
    state: "in-review",
  };
  reviews.unshift(entry);
  let next = {
    ...doc,
    instructor: { ...doc.instructor, reviews },
    pending: withPending(doc, { instructor: true }),
  };
  next = pushEvent(next, "review.requested", {
    reviewId: entry.id,
    nodeId: entry.nodeId ?? null,
    title: entry.title ?? null,
  });
  writeRaw(slug, next);
  return flatten(next);
}

export function listEvents(slug, { attentionOnly = false } = {}) {
  const events = readRaw(slug).events ?? [];
  if (!attentionOnly) return events;
  return events.filter((event) => event.attention || ATTENTION_KINDS.has(event.kind));
}

/** Identity + empty domains from a persist snapshot. Overlay holds the live writes. */
export function seedFromSnapshot(snap) {
  const identity = snap?.identity ?? {};
  return {
    slug: snap?.slug,
    name: identity.name ?? snap?.slug,
    email: identity.email ?? "",
    cohort: identity.cohort ?? "founding-001",
    joined: identity.joined,
    public: identity.public === true,
    clock: identity.clock ?? {},
    oneone: identity.oneone ?? {},
    note: identity.note ?? "",
  };
}

/** Merge a student file with its overlay. The shape both surfaces read from. */
export function mergeStudent(student, overlay) {
  return {
    ...student,
    ...overlay,
    evidence: { ...(student.evidence ?? {}), ...(overlay.evidence ?? {}) },
    tasks: { ...(student.tasks ?? {}), ...(overlay.tasks ?? {}) },
    layout: { ...(student.layout ?? {}), ...(overlay.layout ?? {}) },
    nodeOverrides: { ...(student.nodeOverrides ?? {}), ...(overlay.nodeOverrides ?? {}) },
    stepFlags: { ...(student.stepFlags ?? {}), ...(overlay.stepFlags ?? {}) },
    extraNodes: overlay.extraNodes ?? student.extraNodes ?? [],
    reviews: overlay.reviews ?? student.reviews ?? [],
    quotaLog: overlay.quotaLog ?? student.quotaLog ?? [],
    readReviews: overlay.readReviews ?? student.readReviews ?? [],
    chat: overlay.chat ?? student.chat ?? { turns: [] },
    memory: overlay.memory ?? student.memory ?? { notes: [], files: [] },
    usage: overlay.usage ?? student.usage ?? [],
    questions: overlay.questions ?? student.questions ?? [],
  };
}

/* ---------- Compatibility wrappers (admin / summary / store) ---------- */

export const overlayKey = legacyOverlayKey;

export function readOverlay(slug) {
  return read(slug);
}

/** Full replace of both domains from a flat overlay (demo reset / rare). */
export function writeOverlay(slug, overlay) {
  const current = readRaw(slug);
  const split = splitFlat(overlay ?? {});
  writeRaw(slug, { ...split, events: current.events ?? [], pending: current.pending });
  return true;
}

export function clearOverlay(slug) {
  clear(slug);
}

/** Admin helper: instructor-domain patch (Focus, Next, returns, map edits). */
export function patchOverlay(slug, patch) {
  const keys = Object.keys(patch ?? {});
  const studentPatch = pick(patch, STUDENT_KEYS);
  const instructorPatch = pick(patch, INSTRUCTOR_KEYS);
  let flat = read(slug);
  if (Object.keys(instructorPatch).length) flat = patchInstructor(slug, instructorPatch);
  if (Object.keys(studentPatch).length) flat = patchStudent(slug, studentPatch);
  // Unknown keys (should not happen) land on instructor for console writes.
  const unknown = keys.filter(
    (key) => !STUDENT_KEYS.includes(key) && !INSTRUCTOR_KEYS.includes(key)
  );
  if (unknown.length) {
    const extra = {};
    for (const key of unknown) extra[key] = patch[key];
    flat = patchInstructor(slug, extra);
  }
  return flat;
}
