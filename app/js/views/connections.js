/**
 * Key Connections (the Jobs tab's home), on its third critique (2026-11-03). One move at the top, drawn from the
 * warmest person, with one solid that opens that exact note. Under it, only the companies where someone exists:
 * each person one line whose length is what they have done toward you (answered a third, talked two thirds,
 * will mention you the end), the stage word at its tip; a hollow ring at zero is someone not written to yet, a
 * filled dot at zero is your note out. Everything waiting, missing or next is one sentence in the margin or at
 * the foot, never a section. Every row opens its own person on the notes screen.
 */

import { el, mount } from "../dom.js?v=3a2df55-202611042206";
import { connectionsOf, activeTargets, tipOf, channelWords, homeMove, addContact, MOVE_RULE, weekdayWord, dayWord, sentThisWeek } from "../search.js?v=3a2df55-202611042206";

const SHOW_FULL = 3;
const FOLD_AT = 5;
const first = (name) => String(name || "").split(/\s+/)[0] || "them";
const shortRole = (title) => String(title || "").split(/\s+-\s+|\s+\|\s+/)[0];
const STAGE = ["new", "sent", "they answered", "you talked", "will mention you", "will mention you"];
const PCT = [0, 0, 33, 67, 100, 100];
const lower = (s) => String(s || "").replace(/^\w/, (m) => m.toLowerCase());
const andList = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function renderConnections(ctx, options = {}) {
  const root = el("div.kc.sw", { class: options.home ? "is-home" : null });
  let current = ctx;
  const open = new Set();
  const showQuiet = new Set();
  let showRule = false;
  const student = () => current.state.student;

  function goSends(targetId, contactId = "") {
    try {
      sessionStorage.setItem("gridschool.sends.focus", targetId);
      if (contactId) sessionStorage.setItem("gridschool.sends.person", contactId); else sessionStorage.removeItem("gridschool.sends.person");
    } catch { /* fine */ }
    location.hash = "#/walk/send";
  }

  /** The waiting line for a person, in the words the notes screen uses (tipOf), never a second formula. */
  function waitWords(p) {
    const tip = tipOf(p);
    const name = first(p.contact.name);
    if (/^one more line /.test(tip.waiting)) return `A short follow-up to ${name} ${tip.waiting.replace(/^one more line /, "")}.`;
    if (tip.waiting === "let it rest") return `${name} has both follow-ups. Let it rest.`;
    return `Waiting on ${name}.`;
  }

  /** The move, shared with the notes screen and the Next bar (search.js homeMove), with what the solid does. */
  function headingFor() {
    const h = homeMove(student(), new Date());
    const a = h.action;
    let button = null;
    if (a?.kind === "open") button = [a.label, () => goSends(a.targetId, a.contactId)];
    else if (a?.kind === "meanwhile") button = [a.label, () => {
      const p = a.pick;
      current.store.updateSearch((x) => ({ targets: addContact(x.targets, a.targetId, { name: p.name, title: p.title, rung: p.rung, why: p.why }) }), { kind: "search.contact", payload: { rung: p.rung } });
      goSends(a.targetId);
    }];
    else if (a?.kind === "companies") button = [a.label, () => { location.hash = "#/walk/targets"; }];
    return { ...h, button };
  }

  /** One person: the name, then the line of light. Hollow at zero = no note yet; filled at zero = your note is
   * out; the line grows only from what they did. Grey past the nudge days. The row opens this person. */
  function row(g, p, { glow = false }) {
    const stage = p.contact.touches?.vouch ? 4 : Math.min(p.stage, 4);
    const pct = PCT[stage] ?? 0;
    const waiting = p.tone === "quiet";
    const requested = stage === 0 && Boolean(p.contact.touches?.request);
    const word = requested ? `request sent ${dayWord(p.contact.touches.request)}` : stage === 1 && p.contact.touches?.note ? `sent ${dayWord(p.contact.touches.note)}` : STAGE[stage] || "new";
    const endClass = [stage === 0 && !requested ? "is-hollow" : null, glow ? "is-glow" : null, waiting && stage > 0 ? "is-quiet" : null].filter(Boolean).join(" ") || null;
    return el("button.kc__row", { type: "button", "aria-label": `${p.contact.name}, ${word}`, onclick: () => goSends(g.target.id, p.contact.id) },
      el("span.kc__who", {}, el("span.kc__name", {}, p.contact.name), p.contact.title ? el("span.kc__title", {}, shortRole(p.contact.title)) : null,
        p.contact.email || p.contact.connected === false ? el("span.kc__title.kc__chan", {}, channelWords(p.contact).replace(/^with a /, "").replace(/^on |^by /, "")) : null,
        el("span.kc__open", {}, "open")),
      el("span.kc__track", { "aria-hidden": "true" }, el("span.kc__rail", {},
        pct ? el("i.kc__line", { class: waiting ? "is-quiet" : null, style: `width:${pct}%` }) : null,
        el("i.kc__end", { class: endClass, style: `left:${pct}%` }),
        el("span.kc__tip", { style: `left:calc(${pct}% + 14px)` }, word))));
  }

  function managerRow(g, heading) {
    const t = g.target;
    const written = Boolean(t.touches?.manager);
    const name = t.manager?.name || "The hiring manager";
    const glow = !written && (heading.id === "manager" || heading.id === "who") && heading.target?.id === t.id;
    return el("button.kc__row", { type: "button", "aria-label": `${name}, ${written ? "you wrote" : "new"}`, onclick: () => goSends(t.id) },
      el("span.kc__who", {}, el("span.kc__name", {}, name), el("span.kc__title", {}, "hires for this role")),
      el("span.kc__track", { "aria-hidden": "true" }, el("span.kc__rail", {},
        el("i.kc__end", { class: [written ? null : "is-hollow", glow ? "is-glow" : null].filter(Boolean).join(" ") || null, style: "left:0" }),
        el("span.kc__tip", { style: "left:14px" }, written ? "you wrote" : "new"))));
  }

  function company(g, heading) {
    const t = g.target;
    const isHeadings = heading.target && heading.target.id === t.id;
    const people = g.people;
    const folded = people.length > FOLD_AT && !open.has(t.id);
    let full = folded ? people.slice(0, SHOW_FULL) : people;
    if (folded && heading.person && !full.some((p) => p.contact.id === heading.person.id)) {
      const hp = people.find((p) => p.contact.id === heading.person.id);
      if (hp) full = [...full, hp];
    }
    const rest = people.filter((p) => !full.includes(p));
    const m = g.move;
    const moveLine = isHeadings ? null
      : m.id === "wait" && m.waiting?.[0] ? el("p.kc__move", {}, waitWords(people.find((p) => p.contact.id === m.waiting[0].id) || { contact: m.waiting[0], stage: 1, tone: "waiting" }))
      : m.id === "done" ? el("p.kc__move", {}, m.detail || "")
      : el("p.kc__move", {}, m.title.replace(/\.?$/, "."));
    const vouched = people.some((p) => p.contact.touches?.vouch);
    const quiet = g.quiet || [];
    return el("section.kc__company", {},
      el("div.kc__chead", {}, el("b", {}, t.company), el("span", {}, shortRole(t.role))),
      null,
      moveLine,
      ...full.map((p) => row(g, p, { glow: Boolean(heading.person && p.contact.id === heading.person.id && !["who", "manager", "wait"].includes(heading.id)) })),
      vouched ? managerRow(g, heading) : null,
      rest.length ? el("p.kc__more", {}, `${rest.length} more. `, el("button.sw__quiet", { type: "button", onclick: () => { open.add(t.id); render(); } }, `Show all ${people.length}`)) : null,
      !rest.length && people.length > FOLD_AT ? el("p.kc__more", {}, el("button.sw__quiet", { type: "button", onclick: () => { open.delete(t.id); render(); } }, "Show fewer")) : null,
      quiet.length ? el("p.kc__more", {}, `${quiet.length} ${quiet.length === 1 ? "hasn't" : "haven't"} written back in two weeks. `,
        el("button.sw__quiet", { type: "button", onclick: () => { if (showQuiet.has(t.id)) showQuiet.delete(t.id); else showQuiet.add(t.id); render(); } }, showQuiet.has(t.id) ? "Hide them" : "Show them")) : null,
      showQuiet.has(t.id) ? quiet.map((p) => row(g, p, {})) : null);
  }

  /** The first week as one row: five names, the rail's marks, the day it ended. */
  function firstWeekRow() {
    const st = current.state;
    const s = st.student?.search || {};
    const lit = (id) => st.graph?.byId?.get(id)?.status === "lit";
    const noteDay = activeTargets(st.student).flatMap((t) => t.people || []).map((c) => c.touches?.note).filter(Boolean).sort()[0];
    const steps = [
      ["Work", true], ["Resume", lit("b.resume") || Boolean(s.resume)], ["LinkedIn", Boolean(s.profileAt)],
      ["Companies", activeTargets(st.student).length > 0], ["First notes", Boolean(noteDay)],
    ];
    return el("section.kc__week", {},
      el("span.sw__eyebrow", {}, noteDay ? `Your first week · done ${weekdayWord(noteDay)}` : "Your first week"),
      el("ol.kc__weekrow", {}, ...steps.map(([name, done]) => el("li", { class: done ? "is-done" : null, onclick: () => { location.hash = `#/walk/${["interview", "resume", "linkedin", "targets", "send"][steps.findIndex(([n]) => n === name)]}`; } }, el("i", { "aria-hidden": "true" }), el("span", {}, name)))));
  }

  /** The margin's one line: what comes after the move, from the next group's own move. */
  function nextLine(h, ordered) {
    if (h.id === "wait" && h.person) return `When ${first(h.person.name)} writes back, open ${first(h.person.name)}'s row and paste it. We write your reply.`;
    const after = ordered.filter((g) => g !== h.group && g.move.id !== "done");
    const g = after[0];
    if (!g) return "";
    // "After" names the person the move is to: the manager on the manager move, never the voucher.
    const hw = h.id === "manager" ? first(h.target?.manager?.name || "the manager") : h.id === "who" ? "that" : h.person ? first(h.person.name) : h.target ? h.target.company : "";
    const prefix = hw ? `After ${hw}, ` : "";
    const m = g.move;
    if (m.id === "model" || m.id === "pick") return `${prefix}we find who to write to at ${g.target.company}.`;
    if (m.id === "wait" && m.waiting?.[0]) {
      const p = g.people.find((x) => x.contact.id === m.waiting[0].id);
      const tip = p ? tipOf(p) : { waiting: "" };
      if (/^one more line /.test(tip.waiting)) return `${prefix}${first(m.waiting[0].name)}'s line opens ${tip.waiting.replace(/^one more line /, "")}.`;
      return `${prefix}${first(m.waiting[0].name)} has your note.`;
    }
    return `${prefix}${lower(m.title).replace(/\.?$/, ".")}`;
  }

  function render() {
    const now = new Date();
    const h = headingFor();
    const groups = h.groups || connectionsOf(student(), now).groups;
    const head = el("header.kc__head", {},
      el("h2.sw__move", {}, h.title),
      h.lead ? el("p.sw__lead", {}, h.lead) : null,
      options.home ? el("p.kc__rule", {}, el("button.sw__quiet", { type: "button", onclick: () => { showRule = !showRule; render(); } }, showRule ? "Hide the order" : "Why this order")) : null,
      options.home && showRule ? el("ul.kc__ladder", {}, ...MOVE_RULE.map((line) => el("li", {}, line))) : null,
      h.button ? el("div.sw__acts", {}, el("button.sw__solid", { type: "button", onclick: h.button[1] }, h.button[0])) : null);
    // The home carries the first week as one quiet row: the walk's five names, the rail's marks, all done.
    const week = options.home ? firstWeekRow() : null;
    const ordered = [...groups].sort((a, b) => (h.target && a.target.id === h.target.id ? -1 : h.target && b.target.id === h.target.id ? 1 : b.heat - a.heat));
    const drawn = ordered.filter((g) => g.people.length || (g.quiet || []).length);
    const empty = ordered.filter((g) => !g.people.length && !(g.quiet || []).length);
    const blocks = drawn.map((g) => company(g, h));
    // Companies with nobody yet are one sentence, each name the way in, never a section of their own.
    const foot = empty.length ? el("p.kc__more", {}, "No one yet at ",
      ...empty.flatMap((g, i) => [el("button.sw__quiet", { type: "button", onclick: () => goSends(g.target.id) }, g.target.company), i < empty.length - 2 ? ", " : i === empty.length - 2 ? " and " : ""]), ".") : null;
    const next = nextLine(h, ordered);
    const margin = el("aside.sw__aside", {},
      next ? el("section.sw__note", {}, el("span.sw__eyebrow", {}, "What happens next"), el("p.is-first", {}, next)) : null,
      options.home ? el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Your plan"),
        el("p.is-first", {}, `Up to five companies, then a second person at each once its first note has had three days. Sent this week: ${sentThisWeek(student(), new Date())}.`),
        el("p", {}, "Replies take three to seven days. A short follow-up at three keeps you in view; one more at seven. We write them, you send them.")) : null,
      activeTargets(student()).length ? el("section.sw__note", {}, el("p", {}, el("a.sw__quiet", { href: "#/do/people" }, "Add someone you already know at a company")),
        options.home ? el("p", {}, el("a.sw__quiet", { href: "#/map/all" }, "Your map")) : null) : null);
    mount(root, el("div.kc__main", {}, head, week, ...blocks, foot), margin);
  }

  render();
  return { node: root, update(next) { current = next; render(); } };
}
