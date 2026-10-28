/**
 * Answering a chunk of intake questions on the map (a q-step, `node.chunk`): the pure part.
 *
 * Which questions to show and in what order come from the check's own logic (data/intake/intake.mjs,
 * shared with /check/), so the board asks exactly what the check and the server's map builder expect.
 * This file turns what the form holds into answers, and answers into the body of
 * PUT /students/:slug/intake (server/intake_api.py), which checks every value again.
 * Uploads arrive through their own route, so an upload question is skipped here and says so.
 * Tests: answer-chunk.test.mjs. The form itself is views/answer.js.
 */

import * as I from "../../data/intake/intake.mjs?v=e1b1240-202610280516";

export const LATER_KINDS = new Set(["upload"]);
const URL_RE = /^https?:\/\/[^\s<>"']{3,}$/i;

/** The seat's intake state from GET /students/:slug/intake, or an empty one. */
export function seatState(remote) {
  const state = remote?.state;
  if (!state || typeof state !== "object") return I.emptyState();
  return {
    answers: state.answers && typeof state.answers === "object" ? { ...state.answers } : {},
    skipped: Array.isArray(state.skipped) ? [...state.skipped] : [],
    sources: state.sources && typeof state.sources === "object" ? { ...state.sources } : {},
  };
}

/** The questions this chunk asks this person now (askIf re-read on every answer). */
export const askedNow = (catalog, chunkId, state) => I.chunkQuestions(catalog, chunkId, state);

/** What the form holds for a question, as the answer the catalog takes, or null for "not answered". */
export function fromInput(question, raw) {
  switch (question.kind) {
    case "choice":
      return question.options.some((o) => o.value === raw) ? raw : null;
    case "multi": {
      const picked = (Array.isArray(raw) ? raw : []).filter((v) => question.options.some((o) => o.value === v));
      return picked.length ? [...new Set(picked)] : null;
    }
    case "text": {
      const text = String(raw ?? "").trim();
      return text ? text.slice(0, Number(question.max) || 1000) : null;
    }
    case "links": {
      const links = String(raw ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      return links.length ? links.slice(0, Number(question.max) || 5) : null;
    }
    case "number": {
      if (raw === "" || raw === null || raw === undefined) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "range": {
      const num = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
      const min = num(raw?.min);
      const max = num(raw?.max);
      return min === null && max === null ? null : { min, max };
    }
    default:
      return null;
  }
}

/** An answer back into what the form shows. */
export function toInput(question, value) {
  if (value === undefined || value === null) return question.kind === "multi" ? [] : question.kind === "range" ? { min: "", max: "" } : "";
  if (question.kind === "links") return (Array.isArray(value) ? value : [value]).join("\n");
  if (question.kind === "range") return { min: value.min ?? "", max: value.max ?? "" };
  if (question.kind === "multi") return Array.isArray(value) ? value : [];
  return String(value);
}

/** Set one question from the form: an answer, or back to unanswered. */
export function setAnswer(state, question, raw) {
  const value = fromInput(question, raw);
  if (value !== null) return I.answer(state, question.id, value);
  const answers = { ...state.answers };
  delete answers[question.id];
  const sources = { ...state.sources };
  delete sources[question.id];
  return { answers, skipped: state.skipped.filter((id) => id !== question.id), sources };
}

/** What would make the server refuse the save, by question id, said plainly. */
export function problems(catalog, chunkId, state) {
  const out = {};
  for (const q of askedNow(catalog, chunkId, state)) {
    const value = state.answers[q.id];
    if (q.kind === "links" && Array.isArray(value) && value.some((link) => !URL_RE.test(link))) out[q.id] = "Links start with http:// or https://";
    if ((q.kind === "number" || q.kind === "range") && value !== undefined) {
      const nums = q.kind === "range" ? [value?.min, value?.max] : [value];
      const low = q.min ?? 0;
      const high = q.max ?? 1e9;
      if (nums.some((n) => n !== null && n !== undefined && (n < low || n > high))) out[q.id] = `Use a number from ${low} to ${high}`;
    }
  }
  return out;
}

/** The body of PUT /students/:slug/intake: this chunk's answers, the rest skipped, and the chunk done. */
export function payloadFor(catalog, chunkId, state) {
  const asked = askedNow(catalog, chunkId, state);
  const answers = {};
  const skipped = [];
  for (const q of asked) {
    if (!LATER_KINDS.has(q.kind) && I.isAnswered(state, q.id)) answers[q.id] = state.answers[q.id];
    else skipped.push(q.id);
  }
  return { chunk: chunkId, answers, skipped, done: true };
}

/** How many of the questions shown have an answer, for the line over the save button. */
export function answeredCount(catalog, chunkId, state) {
  const asked = askedNow(catalog, chunkId, state).filter((q) => !LATER_KINDS.has(q.kind));
  return { answered: asked.filter((q) => I.isAnswered(state, q.id)).length, total: asked.length };
}

/** An answer as a short line for the summary once the step is done. */
export function answerLine(question, value) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return "Skipped";
  const label = (v) => question.options?.find((o) => o.value === v)?.label ?? String(v);
  if (question.kind === "choice") return label(value);
  if (question.kind === "multi") return value.map(label).join(", ");
  if (question.kind === "range") {
    const [low, high] = [value.min, value.max].map((n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-US")));
    return low && high ? `${low} to ${high}` : low || high;
  }
  if (question.kind === "links") return value.join(", ");
  const text = String(value);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** What the student reads after saving, from what the rebuild answered (server/onboarding_api.py). */
export function rebuildLine(result) {
  if (!result) return "Your answers are saved.";
  if (result.status === "published") return "Saved. Your map just rebuilt itself around your answers.";
  if (result.status === "unchanged") return "Saved. Your map already fits these answers.";
  return "Your answers are saved.";
}
