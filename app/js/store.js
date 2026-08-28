/**
 * State container. Server truth (the JSON files) stays immutable; every change a
 * student or Aden makes lands in a local overlay so the platform is fully
 * walkable before a backend exists.
 *
 * `exportStudent()` prints the merged result in the exact shape of
 * data/students/<slug>.json, which is how a demo edit becomes real state.
 */

import { loadBoard } from "./api.js";
import { buildGraph } from "./graph/model.js";
import { weekNumber } from "./time.js";
import { readOverlay, writeOverlay, clearOverlay, mergeStudent } from "./overlay.js";

let base = null;
let overlay = {};
let slug = null;
const listeners = new Set();

export async function init(nextSlug, { tour = false } = {}) {
  slug = nextSlug;
  base = await loadBoard(nextSlug, { tour });
  overlay = readOverlay(nextSlug);
  return state();
}

function persist() {
  writeOverlay(slug, overlay);
}

function mergedStudent() {
  return mergeStudent(base.student, overlay);
}

export function state() {
  const student = mergedStudent();
  const graph = buildGraph(base.curriculum, student);
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
  };
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(mutate) {
  mutate();
  persist();
  const next = state();
  listeners.forEach((listener) => listener(next));
  return next;
}

/* ---------- tasks ---------- */

export function setTaskState(id, taskState) {
  return commit(() => {
    overlay.tasks = { ...(overlay.tasks ?? {}) };
    if (taskState === "todo") delete overlay.tasks[id];
    else overlay.tasks[id] = { state: taskState, at: new Date().toISOString().slice(0, 10) };
  });
}

/* ---------- evidence: the only thing that lights a node ---------- */

export function submitEvidence(nodeId, url, note = "") {
  return commit(() => {
    overlay.evidence = { ...(overlay.evidence ?? {}) };
    overlay.evidence[nodeId] = { url, note, at: new Date().toISOString().slice(0, 10) };
  });
}

export function clearEvidence(nodeId) {
  return commit(() => {
    overlay.evidence = { ...(overlay.evidence ?? {}), [nodeId]: null };
  });
}

/* ---------- the weekly steer ---------- */

export function setFocusNext({ focus, next }) {
  return commit(() => {
    if (focus !== undefined) overlay.focus = focus;
    if (next !== undefined) overlay.next = next;
  });
}

/* ---------- map editing ---------- */

export function moveNode(id, x, y) {
  return commit(() => {
    overlay.layout = { ...(overlay.layout ?? {}), [id]: { x: Math.round(x), y: Math.round(y) } };
  });
}

export function overrideNode(id, patch) {
  return commit(() => {
    overlay.nodeOverrides = { ...(overlay.nodeOverrides ?? {}) };
    overlay.nodeOverrides[id] = { ...(overlay.nodeOverrides[id] ?? {}), ...patch };
  });
}

export function addNode(node) {
  return commit(() => {
    const extras = [...(overlay.extraNodes ?? base.student.extraNodes ?? [])];
    extras.push(node);
    overlay.extraNodes = extras;
  });
}

export function removeNode(id) {
  return commit(() => {
    const extras = (overlay.extraNodes ?? base.student.extraNodes ?? []).filter((n) => n.id !== id);
    overlay.extraNodes = extras;
    if (overlay.layout) delete overlay.layout[id];
  });
}

/** Rewire a dependency. Refuses to create a cycle. */
export function setRequires(id, requires) {
  const student = mergedStudent();
  const graph = buildGraph(base.curriculum, student);
  const wouldCycle = requires.some((from) => reaches(graph, id, from));
  if (wouldCycle) return { error: "That would make the path loop back on itself." };
  return commit(() => {
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
  return commit(() => {
    const log = [...(overlay.quotaLog ?? base.student.quotaLog ?? [])];
    log.push({ at: new Date().toISOString().slice(0, 10), kind });
    overlay.quotaLog = log;
  });
}

/** Undo the most recent entry of a kind. Mis-taps should not need a data edit. */
export function undoQuota(kind) {
  return commit(() => {
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
  return commit(() => {
    const reviews = [...(overlay.reviews ?? base.student.reviews ?? [])];
    reviews.unshift({ id: `rv-${Date.now()}`, state: "in-review", sent: new Date().toISOString().slice(0, 10), ...review });
    overlay.reviews = reviews;
  });
}

export function setReviewState(id, reviewState, verdict) {
  return commit(() => {
    const reviews = (overlay.reviews ?? base.student.reviews ?? []).map((review) =>
      review.id === id
        ? {
            ...review,
            state: reviewState,
            verdict: verdict ?? review.verdict,
            returned: reviewState === "returned" ? new Date().toISOString().slice(0, 10) : review.returned,
          }
        : review
    );
    overlay.reviews = reviews;
  });
}

/**
 * A returned review is only useful once it has been read. Without this, "came
 * back" would sit on the board forever and stop meaning anything.
 */
export function markReviewRead(id) {
  return commit(() => {
    const read = new Set(overlay.readReviews ?? base.student.readReviews ?? []);
    read.add(id);
    overlay.readReviews = [...read];
  });
}

/* ---------- coach: conversation, memory, usage ---------- */

export function appendChat(turn) {
  return commit(() => {
    const chat = overlay.chat ?? mergedStudent().chat ?? { turns: [] };
    overlay.chat = { turns: [...(chat.turns ?? []), turn] };
  });
}

export function recordUsage(entry) {
  return commit(() => {
    overlay.usage = [...(overlay.usage ?? mergedStudent().usage ?? []), entry];
  });
}

/** One commit for a finished turn so Today does not paint twice. */
export function recordTurn({ user, assistant, usage, memoryNote, memoryFiles = [] }) {
  return commit(() => {
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

export function addMemoryNote(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return state();
  return commit(() => {
    const memory = overlay.memory ?? mergedStudent().memory ?? { notes: [], files: [] };
    overlay.memory = {
      ...memory,
      notes: [{ id: `n-${Date.now()}`, at: new Date().toISOString(), text: trimmed }, ...(memory.notes ?? [])],
    };
  });
}

export function addMemoryFile({ name, text }) {
  return commit(() => {
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
  return commit(() => {
    overlay = {};
    clearOverlay(slug);
  });
}

/** The merged board in the shape of data/students/<slug>.json. */
export function exportStudent() {
  const student = mergedStudent();
  const evidence = Object.fromEntries(
    Object.entries(student.evidence).filter(([, value]) => value && value.url)
  );
  const tasks = Object.fromEntries(
    Object.entries(student.tasks).filter(([, value]) => value && value.state)
  );
  return JSON.stringify({ ...student, evidence, tasks }, null, 2);
}
