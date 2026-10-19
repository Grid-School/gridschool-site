/**
 * GridSchool Complete: the work we do for a student, made visible, and the
 * steps that open on a date. Only Complete maps (server/complete_map.py)
 * carry `stages` or `opens`, so a residency map never reaches any of this.
 *
 * The tracker. A step's `stages` are in order and end in "ready". Where it
 * stands is instructor state, `prep[nodeId] = { stage, at: { [stageId]: iso } }`,
 * moved by ops/prep-stage.py. A stage reads done only when it is before the
 * current one and has a time: nothing is drawn done unless someone set it.
 *
 * Opening on a date. A step with `opens` (YYYY-MM-DD) stays "opens later"
 * until that local day, then opens like any other step.
 *
 * Pure.
 */

export const READY = "ready";

/** A map complete_map.py built (its version says so). */
export function isCompleteMap(mapOrGraph) {
  return /^complete-/.test(String(mapOrGraph?.version ?? ""));
}

/** Where a tracked step stands: every stage with its state, and whether the work is theirs yet. */
export function prepOf(node, prep = {}) {
  const stages = Array.isArray(node?.stages) ? node.stages : [];
  if (!stages.length) return null;
  const entry = prep?.[node.id] && typeof prep[node.id] === "object" ? prep[node.id] : {};
  const times = entry.at && typeof entry.at === "object" ? entry.at : {};
  const current = stages.findIndex((stage) => stage.id === entry.stage);
  const ready = current >= 0 && stages[current].id === READY;
  const rows = stages.map((stage, index) => {
    const at = typeof times[stage.id] === "string" ? times[stage.id] : null;
    let state = "todo";
    if (index === current) state = ready ? "done" : "current";
    else if (index < current && at) state = "done";
    return { id: stage.id, label: stage.label, state, at: state === "todo" ? null : at };
  });
  return { stages: rows, current: current >= 0 ? rows[current] : null, ready, started: current >= 0 };
}

/** The short line under a tracked step on the map. */
export function prepHint(prep) {
  if (!prep) return null;
  if (prep.ready) return "Ready for you";
  return prep.current ? prep.current.label : "In Aden's queue";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

/** True while a step's `opens` day is still ahead (local midnight to midnight). */
export function opensLater(node, now = new Date()) {
  const day = localDay(node?.opens);
  if (!day) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return day > today;
}

/** "Mon, Oct 26". */
export function shortDay(value) {
  const day = localDay(value);
  return day ? `${DAYS[day.getDay()]}, ${MONTHS[day.getMonth()]} ${day.getDate()}` : "";
}

/** When a stage was set, for the tracker: "Oct 19, 9:14 AM". */
export function stageTime(iso) {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return "";
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, "0");
  return `${MONTHS[at.getMonth()]} ${at.getDate()}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}
