/**
 * Your first notes (the walk's last screen), on the 2026-11-03 critique. One move at a time on one company,
 * and the student does only what they can do: copy a page, send a note, paste what came back. The company is
 * worked out when it's picked (targets-pick.js), so this opens on a move. Nothing here that depends on someone
 * else is dressed as a task; waiting is the paste zone, open. The first week ends at the first note sent.
 * Every line a student might send comes through the gate, and the count line shows what the gate flags.
 */

import { el, mount } from "../dom.js?v=3a2df55-202611042206";
import { copy, toast } from "../ui.js?v=3a2df55-202611042206";
import { isProgressReadOnly } from "../store.js?v=3a2df55-202611042206";
import { draftApproach, pickPeople, readProfile, draftReply, draftManager, findReach } from "../roles-remote.js?v=3a2df55-202611042206";
import {
  activeTargets, searchOf, touchTarget, patchTarget, addApp,
  peopleOnTarget, addContact, patchContact, touchContact, targetMove, weekdayWord, channelOf,
} from "../search.js?v=3a2df55-202611042206";
import { workPanel } from "./work.js?v=3a2df55-202611042206";
import { noteTells } from "../note-tells.js?v=3a2df55-202611042206";

const APPROACH_STEPS = [
  { id: "read", label: "Reading the posting" },
  { id: "model", label: "Working out the team" },
  { id: "people", label: "Deciding who to write to first" },
];
const PICK_STEPS = [{ id: "read", label: "Reading the people you copied" }, { id: "pick", label: "Picking who to write to first" }];
const PROFILE_STEPS = [{ id: "read", label: "Reading their page" }, { id: "write", label: "Writing a first note that asks for nothing" }, { id: "reach", label: "Finding a way to reach them" }];
const REPLY_STEPS = [{ id: "read", label: "Reading what they wrote" }, { id: "write", label: "Writing your next line" }];
const MANAGER_STEPS = [{ id: "write", label: "Writing the note, with the name first" }];
const WEEK_GOAL = 5;

const linkedinSearch = (company, words) =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${company} ${words || ""}`.trim())}`;
const first = (name) => String(name || "").split(/\s+/)[0] || "there";
const shortRole = (title) => String(title || "").split(/\s+-\s+|\s+\|\s+/)[0];
const phone = () => /iPhone|Android|iPad/i.test(navigator.userAgent) && window.matchMedia("(max-width: 900px)").matches;
const solid = (label, onclick) => el("button.sw__solid", { type: "button", onclick }, label);
const ghost = (label, onclick) => el("button.sw__ghost", { type: "button", onclick }, label);
const quiet = (label, onclick) => el("button.sw__quiet", { type: "button", onclick }, label);
const openLink = (label, href) => el("a.sw__solid.sw__solid--link", { href, target: "_blank", rel: "noopener" }, label);

