/**
 * The pure part of "Who you are" (views/profile.js): moving back and forward through every question, what an
 * upload question allows and says, adding several images at once, replacing one in place, and what a changed
 * answer left out of date. No DOM here, so it is tested in node (profile-flow.test.mjs).
 */

/* ---------- moving through the questions ---------- */

/**
 * Every question the step asks now, in order, across all its stages: [{stage, q}].
 * questionsOf(stage) is the view's own list (askIf re-read on every answer).
 */
export function flowOf(stages, questionsOf) {
  return stages.filter((s) => s.chunk).flatMap((s) => questionsOf(s).map((q) => ({ stage: s.id, q: q.id })));
}

/**
 * Where Back goes from here. `here` is {stage, q} for a question, {stage} for a stage's summary, or
 * {stage: "finish"}. A question goes to the one before it, even in the stage before; a summary or Finish goes
 * to the last question before it. null at the very first question. `order`: the stages' ids, in order.
 */
export function backFrom(flow, here, order = [...new Set(flow.map((f) => f.stage))]) {
  if (!flow.length || !here) return null;
  if (here.q) {
    const i = flow.findIndex((f) => f.stage === here.stage && f.q === here.q);
    return i > 0 ? flow[i - 1] : null;
  }
  if (here.stage === "finish") return flow[flow.length - 1];
  const last = [...flow].reverse().find((f) => f.stage === here.stage);
  if (last) return last;
  // A stage with nothing asked now: the last question of an earlier stage (`order` is every stage's id).
  return flow.filter((f) => order.indexOf(f.stage) < order.indexOf(here.stage)).pop() ?? null;
}

/** The question after `here` in the whole flow, or null after the last one. */
export function forwardFrom(flow, here) {
  const i = flow.findIndex((f) => f.stage === here?.stage && f.q === here?.q);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

/** "Question 4 of 17" across the whole step, for the line over each question. */
export function placeOf(flow, here) {
  const i = flow.findIndex((f) => f.stage === here?.stage && f.q === here?.q);
  return i < 0 ? null : { n: i + 1, total: flow.length };
}

/* ---------- uploads ---------- */

export const MAX_MB = 5;
const TYPE_NAMES = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };

/** How many images an upload question takes (questions.json `max`, at least one). */
export const maxOf = (q) => Math.max(1, Number(q?.max) || 1);

/** The formats a question takes, as words: "JPEG, PNG or WebP". */
export function formatsOf(q) {
  const accept = q?.accept || Object.keys(TYPE_NAMES);
  const names = Object.keys(TYPE_NAMES).filter((t) => accept.includes(t)).map((t) => TYPE_NAMES[t]);
  if (names.length <= 1) return names[0] || "JPEG";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/** The rule an upload question states under its prompt: how many, which formats, how big. */
export function uploadRule(q) {
  const max = maxOf(q);
  const many = max === 1 ? "One image" : `Up to ${max} images, added together or one at a time`;
  return `${many}. ${formatsOf(q)}, up to ${MAX_MB} MB each. Bigger photos are made smaller for you.`;
}

/** The count beside the thumbnails: "2 of up to 6 added". Nothing for a one-image question. */
export function countLine(n, q) {
  const max = maxOf(q);
  if (max === 1 || !n) return max === 1 && n ? "Added" : "";
  if (n >= max) return `${n} of ${max} added. That's the most you can add; use Replace to change one.`;
  return `${n} of up to ${max} added`;
}

/**
 * Which of the picked files to send, given how many are already there: {take, left, room}.
 * A one-image question takes the first file and replaces what's there (the server keeps one).
 */
export function planAdd(have, files, q) {
  const list = Array.from(files || []);
  const max = maxOf(q);
  if (max === 1) return { take: list.slice(0, 1), left: Math.max(0, list.length - 1), room: 1 };
  const room = Math.max(0, max - have);
  return { take: list.slice(0, room), left: Math.max(0, list.length - room), room };
}

/** What to tell the student after adding: how many went in, and why any didn't. */
export function addedLine({ added, left, failed = [] }, q) {
  const parts = [];
  if (added) parts.push(added === 1 ? "Added 1 image." : `Added ${added} images.`);
  if (left) parts.push(`${left === 1 ? "1 more wasn't" : `${left} more weren't`} added: the limit is ${maxOf(q)}. Remove or replace one to add a different one.`);
  if (failed.length) parts.push(failed.length === 1 ? `1 didn't upload: ${failed[0]}` : `${failed.length} didn't upload. ${failed[0]}`);
  return parts.join(" ");
}

/** Whether a dropped or picked file is one the page can send (the server checks the bytes again). */
export function isImageFile(file) {
  return Boolean(file) && /^image\//.test(file.type || "");
}

/* ---------- what a change leaves out of date (server/profile_deps.py) ---------- */

const WHAT = {
  role: "target",
  level: "target",
  stage: "target",
  techInterests: "interests",
  personalInterests: "interests",
  styleWords: "style",
  styleRefs: "style",
  facePhotos: "photos",
  photo: "photos",
  voiceSample: "writing sample",
};

/** "Your style changed", "Your photos and style changed". */
export function changedLine(changed) {
  const what = [...new Set((changed || []).map((id) => WHAT[id]).filter(Boolean))];
  if (!what.length) return "Your answers changed";
  const list = what.length === 1 ? what[0] : `${what.slice(0, -1).join(", ")} and ${what[what.length - 1]}`;
  return `Your ${list} changed`;
}

/**
 * One stale thing as what the page shows: the sentence, the one-click button and what it does.
 * `do` is one of "make-banner", "make-headshot", "position", "projects", "voice", "open-studio".
 */
export function staleItem(item) {
  const lead = changedLine(item.changed);
  switch (item.output) {
    case "banner":
      return { id: "banner", text: `${lead} after your banner options were made. Make new banner options?`, label: "Make 3 new banners", do: "make-banner", costs: true };
    case "headshot":
      return { id: "headshot", text: `${lead} after your headshot options were made. Make new headshot options?`, label: "Make 3 new headshots", do: "make-headshot", costs: true };
    case "position":
      return { id: "position", text: `${lead} after we drafted your LinkedIn headline and About. Draft them again?`, label: "Redraft headline and About", do: "position", costs: true };
    case "projects":
      return { id: "projects", text: `${lead} after your project ideas were written. Write new ones?`, label: "Write new project ideas", do: "projects", costs: true };
    case "voice":
      return item.edited
        ? { id: "voice", text: `${lead} after your voice doc was made. You edited it yourself, so we left it as it is.`, label: "Open my voice doc", do: "open-studio", costs: false }
        : { id: "voice", text: `${lead} after your voice doc was made. Make it again from your new sample?`, label: "Remake my voice doc", do: "voice", costs: true };
    default:
      return null;
  }
}

/** The stale items to show: known outputs only, minus the ones dismissed for this exact change. */
export function staleToShow(stale, dismissed = {}) {
  return (stale || [])
    .map((item) => ({ item, view: staleItem(item) }))
    .filter(({ item, view }) => view && dismissed[item.output] !== item.made_at + "|" + (item.changed || []).join(","))
    .map(({ item, view }) => ({ ...view, key: item.made_at + "|" + (item.changed || []).join(",") }));
}

/** Which answers the map is built from (server/intake_rules.py reads these from the "Who you are" step). */
export const MAP_INPUTS = new Set(["stage", "role", "level", "months", "apps", "stop"]);

/** Whether changing this answer should update a map the app builds. */
export const touchesMap = (qid) => MAP_INPUTS.has(qid);
