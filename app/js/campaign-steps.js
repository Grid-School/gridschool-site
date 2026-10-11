/**
 * A target campaign as a row of nodes, one open at a time: research the
 * company and the person, write the Loom script, record it, then each
 * channel in the order it goes out. A node is done when the student's own
 * record says so (a contact saved, a script with no blanks, a Loom link, a
 * touch marked Sent), never by a flag we set for them. Pure, for node tests.
 */

import { BEATS, tidyAnswers, blanksLeft } from "./loom-script.js?v=dc96989-202610110117";

export const NODES = [
  { id: "who", label: "Research" },
  { id: "script", label: "Script" },
  { id: "record", label: "Record" },
  { id: "email", label: "Email" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "call", label: "Call" },
  { id: "follow", label: "Follow-ups" },
];

export const NODE_IDS = NODES.map((n) => n.id);

/** The questions, one per slide, with the part each belongs to. */
export const SLIDES = BEATS.flatMap((beat, part) => beat.blanks.map((blank) => ({ ...blank, part, partName: beat.name })));

/** A part is done when every question in it has an answer with no "___" left. */
export function partDone(answers, part) {
  const a = tidyAnswers(answers);
  return BEATS[part].blanks.every((b) => a[b.id] && !/_{2,}/.test(a[b.id]));
}

export function scriptDone(answers) {
  return BEATS.every((_, part) => partDone(answers, part)) && blanksLeft(answers) === 0;
}

export function nodeDone(target, id) {
  const t = target ?? {};
  const touched = (k) => Boolean(t.touches?.[k]);
  switch (id) {
    // A later step already done counts for the earlier ones it needed: a Loom
    // recorded before the script builder existed, an email sent before the
    // contact was saved. Otherwise older campaigns would reopen on step 1.
    case "who":
      return Boolean(t.contact?.name || t.contact?.email || t.contact?.linkedin || touched("email") || touched("linkedin") || touched("call"));
    case "script":
      return scriptDone(t.loomScript) || Boolean(t.loomUrl);
    case "record":
      return Boolean(t.loomUrl);
    case "email":
    case "linkedin":
    case "call":
      return touched(id);
    case "follow":
      return touched("d3") && touched("d7") && touched("d14");
    default:
      return false;
  }
}

export const doneNodes = (target) => NODE_IDS.filter((id) => nodeDone(target, id));

/** Where the drawer opens: the first node not done yet, or the last one. */
export function firstOpen(target) {
  return NODE_IDS.find((id) => !nodeDone(target, id)) ?? NODE_IDS[NODE_IDS.length - 1];
}

export function nextNode(id) {
  const i = NODE_IDS.indexOf(id);
  return i >= 0 && i < NODE_IDS.length - 1 ? NODE_IDS[i + 1] : null;
}

export function prevNode(id) {
  const i = NODE_IDS.indexOf(id);
  return i > 0 ? NODE_IDS[i - 1] : null;
}

export const labelOf = (id) => NODES.find((n) => n.id === id)?.label ?? id;

/**
 * Where one company's Loom stands, for the "Your Looms" list on Hire:
 * sent (with the date the email went), recorded, script ready, or script
 * started. Null when the student hasn't started a Loom for it.
 */
export function loomStatus(target) {
  const t = target ?? {};
  const sentOn = t.touches?.email;
  if (sentOn && t.loomUrl) return { key: "sent", label: `Sent ${sentOn}`, done: true };
  if (t.loomUrl) return { key: "recorded", label: "Recorded, email not sent yet", done: false };
  if (scriptDone(t.loomScript)) return { key: "script", label: "Script ready, not recorded yet", done: false };
  if (Object.keys(tidyAnswers(t.loomScript)).length) return { key: "writing", label: "Script in progress", done: false };
  return null;
}
