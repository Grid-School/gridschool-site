/**
 * What the one next move needs beyond the student's record, shared by every screen:
 *
 *   roles / packs   the job radar's roles and the prepared ones, once a screen has loaded them (map, Jobs)
 *   detail          what a step's own page knows about its next action, e.g. the resume's
 *                   "Answer 7 questions…", so the Next bar says that instead of the step's title
 *
 * Screens write here; the Next bar (views/next-bar.js) listens and redraws. Detail is remembered per seat
 * on this device, so the bar can say it before the step's page has been opened this visit.
 */

import { nextMove } from "./engine.js?v=f2598aa-202610271919";

const live = { roles: [], packs: {}, detail: new Map(), slug: "" };

/** The one next move for this state, with what the screens have loaded and said (engine.nextMove). */
export function currentMove(state, now = new Date()) {
  return nextMove({ student: state.student, graph: state.graph, now, roles: live.roles, packs: live.packs, detail: stepDetail });
}
const listeners = new Set();
const KEY = (slug) => `gridschool.next.detail.${slug}`;

function emit() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a listener's failure never stops the others */
    }
  }
}

export function onNextChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function liveRoles() {
  return live.roles;
}

export function livePacks() {
  return live.packs;
}

export function setLiveJobs({ roles, packs } = {}) {
  if (Array.isArray(roles)) live.roles = roles;
  if (packs && typeof packs === "object") live.packs = packs;
  emit();
}

/** Which seat's remembered detail to use (boot sets it once the seat is known). */
export function useSeat(slug) {
  if (slug === live.slug) return;
  live.slug = slug || "";
  live.detail = new Map();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY(live.slug)) || "{}");
    for (const [id, value] of Object.entries(saved)) if (value?.title) live.detail.set(id, value);
  } catch {
    /* nothing remembered */
  }
}

/** A step's page says what its next action is (or null to fall back to the step's title). */
export function setStepDetail(stepId, value) {
  const before = JSON.stringify(live.detail.get(stepId) ?? null);
  if (value?.title) live.detail.set(stepId, { title: String(value.title), why: String(value.why ?? "") });
  else live.detail.delete(stepId);
  if (JSON.stringify(live.detail.get(stepId) ?? null) === before) return;
  try {
    localStorage.setItem(KEY(live.slug), JSON.stringify(Object.fromEntries(live.detail)));
  } catch {
    /* the bar still has it for this visit */
  }
  emit();
}

export function stepDetail(stepId) {
  return live.detail.get(stepId) ?? null;
}
