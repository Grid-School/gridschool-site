/**
 * State container. JSON files are the seed. Every change a student or Aden
 * makes lands in persist (local cache, flushed to Postgres when the API is up).
 *
 * Student mutations write the student domain only. Instructor mutations write
 * the instructor domain only. That is how a drag cannot wipe a review return.
 *
 * `exportStudent()` prints the merged result in the exact shape of
 * data/students/<slug>.json.
 */

import { loadBoard } from "./api.js";
import { buildGraph } from "./graph/model.js";
import { weekNumber } from "./time.js";
import {
  read,
  clear as clearPersist,
  patchStudent,
  patchInstructor,
  requestReview,
  mergeStudent,
  STUDENT_KEYS,
  INSTRUCTOR_KEYS,
} from "./persist.js";
import { flushAfterLocalWrite, hydrateFromRemote, startPolling } from "./persist-remote.js";
import { validReviewReturn } from "./review.js";
import { isDevUnlock } from "./dev-mode.js";

export { validReviewReturn };

let base = null;
let overlay = {};
let slug = null;
const listeners = new Set();

function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

export async function init(nextSlug, { tour = false } = {}) {
  slug = nextSlug;
  base = await loadBoard(nextSlug, { tour });
  if (!tour && nextSlug !== "demo") {
    await hydrateFromRemote(nextSlug, { force: true });
    startPolling(nextSlug, () => {
      overlay = read(nextSlug);
      publish();
    });
  }
  overlay = read(nextSlug);
  return state();
}

function syncFromPersist() {
  overlay = read(slug);
}

function mergedStudent() {
  return mergeStudent(base.student, overlay);
}