export function renderSendsWeek(ctx, options = {}) {
  const root = el("div.sw");
  let current = ctx;
  let slug = ctx.state.slug;
  const working = new Map();
  const tried = new Set();
  const drafts = new Map();
  let focus = null;
  let person = null;
  /** Key Connections hands over a company and a person through sessionStorage; the walk keeps this screen alive
   * between visits, so the keys are read on every update, not only when the screen is first built. */
  function readFocus() {
    try {
      const f = sessionStorage.getItem("gridschool.sends.focus");
      if (f) { focus = f; person = sessionStorage.getItem("gridschool.sends.person") || null; }
      sessionStorage.removeItem("gridschool.sends.focus");
      sessionStorage.removeItem("gridschool.sends.person");
    } catch { /* fine */ }
  }
  readFocus();

  const readOnly = () => isProgressReadOnly();
  const student = () => current.state.student;
  const save = (change, event = null) => current.store.updateSearch(change, event);
  const target = (id) => activeTargets(student()).find((t) => t.id === id);

  function sentThisWeek() {
    const since = Date.now() - 7 * 86400000;
    return (searchOf(student()).apps || []).filter((a) => a.date && new Date(a.date).getTime() >= since).length;
  }
  const roleOf = (t) => (t.roleKey ? { roleKey: t.roleKey } : { role: { company: t.company, title: t.role, url: t.link, description: t.posting || t.why } });

  /* ---------- the work ---------- */

  async function run(key, panel, job) {
    if (working.has(key) || readOnly()) return;
    working.set(key, panel);
    render();
    try { await job(); panel.complete(); }
    catch (e) { toast(e.message, "warn"); }
    finally { panel.stop(); working.delete(key); render(); }
  }

  function build(t) {
    if (t.approach || tried.has(t.id)) return;
    tried.add(t.id);
    run(t.id, workPanel({ title: `Reading ${t.company}'s posting`, steps: APPROACH_STEPS }), async () => {
      const result = await draftApproach(slug, roleOf(t));
      save((x) => ({ targets: patchTarget(x.targets, t.id, { approach: result.approach }) }), { kind: "search.approach", payload: { company: t.company } });
    });
  }

  function pick(t, text) {
    run(`pick:${t.id}`, workPanel({ title: "Finding who to write to", steps: PICK_STEPS }), async () => {
      const result = await pickPeople(slug, { company: t.company, ...roleOf(t), approach: t.approach, text });
      save((x) => ({ targets: patchTarget(x.targets, t.id, { picks: result }) }), { kind: "search.pick", payload: { company: t.company, picked: result.people.filter((p) => p.pick).length } });
      // The first pick becomes the person to write to, so the next move is one move.
      const top = result.people.find((p) => p.pick);
      if (top && !peopleOnTarget(target(t.id)).some((c) => c.name.toLowerCase() === top.name.toLowerCase())) {
        save((x) => ({ targets: addContact(x.targets, t.id, { name: top.name, title: top.title, rung: top.rung, why: top.why }) }), { kind: "search.contact", payload: { company: t.company, rung: top.rung } });
      }
    });
  }

  function readPage(t, c, text) {
    run(c.id, workPanel({ title: `Reading ${first(c.name)}'s page`, steps: PROFILE_STEPS }), async () => {
      const r = await readProfile(slug, { company: t.company, person: { name: c.name, title: c.title, rung: c.rung }, approach: t.approach, text });
      const plain = r.plain || "";
      save((x) => ({ targets: patchContact(x.targets, t.id, c.id, {
        read: r.read, channelWhy: r.channel_why, thing: r.thing, connect: r.connect, connected: r.connected, subject: r.subject || "",
        note: plain || r.note, alt: plain ? r.note : "", register: plain ? "plain" : "specific",
        lint: plain ? (r.plain_lint || []) : (r.lint || []), altLint: plain ? (r.lint || []) : [],
      }) }));
      // Then the way to reach them: the page, their GitHub commits, the company's pattern, the web. Never blocks
      // the note; "none" is an answer and the note goes on LinkedIn.
      try {
        const others = peopleOnTarget(target(t.id)).filter((x) => x.id !== c.id && x.email && !x.emailBad);
        const reach = await findReach(slug, { company: t.company, person: { name: c.name, title: c.title, rung: c.rung }, text, domain: t.link || "", known: others.map((x) => x.email), knownNames: others.map((x) => x.name) });
        save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { email: reach.email || "", emailSource: reach.source || "", emailConfidence: reach.confidence || "none", github: reach.github || "", site: reach.site || "", domain: reach.domain || "" }) }),
          { kind: "search.reach", payload: { company: t.company, confidence: reach.confidence || "none" } });
      } catch { /* the note still goes, on LinkedIn */ }
    });
  }

  /** The email as a mailto, so the mail app opens with everything filled in: one press, then "I sent it". */
  function mailto(c, text) {
    const subject = c.subject || (c.thing ? c.thing.split(/[.(]/)[0].trim().slice(0, 60) : "A question from another engineer");
    return `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }
  const reachWords = (c) => (c.emailConfidence === "pattern" ? `${c.emailSource}. A likely guess.` : c.emailSource === "you" ? "You added it." : c.emailSource ? `From ${c.emailSource}.` : "");

  function readReply(t, c, text) {
    run(c.id, workPanel({ title: `Reading what ${first(c.name)} wrote`, steps: REPLY_STEPS }), async () => {
      const r = await draftReply(slug, { company: t.company, person: { name: c.name, title: c.title, rung: c.rung }, approach: t.approach, text, sent: c.note });
      save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { reply: text, replyKind: r.branch, replyRead: r.read, next: r.next, nextLint: r.lint || [], replies: (c.replies || 0) + 1, touches: { reply: new Date().toISOString().slice(0, 10) } }) }),
        { kind: "search.reply", payload: { company: t.company, branch: r.branch } });
    });
  }

  function writeManager(t, c) {
    run(`manager:${t.id}`, workPanel({ title: `Writing to ${first(t.manager.name)}`, steps: MANAGER_STEPS }), async () => {
      const r = await draftManager(slug, { company: t.company, manager: t.manager.name, peer: c.name, handle: c.said || "" });
      save((x) => ({ targets: patchTarget(x.targets, t.id, { manager: { note: r.note, lint: r.lint || [] } }) }));
    });
  }

  const logSend = (t, { contact = "", note }) => (x) => ({ apps: addApp(x.apps, { kind: "warm", company: t.company, role: t.role, contact, note }) });
  const sentToast = () => toast(`Sent. ${Math.min(sentThisWeek(), WEEK_GOAL)} of ${WEEK_GOAL} this week.`);

  function sentNote(t, c) {
    save((x) => ({ ...logSend(t, { contact: c.name, note: `First note to ${c.name}` })(x), targets: touchContact(x.targets, t.id, c.id, "note") }),
      { kind: "search.logged", payload: { kind: "warm", company: t.company, from: `peer:${c.rung}`, register: c.register || "plain" } });
    sentToast();
    options.onSent?.();
    render();
  }
  function sentBack(t, c) {
    save((x) => ({ ...logSend(t, { contact: c.name, note: `Wrote back to ${c.name}` })(x), targets: patchContact(x.targets, t.id, c.id, { backs: (c.backs || 0) + 1, reply: "", next: "", touches: { back: new Date().toISOString().slice(0, 10) } }) }),
      { kind: "search.logged", payload: { kind: "warm", company: t.company, from: `back:${c.replyKind || "reply"}` } });
    sentToast();
    render();
  }
  function sentLine(t, c, touch, label) {
    save((x) => ({ ...logSend(t, { contact: c.name, note: label })(x), targets: touchContact(x.targets, t.id, c.id, touch) }), { kind: "search.logged", payload: { kind: "warm", company: t.company, from: touch } });
    sentToast();
    render();
  }
  function touched(t, c, touch, label) {
    save((x) => ({ targets: touchContact(x.targets, t.id, c.id, touch) }), { kind: "search.touch", payload: { company: t.company, touch } });
    if (label) toast(label);
    render();
  }

  /* ---------- pieces ---------- */

  /** A paste zone that reads on paste: one line of instruction, the zone, and the solid that opens the page. */
  /** A paste zone that reads on paste: the three steps as numbered lines, the solid is the link in the first,
   * nothing else says where to go. `steps` is [solid link, line two]; the zone's own line is "Paste here." */
  function zone({ id, open, onText, second = "Select all and copy.", hint = "Paste here." }) {
    const text = el("textarea.sw__zone", { rows: 5, "aria-label": hint });
    text.value = drafts.get(id) || "";
    const wrap = el("div.sw__zonewrap", { class: text.value ? "has-text" : null }, text, el("span.sw__zonehint", { "aria-hidden": "true" }, hint));
    text.addEventListener("input", () => { drafts.set(id, text.value); wrap.classList.toggle("has-text", Boolean(text.value)); });
    text.addEventListener("paste", () => setTimeout(() => { if (text.value.trim().length >= 40) { drafts.delete(id); onText(text.value); } }, 0));
    return el("div.sw__main", {},
      el("ol.sw__steps", {}, el("li", {}, open), el("li", {}, second), el("li", {}, "Paste it here.")),
      wrap,
      text.value.trim().length >= 40 ? el("div.sw__acts", {}, ghost("Read it", () => { drafts.delete(id); onText(text.value); })) : null);
  }

  /** Under a letter: nothing when it's clean (the absence of orange is the verdict), the flags in orange when not. */
  function count(text, { flags = [] } = {}) {
    if (flags.length) return el("span.sw__count.is-warn", {}, `Worth a look: ${flags.join("; ")}.`);
    return el("span");
  }

  /** An outgoing message: the letter on the sheet, editable, re-checked as it's edited, with the two buttons. */
  function letter(t, c, { field, touch, onSent, lintField = "lint", kind = "first", under = null, max = 0, byEmail = false }) {
    const text0 = c[field] || "";
    const sent = c.touches?.[touch];
    const sheet = el("article.sw__letter", { contenteditable: sent || readOnly() ? "false" : "plaintext-only", "aria-label": `Your note to ${c.name}`, spellcheck: "true" });
    sheet.textContent = text0;
    const countEl = el("span");
    const check = (text) => {
      // A character cap is a target the student can aim at: it shows, and goes orange when crossed.
      if (max) { const n = text.length; countEl.replaceChildren(el("span.sw__count", { class: n > max ? "is-warn" : null }, n > max ? `${n} of ${max}. LinkedIn stops at ${max}.` : `${n} of ${max}`)); return; }
      countEl.replaceChildren(count(text, { flags: kind === "first" ? noteTells(text, { sender: student()?.name }) : (c[lintField] || []) }));
    };
    check(text0);
    sheet.addEventListener("input", () => check(sheet.innerText.trim()));
    sheet.addEventListener("blur", () => { const text = sheet.innerText.trim(); if (text && text !== text0) save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { [field]: text }) })); });
    const page = c.link || linkedinSearch(t.company, c.name);
    return el("div.sw__main", {},
      sheet,
      el("div.sw__under", {}, countEl, el("div.sw__acts", {},
        byEmail
          ? el("a.sw__ghost", { href: mailto(c, sheet.innerText), onclick: () => copy(sheet.innerText, "Copied, in case the mail app doesn't open.") }, "Open in your mail app")
          : ghost(`Copy and open ${first(c.name)}'s page`, () => { copy(sheet.innerText, "Copied."); window.open(page, "_blank", "noopener"); }),
        sent ? el("span.sw__num", {}, `Sent ${weekdayWord(sent)}`) : readOnly() ? null : solid("I sent it", onSent))),
      under);
  }

  function note(label, lines) {
    const items = lines.filter(Boolean);
    if (!items.length) return null;
    return el("section.sw__note", {}, el("span.sw__eyebrow", {}, label), ...items.map((line, i) => el("p", { class: i === 0 ? "is-first" : null }, line)));
  }

  /* ---------- the moves ---------- */

  /** The next person picked for this company who isn't on it yet, so "meanwhile" is one press, not a door. */
  function nextPick(t) {
    const names = new Set(peopleOnTarget(t).map((x) => x.name.toLowerCase()));
    return (t.picks?.people || []).find((p) => p.pick && !names.has(p.name.toLowerCase())) || null;
  }
  function meanwhile(t) {
    if (readOnly()) return null;
    // Breadth before depth (search.js homeMove): a second company first, and no second note into a team until
    // its first note has had three days.
    const settled = peopleOnTarget(t).every((c) => !c.touches?.note || (Date.now() - new Date(c.touches.note).getTime()) >= 3 * 86400000);
    const p = settled ? nextPick(t) : null;
    if (activeTargets(student()).length < 5) return options.walk ? null : el("a.sw__quiet", { href: "#/walk/targets" }, "Add a second company meanwhile");
    if (p) return quiet(`Write to ${first(p.name)} meanwhile`, () => { save((z) => ({ targets: addContact(z.targets, t.id, { name: p.name, title: p.title, rung: p.rung, why: p.why }) }), { kind: "search.contact", payload: { company: t.company, rung: p.rung } }); render(); });
    return el("a.sw__quiet", { href: "#/map" }, "Back to Home");
  }

  function moveView(t, m) {
    const a = t.approach || {};
    const c = m.contact;
    const who = c ? first(c.name) : "";
    const theirPage = c ? (c.link || linkedinSearch(t.company, c.name)) : "";
    const onPhone = phone();
    switch (m.id) {
      case "model":
        return { title: `Reading ${t.company}'s posting.`, lead: "About a minute.", body: working.get(t.id)?.node || (tried.has(t.id) ? el("div.sw__main", {}, el("p.sw__lead", {}, "We couldn't read the posting."), el("div.sw__acts", {}, solid("Try again", () => { tried.delete(t.id); build(t); }))) : null), margin: floor(t) };
      case "pick":
        if (onPhone) return { title: "Finish this one on a computer.", lead: "LinkedIn's app won't let you copy a page.", body: el("div.sw__acts", {}, solid("Finish later", () => { location.hash = "#/map"; })) };
        return { title: `Find who to write to at ${t.company}.`, body: working.get(`pick:${t.id}`)?.node || zone({
          id: `pick:${t.id}`,
          open: openLink(`Open people at ${t.company}`, linkedinSearch(t.company, m.search)),
          onText: (text) => pick(t, text),
        }), margin: floor(t) };
      case "add":
      case "read": {
        const person = m.id === "add" ? m.pick : c;
        const name = first(person.name);
        const page = person.link || linkedinSearch(t.company, person.name);
        if (onPhone) return { title: "Finish this one on a computer.", lead: "LinkedIn's app won't let you copy a page.", body: el("div.sw__acts", {}, solid("Finish later", () => { location.hash = "#/map"; })) };
        const body = (c && working.get(c.id)?.node) || zone({
          id: `page:${t.id}:${person.id || person.name}`,
          open: openLink(`Open ${name}'s page`, page),
          onText: (text) => {
            if (m.id === "add") {
              save((x) => ({ targets: addContact(x.targets, t.id, { name: person.name, title: person.title, rung: person.rung, why: person.why }) }), { kind: "search.contact", payload: { company: t.company, rung: person.rung } });
              const made = peopleOnTarget(target(t.id)).find((x) => x.name === person.name);
              if (made) readPage(target(t.id), made, text);
            } else readPage(t, c, text);
          },
        });
        return { title: `Copy ${name}'s LinkedIn page.`, body, margin: [note(`Why ${name}`, [person.why]), ...floor(t, { why: false })] };
      }
      case "send": {
        const channel = channelOf(c);
        const requested = Boolean(c.touches?.request);
        const pin = (ch, label) => quiet(label, () => { save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { channelPinned: ch }) })); render(); });
        if (channel === "email") {
          return { title: `Send your note to ${who}.`, lead: `By email, to ${c.email}. Change any word, then send it.`,
            body: letter(t, c, { field: "note", touch: "note", onSent: () => sentNote(t, c), byEmail: true,
              under: readOnly() ? null : el("p.sw__lead", {}, pin(c.connected === false ? "request" : "linkedin", "Send it on LinkedIn instead")) }),
            margin: whyAndWho(t, c) };
        }
        if (channel === "request" && c.connect && !requested) {
          // LinkedIn gives a free account a handful of notes a month. When they're out: email if we have an
          // address, else the request goes alone and the note follows as a message once it's accepted.
          const outOfNotes = c.email && !c.emailBad
            ? pin("email", `LinkedIn won't take a note? Send it by email to ${c.email}`)
            : quiet("LinkedIn won't take a note? Send the request without one", () => touched(t, c, "request", `Request sent. When ${who} accepts, the note goes as a message.`));
          return { title: `Send ${who} a connection request.`, lead: `On ${who}'s page, press Connect, then Add a note.`,
            body: letter(t, { ...c, note: c.connect }, { field: "connect", touch: "note", onSent: () => sentNote(t, c), max: 200, under: readOnly() ? null : el("p.sw__lead", {}, outOfNotes) }),
            margin: whyAndWho(t, c) };
        }
        return { title: `Send your note to ${who}.`, lead: requested ? `Once ${who} accepts your request, send this as a message on LinkedIn.` : `Change any word, then send it on LinkedIn, as a message to ${who}.`,
          body: letter(t, c, { field: "note", touch: "note", onSent: () => sentNote(t, c), under: readOnly() || !c.email || c.emailBad ? null : el("p.sw__lead", {}, pin("email", `Send it by email to ${c.email} instead`)) }),
          margin: whyAndWho(t, c) };
      }
      case "nudge": {
        const f = (a.followups || []).find((x) => x.day === m.day);
        const line = { ...c, nudge: f?.text || "", nudgeLint: (a.lints?.followups || [])[m.day === 3 ? 0 : 1] || [] };
        return { title: `A short follow-up to ${who}.`, lead: "One new thing, then leave it.",
          body: letter(t, line, { field: "nudge", touch: `nudge${m.day}`, onSent: () => sentLine(t, c, `nudge${m.day}`, `Day ${m.day} line to ${c.name}`), lintField: "nudgeLint", kind: "reply" }), margin: whyAndWho(t, c) };
      }
      case "reply":
        return { title: `Paste what ${who} wrote back.`, body: working.get(c.id)?.node || zone({ id: `reply:${c.id}`, open: openLink(`Open the thread with ${who}`, theirPage), second: "Copy their words.", onText: (text) => readReply(t, c, text) }), margin: whyAndWho(t, c) };
      case "back":
        return { title: `Write back to ${who}.`, lead: "Change any word, then send it.",
          body: letter(t, c, { field: "next", touch: "back", onSent: () => sentBack(t, c), lintField: "nextLint", kind: "reply" }),
          margin: [note(`What ${who} said`, [`“${String(c.reply || "").split(/(?<=[.!?])\s/)[0].slice(0, 160)}”`]), ...whyAndWho(t, c)] };
      case "wait": {
        const w = m.waiting?.[0] || c;
        if (!w) return { title: m.title, lead: m.detail, body: el("div.sw__main", {}, meanwhile(t)), margin: floor(t) };
        const wn = first(w.name);
        return { title: m.ask ? `${wn} has your ask.` : `${wn} has your note.`, lead: m.ask ? `When ${wn} answers, paste it here.` : m.detail,
          body: working.get(w.id)?.node || zone({ id: `reply:${w.id}`, open: el("a.sw__quiet", { href: w.link || linkedinSearch(t.company, w.name), target: "_blank", rel: "noopener" }, `Open the thread with ${wn}`), second: "Copy what they wrote, when they do.", hint: `${wn}'s reply, when it comes.`,
            onText: (text) => { if (m.ask) { const yes = /\b(yes|sure|happy to|of course|will do|i'll mention|mentioned)\b/i.test(text); save((x) => ({ targets: patchContact(x.targets, t.id, w.id, yes ? { touches: { vouch: new Date().toISOString().slice(0, 10) } } : { saidNo: true }) })); toast(yes ? `${wn} said yes.` : `Noted. ${wn} said no.`); render(); } else readReply(t, w, text); } }),
          noSolid: true, margin: whyAndWho(t, w), under: el("p.sw__lead", {}, meanwhile(t),
            channelOf(w) === "email" && w.touches?.note && !readOnly() ? [" · ", quiet("It bounced", () => { save((x) => ({ targets: patchContact(x.targets, t.id, w.id, { emailBad: true, touches: { note: null } }) }), { kind: "search.bounce", payload: { company: t.company } }); toast(`Noted. The note goes to ${wn} on LinkedIn.`); render(); })] : null) };
      }
      case "offer": {
        const line = { ...c, offer: "No agenda, I just like how you think about this. You up for a twenty minute call sometime?" };
        return { title: `Offer ${who} a short call.`, lead: "Change any word, then send it.", body: letter(t, line, { field: "offer", touch: "offer", onSent: () => sentLine(t, c, "offer", `Offered ${c.name} a call`), lintField: "offerLint", kind: "reply" }), margin: whyAndWho(t, c) };
      }
      case "call":
        return { title: `Get ready for your call with ${who}.`, lead: "Twenty minutes. Hear how they work and what they're stuck on.",
          body: el("div.sw__main", {},
            el("div.sw__sheet", {}, a.call?.open ? el("p.sw__text", {}, a.call.open) : null,
              el("ol.sw__qs", {}, ...(a.call?.questions || ["How does the team work day to day?", "What are you stuck on lately?", "What's been the hardest problem this year?", "How did you end up there?", "What do you wish you'd known?"]).map((q) => el("li", {}, q))),
              el("p.sw__text", {}, a.call?.close || "Close with the one thing you'll send them.")),
            el("div.sw__acts", {}, readOnly() ? null : solid("I had the call", () => { touched(t, c, "call"); }))),
          margin: whyAndWho(t, c) };
      case "after": {
        if (!c.promised || !c.said) {
          const promised = el("input.sw__input", { id: "sw-promised", value: drafts.get(`promised:${c.id}`) ?? c.promised ?? "" });
          const said = el("input.sw__input", { id: "sw-said", value: drafts.get(`said:${c.id}`) ?? c.said ?? "" });
          promised.addEventListener("input", () => drafts.set(`promised:${c.id}`, promised.value));
          said.addEventListener("input", () => drafts.set(`said:${c.id}`, said.value));
          return { title: `Two notes from your call with ${who}.`, lead: "They write the next two lines for you.",
            body: el("div.sw__main", {},
              el("label.sw__label", { for: promised.id }, el("span", {}, "What you said you'd send"), promised),
              el("label.sw__label", { for: said.id }, el("span", {}, "One thing they said, in two or three words"), said),
              el("div.sw__acts", {}, solid("Save both", () => {
                if (!promised.value.trim() || !said.value.trim()) return toast("Fill in both", "warn");
                drafts.delete(`promised:${c.id}`); drafts.delete(`said:${c.id}`);
                save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { promised: promised.value.trim(), said: said.value.trim() }) }));
                render();
              }))),
            margin: whyAndWho(t, c) };
        }
        const line = { ...c, thing: `Here's the ${c.promised} I mentioned. Did the ${c.said} thing end up working?` };
        return { title: `Send ${who} the thing you promised.`, lead: "The day after the call.", body: letter(t, line, { field: "thing", touch: "thing", onSent: () => sentLine(t, c, "thing", `Sent ${c.name} the thing promised`), lintField: "thingLint", kind: "reply" }), margin: whyAndWho(t, c) };
      }
      case "ask": {
        const line = { ...c, askText: (a.up?.peer_ask || "Random one. If your manager ever asks who's worth talking to, I'd be glad to be on that list. Totally fine if that's not a thing.").replace(/\[first name\]|\[name\]/gi, who), askLint: a.lints?.peer_ask || [] };
        return { title: `Ask ${who} to mention you.`, lead: "Easy to say no to.", body: letter(t, line, { field: "askText", touch: "asked", onSent: () => sentLine(t, c, "asked", `Asked ${c.name} for a mention`), lintField: "askLint", kind: "reply" }), margin: whyAndWho(t, c) };
      }
      case "who": {
        const rows = (t.picks?.people || []).filter((p) => p.rung === "manager" || p.rung === "lead");
        const name = el("input.sw__input", { id: "sw-mgr", value: drafts.get(`mgr:${t.id}`) || "" });
        name.addEventListener("input", () => drafts.set(`mgr:${t.id}`, name.value));
        const choose = (n, title) => { save((x) => ({ targets: patchTarget(x.targets, t.id, { manager: { name: n, title: title || "", note: "", lint: [] } }) })); render(); };
        return { title: `Who runs ${who}'s team?`, lead: rows.length ? "From the people you copied." : `Ask ${who}, or look at who they report to on LinkedIn.`,
          body: el("div.sw__main", {},
            rows.length ? el("ul.sw__queue", {}, ...rows.map((p) => el("li", {}, el("button.sw__qrow.sw__qrow--btn", { type: "button", onclick: () => choose(p.name, p.title) }, el("b", {}, p.name), el("span", {}, shortRole(p.title)))))) : null,
            el("label.sw__label", { for: name.id }, el("span", {}, rows.length ? "Someone else" : "Their name"), name),
            el("div.sw__acts", {}, solid("That's who", () => { if (!name.value.trim()) return toast("Enter their name", "warn"); drafts.delete(`mgr:${t.id}`); choose(name.value.trim(), ""); }))),
          margin: [note("Why now", [`${who} said yes ${c.touches?.vouch ? weekdayWord(c.touches.vouch) : "already"}.`])] };
      }
      case "manager": {
        const mgr = t.manager || {};
        if (!mgr.note) { if (!working.has(`manager:${t.id}`)) queueMicrotask(() => writeManager(t, c)); return { title: `Writing to ${first(mgr.name)}.`, lead: `With ${who}'s name first.`, body: working.get(`manager:${t.id}`)?.node || el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" })) }; }
        const line = { id: `mgr:${t.id}`, name: mgr.name, link: linkedinSearch(t.company, mgr.name), touches: { note: t.touches?.manager }, mnote: mgr.note, mlint: mgr.lint || [] };
        return { title: `Write to ${first(mgr.name)}, with ${who}'s name first.`, lead: "Change any word, then send it on LinkedIn.",
          body: el("div.sw__main", {},
            el("article.sw__letter", { contenteditable: t.touches?.manager || readOnly() ? "false" : "plaintext-only", "aria-label": `Your note to ${mgr.name}` }, mgr.note),
            el("div.sw__under", {}, count(mgr.note, { flags: mgr.lint || [] }), el("div.sw__acts", {},
              ghost(`Copy and open ${first(mgr.name)}'s page`, () => { copy(root.querySelector(".sw__letter")?.innerText || mgr.note, "Copied."); window.open(line.link, "_blank", "noopener"); }),
              t.touches?.manager ? el("span.sw__num", {}, `Sent ${weekdayWord(t.touches.manager)}`) : readOnly() ? null : solid("I sent it", () => {
                const text = root.querySelector(".sw__letter")?.innerText.trim() || mgr.note;
                if (/\[[^\]]+\]/.test(text)) return toast("Fill in the part in brackets first", "warn");
                save((x) => ({ ...logSend(t, { contact: mgr.name, note: `Note to ${mgr.name}, with ${c.name}'s name` })(x), targets: touchTarget(x.targets, t.id, "manager") }), { kind: "search.logged", payload: { kind: "warm", company: t.company, from: "manager" } });
                sentToast(); render();
              })))),
          margin: [note("To", [`${mgr.name}${mgr.title ? `, ${shortRole(mgr.title)}` : ""}`, "On LinkedIn.", `${who} said yes ${c.touches?.vouch ? weekdayWord(c.touches.vouch) : ""}.`])] };
      }
      case "done":
        return { title: m.title, lead: m.detail, body: null, margin: whyAndWho(t, c) };
      default:
        return { title: m.title.replace(/\.?$/, "."), lead: "", body: null, margin: floor(t) };
    }
  }

  /** The margin's floor, there on every move: why this company, and the one line of what happens next. */
  function floor(t, { why = true } = {}) {
    return [why && t.why ? note(`Why ${t.company}`, [t.why]) : null, note("What happens next", ["You write the first note this week."])].filter(Boolean);
  }

  /** The margin's "Reach": the address and where it came from, or the honest none, and the one field to add one. */
  function reachNote(t, c) {
    const editing = drafts.has(`email:${c.id}`);
    const field = () => {
      const input = el("input.sw__input", { id: `sw-email-${c.id}`, inputmode: "email", value: drafts.get(`email:${c.id}`) || "" });
      input.addEventListener("input", () => drafts.set(`email:${c.id}`, input.value));
      return el("div.sw__start", {}, el("label.sw__label", { for: input.id }, el("span", {}, "Their email"), input),
        el("div.sw__acts", {}, solid("Use it", () => {
          const v = String(input.value || "").trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast("That doesn't look like an address", "warn");
          drafts.delete(`email:${c.id}`);
          save((x) => ({ targets: patchContact(x.targets, t.id, c.id, { email: v, emailSource: "you", emailConfidence: "you", emailBad: false }) }), { kind: "search.reach", payload: { company: t.company, confidence: "you" } });
          render();
        }), quiet("Cancel", () => { drafts.delete(`email:${c.id}`); render(); })));
    };
    const lines = [];
    if (c.email && !c.emailBad) lines.push(`${c.email}`, reachWords(c));
    else if (c.emailBad) lines.push(`${c.email} bounced.`);
    else if (c.emailConfidence === "none") lines.push("No address found. The note goes on LinkedIn.");
    const sec = el("section.sw__note", {}, el("span.sw__eyebrow", {}, `Reach ${first(c.name)}`),
      ...lines.filter(Boolean).map((l, i) => el("p", { class: i === 0 ? "is-first" : null }, l)),
      c.github ? el("p", {}, el("a.sw__quiet", { href: `https://github.com/${c.github}`, target: "_blank", rel: "noopener" }, `GitHub: ${c.github}`)) : null,
      readOnly() ? null : editing ? field() : el("p", {}, quiet(c.email && !c.emailBad ? "Use a different email" : "Add an email you found", () => { drafts.set(`email:${c.id}`, ""); render(); })));
    return sec;
  }

  function whyAndWho(t, c) {
    const out = [];
    if (c) {
      const r = c.read || {};
      const plain = (x) => String(x || "").replace(/\s*\([^)]*\)/g, "").replace(/^they both\b/i, "You both").replace(/\bthe engineer has\b/g, "you've").replace(/\bthe engineer\b/g, "you").trim();
      const shared = plain((r.shared || [])[0]);
      out.push(note(`Why ${first(c.name)}`, [plain(c.why), shared ? (/^you both/i.test(shared) ? shared : `You both: ${shared}`) : ""].filter(Boolean).slice(0, 2)));
      out.push(reachNote(t, c));
    }
    const others = peopleOnTarget(t).filter((x) => !c || x.id !== c.id).slice(0, 2);
    out.push(el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Also on the team"),
      ...others.map((x, i) => el("p", { class: i === 0 ? "is-first" : null }, x.name)),
      el("p", {}, el("a.sw__quiet", { href: "#/do/connections" }, `Everyone at ${t.company}`))));
    return out;
  }

  function render() {
    const active = activeTargets(student());
    if (!active.some((t) => t.id === focus)) focus = (active.find((t) => !["wait", "done"].includes(targetMove(t).id)) || active[0])?.id || null;
    const t = active.find((x) => x.id === focus);
    // Opened from a person's row on Key Connections: this screen is that person's line, not the company's warmest.
    const only = t && person ? peopleOnTarget(t).find((c) => c.id === person) : null;
    if (t && !only) person = null;
    if (!t) {
      mount(root, el("section.sw__target", {}, el("div.sw__cols", {},
        el("div.sw__main", {}, el("h3.sw__move", {}, "Pick your first company."), el("p.sw__lead", {}, "Your people come from there."), el("div.sw__acts", {}, solid("Pick a company", () => { location.hash = "#/walk/targets"; }))),
        el("aside.sw__aside", {}, note("What happens next", ["We find two engineers there for you to meet.", "You write the first note this week."])))));
      return;
    }
    const m = only ? targetMove({ ...t, people: [only] }) : targetMove(t);
    const v = moveView(t, m);
    const firstSent = active.some((x) => peopleOnTarget(x).some((c) => c.touches?.note));
    const finished = options.walk && firstSent && m.id !== "send" && m.id !== "back";
    const strip = el("p.sw__stripline", {}, `${t.company} · ${shortRole(t.role)}`);
    const main = el("div.sw__main", {},
      strip,
      el("h3.sw__move", {}, finished && m.id === "wait" ? "Your first note is out." : v.title),
      v.lead ? el("p.sw__lead", {}, v.lead) : null,
      v.body, v.under || null,
      // The first week ends here: once a note is out, the solid after the object is the move Home would show
      // (a second company while the first note is read), with Home itself a quiet step beside it.
      options.walk && firstSent && options.next && m.id === "wait"
        ? (activeTargets(student()).length < 5
          ? el("div.sw__acts", {}, el("a.sw__solid.sw__solid--link", { href: "#/walk/targets" }, "Add a second company"))
          : el("div.sw__acts", {}, solid(options.next.label, () => options.next.go())))
        : null);
    const margin = (v.margin || []).filter(Boolean);
    mount(root, el("section.sw__target", {}, el("div.sw__cols", {}, main, el("aside.sw__aside", {}, ...(margin.length ? margin : floor(t))))));
    if (!t.approach) build(t);
  }

  render();
  return {
    node: root,
    /** The company and person this screen is about right now, for the map's glow. */
    focus: () => ({ target: focus, person }),
    update(next) {
      current = next;
      if (next.state.slug !== slug) { slug = next.state.slug; focus = null; person = null; tried.clear(); }
      readFocus();
      render();
    },
  };
}
