/**
 * The board's part of the event log (server/events.py ONBOARDING): the map opened, an intake chunk
 * answered, the week-one check-in answered. Same first-party counter as the free check
 * (check/events.js): a random visitor id in this browser, nothing typed, never blocks the board.
 * Only a student on their own seat counts; the coach's console, the demo and test seats never do.
 */

import { PERSIST } from "../../config.js?v=4f66e99-202610260029";
import { track } from "../../check/events.js?v=4f66e99-202610260029";

const CHUNK_TASK = /^q\.(c\d+)\.answer$/;
const CHECKIN_TASK = "w.checkin.feel";

/** What one checked task means for the event log. Pure. */
export function eventForTask(id, state, answers = {}) {
  if (state !== "done") return null;
  const chunk = CHUNK_TASK.exec(String(id || ""));
  if (chunk) return { name: "intake.chunk_done", props: { chunk: chunk[1] } };
  if (id === CHECKIN_TASK) {
    const score = Number(answers?.scale);
    return { name: "checkin.done", props: Number.isInteger(score) && score >= 1 && score <= 5 ? { score: String(score) } : {} };
  }
  return null;
}

/** Whether this board counts: a signed-in student on a real seat. Pure. */
export function counts({ role, slug, test = false } = {}) {
  return role === "student" && Boolean(slug) && slug !== "demo" && !test;
}

let on = false;

export function enable(who) {
  on = counts(who);
}

export function mapOpened() {
  if (on) track(PERSIST.endpoint, "map.opened");
}

export function taskChecked(id, state, answers) {
  const event = on ? eventForTask(id, state, answers) : null;
  // track() sends each name once per page load; the funnel counts a person once per step anyway.
  if (event) track(PERSIST.endpoint, event.name, { props: event.props });
}