export function state() {
  const student = mergedStudent();
  const unlockAll = isDevUnlock();
  const graph = buildGraph(base.curriculum, student, { unlockAll });
  const week = Math.min(
    Math.max(1, weekNumber(base.cohort.start)),
    base.cohort.weeks + 1
  );
  return {
    ...base,
    student,
    graph,
    week,
    slug,
    hasLocalEdits: Object.keys(overlay).length > 0,
    lessonsLocked: base.curriculum.lessonsLocked === true,
    unlockAll,
  };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Rebuild without mutating overlay (e.g. Dev Mode toggle). */
export function refresh() {
  const next = state();
  listeners.forEach((listener) => listener(next));
  return next;
}

function publish() {
  const next = state();
  listeners.forEach((listener) => listener(next));
  return next;
}

function commitStudent(mutate, event = null) {
  mutate();
  patchStudent(slug, pick(overlay, STUDENT_KEYS), event);
  syncFromPersist();
  void flushAfterLocalWrite(slug, "student", { event });
  return publish();
}

function commitInstructor(mutate, event = null) {
  mutate();
  patchInstructor(slug, pick(overlay, INSTRUCTOR_KEYS), event);
  syncFromPersist();
  void flushAfterLocalWrite(slug, "instructor", { event });
  return publish();
}

/* ---------- tasks ---------- */

export function setTaskState(id, taskState) {
  return commitStudent(() => {
    overlay.tasks = { ...(overlay.tasks ?? {}) };
    if (taskState === "todo") delete overlay.tasks[id];
    else overlay.tasks[id] = { state: taskState, at: new Date().toISOString().slice(0, 10) };
  }, { kind: "task.toggled", payload: { taskId: id, state: taskState } });
}

/* ---------- evidence: the only thing that lights a node ---------- */

export function submitEvidence(nodeId, url, note = "") {
  return commitStudent(() => {
    overlay.evidence = { ...(overlay.evidence ?? {}) };
    overlay.evidence[nodeId] = { url, note, at: new Date().toISOString().slice(0, 10) };
  }, { kind: "evidence.submitted", payload: { nodeId, url } });
}

export function clearEvidence(nodeId) {
  return commitStudent(() => {
    overlay.evidence = { ...(overlay.evidence ?? {}), [nodeId]: null };
  });
}

/** Soft progress on a step (watched film, marked letter read). Does not light the node. */
export function setStepFlag(nodeId, flag, value = true) {
  return commitStudent(() => {
    overlay.stepFlags = { ...(overlay.stepFlags ?? {}) };
    const prev = overlay.stepFlags[nodeId] ?? {};
    overlay.stepFlags[nodeId] = { ...prev, [flag]: value, at: new Date().toISOString().slice(0, 10) };
  });
}

export function stepFlags(nodeId) {
  return mergedStudent().stepFlags?.[nodeId] ?? {};
}

/* ---------- the weekly steer (instructor) ---------- */

export function setFocusNext({ focus, next }) {
  return commitInstructor(() => {
    if (focus !== undefined) overlay.focus = focus;
    if (next !== undefined) overlay.next = next;
  });
}

/* ---------- map editing ---------- */

export function moveNode(id, x, y) {
  return commitStudent(() => {
    overlay.layout = { ...(overlay.layout ?? {}), [id]: { x: Math.round(x), y: Math.round(y) } };
  }, { kind: "layout.changed", payload: { nodeId: id } });
}

export function overrideNode(id, patch) {
  return commitInstructor(() => {
    overlay.nodeOverrides = { ...(overlay.nodeOverrides ?? {}) };
    overlay.nodeOverrides[id] = { ...(overlay.nodeOverrides[id] ?? {}), ...patch };
  });
}

export function addNode(node) {
  return commitInstructor(() => {
    const extras = [...(overlay.extraNodes ?? base.student.extraNodes ?? [])];
    extras.push(node);
    overlay.extraNodes = extras;
  });
}

export function removeNode(id) {
  commitInstructor(() => {
    const extras = (overlay.extraNodes ?? base.student.extraNodes ?? []).filter((n) => n.id !== id);
    overlay.extraNodes = extras;
  });
  return commitStudent(() => {
    if (overlay.layout) {
      const layout = { ...(overlay.layout ?? {}) };
      delete layout[id];
      overlay.layout = layout;
    }
  });
}

/** Rewire a dependency. Refuses to create a cycle. */
export function setRequires(id, requires) {
  const student = mergedStudent();
  const graph = buildGraph(base.curriculum, student, { unlockAll: isDevUnlock() });
  const wouldCycle = requires.some((from) => reaches(graph, id, from));
  if (wouldCycle) return { error: "That would make the path loop back on itself." };
  return commitInstructor(() => {
    overlay.nodeOverrides = { ...(overlay.nodeOverrides ?? {}) };
    overlay.nodeOverrides[id] = { ...(overlay.nodeOverrides[id] ?? {}), requires };
  });
}

function reaches(graph, fromId, targetId) {
  if (fromId === targetId) return true;
  const seen = new Set();
  const stack = [fromId];
  while (stack.length) {
    const current = stack.pop();
    for (const edge of graph.edges) {
      if (edge.from !== current) continue;
      if (edge.to === targetId) return true;
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        stack.push(edge.to);
      }
    }
  }
  return false;
}

/* ---------- quota: a dated log, because the quota is weekly ---------- */

export function logQuota(kind) {
  return commitInstructor(() => {
    const log = [...(overlay.quotaLog ?? base.student.quotaLog ?? [])];
    log.push({ at: new Date().toISOString().slice(0, 10), kind });
    overlay.quotaLog = log;
  });
}

/** Undo the most recent entry of a kind. Mis-taps should not need a data edit. */
export function undoQuota(kind) {
  return commitInstructor(() => {
    const log = [...(overlay.quotaLog ?? base.student.quotaLog ?? [])];
    for (let index = log.length - 1; index >= 0; index -= 1) {
      if (log[index].kind === kind) {
        log.splice(index, 1);
        break;
      }
    }
    overlay.quotaLog = log;
  });
}

/* ---------- reviews ---------- */

export function addReview(review) {
  const entry = {
    id: `rv-${Date.now()}`,
    state: "in-review",
    sent: new Date().toISOString().slice(0, 10),
    ...review,
    state: "in-review",
  };
  requestReview(slug, entry);
  syncFromPersist();
  void flushAfterLocalWrite(slug, "review-request", { review: entry });
  return publish();
}

export function setReviewState(id, reviewState, verdict, scores) {
  return commitInstructor(
    () => {
      const reviews = (overlay.reviews ?? base.student.reviews ?? []).map((review) =>
        review.id === id
          ? {
              ...review,
              state: reviewState,
              verdict: verdict ?? review.verdict,
              ...(scores
                ? {
                    ccvv: scores.ccvv ?? review.ccvv,
                    taughtMove: scores.taughtMove ?? review.taughtMove,
                  }
                : {}),
              returned: reviewState === "returned" ? new Date().toISOString().slice(0, 10) : review.returned,
            }
          : review
      );
      overlay.reviews = reviews;
    },
    reviewState === "returned"
      ? { kind: "review.returned", payload: { reviewId: id } }
      : null
  );
}

