/**
 * One map, nodes and lines only (ops/map-design.md).
 *
 * Beside "You are here" the map draws what is ready for the student as plain
 * nodes in their lanes, each tagged with who made it ("Prepared for you",
 * "Found for you", "Drafted for you"); the one next move is the white node.
 * Aden's open items are one plain sentence above the map. No queues or counts.
 *
 * readyItems()/doneForYou() build that from records that already exist, so
 * every node is true. nextMove() is the single answer to "what now", in a fixed
 * order of rules, each with a plain reason; `fed` says which ready kind made it.
 *
 * Pure: the map (graph/rez) draws these; the tools live in views/hire.js.
 */

import { nextUp } from "./graph/model.js?v=fbad271-202610110101";
import {
  searchOf,
  careerOf,
  peopleOf,
  toAsk,
  followUps,
  active,
  thisWeek,
  dueTouches,
  activeTargets,
  networkOf,
  insideConnections,
  shortTitle,
} from "./search.js?v=fbad271-202610110101";

export const TOOLS = {
  today: { label: "Today", hint: "Every move for today, in order" },
  targets: { label: "Targets", hint: "Five companies, every channel: email with a Loom, LinkedIn, a call, follow-ups" },
  people: { label: "People", hint: "Former colleagues first: your warm way in" },
  applications: { label: "Applications", hint: "Fresh roles, prepared one at a time; everything you've sent" },
  profile: { label: "Profile", hint: "Your story, headline, resume and portfolio" },
};

/** The lane of the map each kind of move belongs to. */
const LANE = { today: "interview", targets: "pipeline", profile: "presence", people: "network", applications: "pipeline", follow: "pipeline", insider: "network" };

/** Ready items show at most this many; the rest are a count. */
export const READY_SHOWN = 3;

function readyItems({ student, roles = [], packs = {} }) {
  const s = searchOf(student);
  const applied = new Set(s.apps.map((a) => a.roleKey).filter(Boolean));
  const asked = new Set(peopleOf(student).map((p) => `${p.name}|${p.company}`.toLowerCase()));
  const items = [];
  for (const { role, people } of insideConnections(roles.filter((r) => !applied.has(r.key)), networkOf(student))) {
    const person = people.find((p) => !asked.has(`${p.name}|${p.company}`.toLowerCase()));
    if (person) items.push({ kind: "insider", tool: "today", label: `You know ${person.name} at ${role.company}`, person, role });
  }
  for (const target of activeTargets(student)) {
    if (target.campaign && !target.touches?.email) items.push({ kind: "campaign", tool: "targets", label: `Campaign ready: ${target.company}`, target });
  }
  for (const [key, entry] of Object.entries(packs)) {
    if (applied.has(key) || entry?.pack?.fit_level === "weak" || key.startsWith("pasted:")) continue;
    items.push({ kind: "prepared", tool: "applications", label: `Prepared: ${entry.role?.company ?? "a role"}`, key, at: entry.at });
  }
  return items;
}

/** The column above the line: three rows, honest counts, at most READY_SHOWN named. */
export function doneForYou({ student, roles = [], packs = {} }) {
  const s = searchOf(student);
  const applied = new Set(s.apps.map((a) => a.roleKey).filter(Boolean));
  const found = roles.filter((r) => !applied.has(r.key) && !packs[r.key]).length;
  const onIt = (careerOf(student).working ?? []).filter((w) => !w.done && w.text).map((w) => ({ kind: "aden", tool: "today", label: `Aden is on: ${w.text}` }));
  const ready = readyItems({ student, roles, packs });
  return { found, onIt, ready, readyShown: ready.slice(0, READY_SHOWN), readyMore: Math.max(0, ready.length - READY_SHOWN) };
}

/**
 * The one next move: { title, why, lane, tool | stepId, fed }. Rules, in order:
 * a booked conversation, someone you know inside, a target touch due, profile
 * live, a warm ask, a follow-up, a prepared application, the next map step.
 * `fed` names the Ready kind that produced it (the map tags the node with it).
 */
export function nextMove({ student, graph, now = new Date(), roles = [], packs = {} }) {
  const s = searchOf(student);
  const career = careerOf(student);
  const make = (kind, title, why, fed = null) => ({ tool: kind === "insider" || kind === "follow" ? "today" : kind, kind, title, why, lane: LANE[kind], fed });

  const conversation = active(s.apps).find((a) => a.stage === "screen" || a.stage === "interview");
  if (conversation) return make("today", `Prepare for your ${conversation.company} ${conversation.stage}`, "A conversation is booked. Nothing else matters as much today.");
  const ready = readyItems({ student, roles, packs });
  const insider = ready.find((r) => r.kind === "insider");
  if (insider) return make("insider", `Ask ${insider.person.name} at ${insider.role.company}`, `You know someone inside a company that's hiring for ${shortTitle(insider.role.title)}.`, "insider");
  const touch = dueTouches(student?.search?.targets ?? [], now)[0];
  if (touch) return make("targets", `${touch.target.company}: ${touch.label}`, touch.kind === "day0" ? "The campaign is written. Today it goes out." : "A follow-up is due on a company you chose.", touch.target.campaign && !touch.target.touches?.email ? "campaign" : null);
  if (career.headline && !s.profileAt) return make("profile", "Put your new headline and About on LinkedIn", "Recruiters search all day. Until this is live, they can't find you.");
  const ask = toAsk(peopleOf(student))[0];
  if (ask) return make("people", `Ask ${ask.name}${ask.company ? ` at ${ask.company}` : ""}`, "Asking someone you know beats an application almost every time.");
  const due = followUps(s.apps, now)[0];
  if (due) return make("follow", `Follow up with ${due.company}`, "Most replies come after a follow-up, not the first message.");
  const prepared = ready.find((r) => r.kind === "prepared");
  if (prepared && thisWeek(s.apps, now).apply < career.targets.apply) return make("applications", `Apply: ${prepared.label.replace(/^Prepared: /, "")}`, "Prepared for you: read it, send it, log it.", "prepared");
  if (thisWeek(s.apps, now).apply < career.targets.apply) return make("applications", "Prepare and send today's applications", "Fresh roles that fit get read. Early and specific beats many.");
  const step = nextUp(graph);
  if (step) return { stepId: step.id, title: step.title, why: step.why ?? "The next step on your map.", lane: step.family, fed: null, kind: "step" };
  return { tool: "today", kind: "rest", title: "You're clear for today", why: "Rest is part of a long search.", lane: null, fed: null };
}

/** How many more moves are waiting today after the next one (for "+N more today"). */
export function movesAfterNext({ student, now = new Date(), roles = [], packs = {} }) {
  const s = searchOf(student);
  const n =
    dueTouches(student?.search?.targets ?? [], now).length +
    followUps(s.apps, now).length +
    Math.min(toAsk(peopleOf(student)).length, 3) +
    readyItems({ student, roles, packs }).filter((r) => r.kind !== "campaign").length +
    active(s.apps).filter((a) => a.stage === "screen" || a.stage === "interview").length +
    (careerOf(student).headline && !s.profileAt ? 1 : 0);
  return Math.max(0, n - 1);
}