/**
 * A returned review is only useful once it has been read. Without this, "came
 * back" would sit on the board forever and stop meaning anything.
 */
export function markReviewRead(id) {
  return commitStudent(() => {
    const readIds = new Set(overlay.readReviews ?? base.student.readReviews ?? []);
    readIds.add(id);
    overlay.readReviews = [...readIds];
  });
}

/* ---------- coach: conversation, memory, usage ---------- */

export function appendChat(turn) {
  return commitStudent(() => {
    const chat = overlay.chat ?? mergedStudent().chat ?? { turns: [] };
    overlay.chat = { turns: [...(chat.turns ?? []), turn] };
  });
}

export function recordUsage(entry) {
  return commitStudent(() => {
    overlay.usage = [...(overlay.usage ?? mergedStudent().usage ?? []), entry];
  });
}

/** One commit for a finished turn so Today does not paint twice. */
export function recordTurn({ user, assistant, usage, memoryNote, memoryFiles = [] }) {
  return commitStudent(() => {
    const current = mergedStudent();
    const chat = overlay.chat ?? current.chat ?? { turns: [] };
    const turns = [...(chat.turns ?? [])];
    if (user) turns.push(user);
    if (assistant) turns.push(assistant);
    overlay.chat = { turns };
    if (usage) overlay.usage = [...(overlay.usage ?? current.usage ?? []), usage];
    const memory = overlay.memory ?? current.memory ?? { notes: [], files: [] };
    let notes = memory.notes ?? [];
    let files = memory.files ?? [];
    if (memoryNote) {
      notes = [{ id: `n-${Date.now()}`, at: new Date().toISOString(), text: memoryNote }, ...notes];
    }
    for (const file of memoryFiles) {
      files = [
        { id: `f-${Date.now()}-${file.name}`, at: new Date().toISOString(), name: file.name, text: file.text, bytes: String(file.text).length },
        ...files,
      ];
    }
    if (memoryNote || memoryFiles.length) overlay.memory = { notes, files };
  });
}

function isQuestionNote(text) {
  const trimmed = String(text ?? "").trim();
  return /^\?/.test(trimmed) || /^q:/i.test(trimmed);
}

export function addMemoryNote(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return state();
  const event = isQuestionNote(trimmed)
    ? { kind: "question.asked", payload: { text: trimmed.slice(0, 200) } }
    : null;
  return commitStudent(() => {
    const memory = overlay.memory ?? mergedStudent().memory ?? { notes: [], files: [] };
    overlay.memory = {
      ...memory,
      notes: [{ id: `n-${Date.now()}`, at: new Date().toISOString(), text: trimmed }, ...(memory.notes ?? [])],
    };
    if (event) {
      overlay.questions = [
        { id: `q-${Date.now()}`, at: new Date().toISOString(), text: trimmed },
        ...(overlay.questions ?? []),
      ];
    }
  }, event);
}

export function addMemoryFile({ name, text }) {
  return commitStudent(() => {
    const memory = overlay.memory ?? mergedStudent().memory ?? { notes: [], files: [] };
    overlay.memory = {
      ...memory,
      files: [
        { id: `f-${Date.now()}`, at: new Date().toISOString(), name, text, bytes: String(text).length },
        ...(memory.files ?? []),
      ],
    };
  });
}

/* ---------- demo controls ---------- */

export function resetLocalEdits() {
  clearPersist(slug);
  overlay = {};
  return publish();
}

/** The merged board in the shape of data/students/<slug>.json. */
export function exportStudent() {
  const student = mergedStudent();
  const evidence = Object.fromEntries(
    Object.entries(student.evidence ?? {}).filter(([, value]) => value && value.url)
  );
  const tasks = Object.fromEntries(
    Object.entries(student.tasks ?? {}).filter(([, value]) => value && value.state)
  );
  const stepFlags = student.stepFlags ?? {};
  return JSON.stringify({ ...student, evidence, tasks, stepFlags }, null, 2);
}
