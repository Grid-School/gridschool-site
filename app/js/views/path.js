/**
 * Where you're going (server/path_engine.py, path_api.py). The first screen in the Grid style (memory:
 * black ground, lines of light, glow on the one thing that's active).
 *
 *   Questions  one at a time, in a fixed series; a tap where a tap is enough; short answers are fine.
 *   The read   the honest read from their answers, their record and the radar: what's realistic by when,
 *              what needs a stepping stone, and the way to the far goal in years. If it needs more, it asks.
 *   Titles     the titles from the read; up to three become resumes at once, the recommended ones ticked.
 *   Done       the lenses exist; the resume node is next.
 *
 * Everything can be reopened: change an answer, run the read again, pick different titles.
 */

import { el, mount } from "../dom.js?v=fc888f8-202610270442";
import { btn, toast } from "../ui.js?v=fc888f8-202610270442";
import { isProgressReadOnly } from "../store.js?v=fc888f8-202610270442";
import { nodeRail } from "./node-rail.js?v=fc888f8-202610270442";
import { doneIds } from "../steps.js?v=fc888f8-202610270442";
import { workPanel } from "./work.js?v=fc888f8-202610270442";
import { patient } from "../patient.js?v=fc888f8-202610270442";
import * as api from "../path-remote.js?v=fc888f8-202610270442";
import { loadProgress } from "../resume-remote.js?v=fc888f8-202610270442";

const STEPS = [
  { id: "answer", label: "Answer", done: (s) => s.enough },
  { id: "read", label: "The read", done: (s) => Boolean(s.read) && !s.pending },
  { id: "titles", label: "Titles", done: (s) => (s.chosen || []).length > 0 },
];
const FINISH = { id: "finish", label: "Finish", done: (s) => s.nodeDone };
const WORK = {
  assess: [
    { id: "read", label: "Reading your answers, your record and what the radar saw" },
    { id: "judge", label: "Working out what's realistic by when, and why" },
    { id: "way", label: "Laying out the way to the far goal, if you gave one" },
  ],
};
const REALISTIC = { now: ["Realistic now", "is-now"], stretch: ["Stretch: one gap to fix", "is-stretch"], later: ["Later: a step first", "is-later"] };

export function renderPath(ctx, options = {}) {
  const embedded = Boolean(options.embedded);
  let node = options.node || null;
  const root = el("div.view.view--path");
  let current = ctx;
  let slug = ctx.state.slug;
  let rec = null;
  let stage = null;
  let busy = "";
  let panel = null;
  let error = "";
  let picked = null; // titles ticked on the Titles step
  let reviewing = false; // "change an answer"

  const readOnly = () => isProgressReadOnly();
  const taskDone = (task) => current.state.student?.tasks?.[task.id]?.state === "done";
  const nodeDone = () => Boolean(node?.tasks?.length) && node.tasks.every(taskDone);
  const steps = () => (embedded ? [...STEPS, FINISH] : STEPS);
  const snapshot = () => ({ enough: rec?.enough, read: rec?.doc?.read, pending: Boolean(rec?.next?.followup), chosen: rec?.doc?.chosen, nodeDone: nodeDone() });
  const doneSteps = () => doneIds(steps(), snapshot());

  async function load() {
    if (!api.pathReady()) {
      error = "Sign in first. Your answers are saved to your account.";
      return render();
    }
    try {
      take(await api.loadPath(slug));
    } catch (e) {
      error = e.message;
      render();
    }
  }

  let pickedFor = null; // the read the ticks belong to: a new read resets them to its recommendation
  function take(next) {
    rec = next;
    error = "";
    const read = rec.doc?.read;
    if (read && pickedFor !== read.at) {
      picked = rec.doc.chosen?.length && pickedFor === null ? [...rec.doc.chosen] : [...(read.recommend || [])];
      pickedFor = read.at;
    }
    render();
  }

  async function run(label, fn, work = null) {
    if (busy) return;
    if (readOnly()) return toast("View only.", "warn");
    busy = label;
    const runId = work ? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : "";
    panel = work ? workPanel({ title: label, steps: work, poll: async () => { const p = (await loadProgress(slug)).progress; return p?.run === runId ? p : null; } }) : null;
    render();
    try {
      const out = await patient(() => fn(runId), { before: rec?.version, load: () => api.loadPath(slug), waiting: () => panel?.setTitle("Still working. Don't close this.") });
      if (panel) { panel.complete(); await new Promise((r) => setTimeout(r, 500)); }
      take(out);
      return out;
    } catch (e) {
      if (e.status === 409 && e.payload?.doc) take(e.payload);
      else toast(e.message, "warn", { ms: 5000 });
      return null;
    } finally {
      panel?.stop();
      panel = null;
      busy = "";
      render();
    }
  }

  function autoStage() {
    if (!rec.enough || rec.next) return "answer";
    if (!rec.doc.read) return "read";
    if (!(rec.doc.chosen || []).length) return "titles";
    return embedded ? "finish" : "titles";
  }
  const go = (id) => { stage = id; reviewing = false; render(); root.scrollIntoView?.({ block: "start", behavior: "smooth" }); };

  /* ---------- Answer ---------- */
  function answerBody() {
    const q = rec.next;
    const answered = Object.keys(rec.doc.answers || {}).length;
    const total = (rec.asked || []).length + (rec.doc.followups || []).length;
    if (reviewing || !q) {
      const list = Object.entries(rec.doc.answers || {});
      return card("Your answers", q ? "Change any by tapping it." : "That's every question. Change any by tapping it, or read what we make of them.",
        el("ul.gd__answers", {}, list.map(([id, a]) => {
          const text = questionText(id);
          const label = optionLabel(id, a);
          return el("li", { onclick: () => run("Reopening.", () => api.skipPath(slug, rec.version, id)).then(() => { reviewing = false; }) }, el("b", {}, text), el("span", {}, label));
        })),
        q ? btn({ label: "Back to the question", variant: "quiet", onclick: () => { reviewing = false; render(); } })
          : btn({ label: rec.doc.read ? "Read it again →" : "Read what we make of this →", variant: "solid", onclick: () => go("read") }));
    }
    const isTap = q.kind === "tap";
    const box = isTap ? null : el("textarea.gd__text", { rows: 3, placeholder: q.hint || "A sentence is enough." });
    const send = (value) => run("Saving.", () => api.answerPath(slug, rec.version, q.id, value));
    box?.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && box.value.trim()) send(box.value); });
    if (box) setTimeout(() => box.focus({ preventScroll: true }), 0);
    return card(
      q.followup ? "One more, so the read can be honest" : `Question ${Math.min(answered + 1, Math.max(total, answered + 1))} of ${Math.max(total, answered + 1)}`,
      q.followup ? "The read needs this." : "Short is fine. It all adds up.",
      [
        el("div.gd__q", {}, el("p.gd__qtext", {}, q.text), q.why ? el("p.gd__why", {}, q.why) : null),
        isTap
          ? el("div.gd__opts", {}, q.options.map(([k, label]) => el("button.gd__opt", { type: "button", disabled: Boolean(busy), onclick: () => send(k) }, label)))
          : box,
        isTap ? null : el("p.gd__hint", {}, "Cmd+Enter to save."),
      ],
      [
        isTap ? null : btn({ label: busy ? "Saving…" : "Save answer", variant: "solid", disabled: Boolean(busy), onclick: () => (box.value.trim() ? send(box.value) : toast("Type an answer, or skip it.", "warn")) }),
        btn({ label: "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Skipping.", () => api.skipPath(slug, rec.version, q.id)) }),
        answered ? btn({ label: "Change an answer", variant: "ghost", onclick: () => { reviewing = true; render(); } }) : null,
      ]
    );
  }

  /* ---------- The read ---------- */
  function readBody() {
    const read = rec.doc.read;
    // A read that asked a follow-up still shows, with the ask on top; only a record with no read waits.
    if (!rec.enough && !read) return card("Answer first", "The read is made from your answers. A few are still open.", null, btn({ label: "Back to the questions", variant: "solid", onclick: () => go("answer") }));
    if (!read) {
      return card("The honest read", "From your answers, your record and what the job radar saw in the last two weeks. About 30 seconds.", null,
        btn({ label: "Read it", variant: "solid", disabled: Boolean(busy), onclick: () => run("Writing the honest read.", (r) => api.assessPath(slug, rec.version, r), WORK.assess) }));
    }
    const pending = rec.next?.followup;
    return card("The honest read", pending ? "It asked one more question before it can be sure. Answer it and read again." : `Written ${new Date(read.at).toLocaleDateString()} from your answers and your record.`,
      [
        el("blockquote.gd__honest", {}, read.honest),
        el("ol.gd__titles", {}, read.now.map((t) => {
          const [label, cls] = REALISTIC[t.realistic] || REALISTIC.later;
          return el(`li.gd__title.${cls}`, {},
            el("div.gd__titlehead", {}, el("b", {}, t.title), el("span.gd__tag", {}, label)),
            el("p", {}, t.why),
            el("small", {}, [t.postings != null ? `${t.postings} postings in 14 days` : null, t.stepping_stone ? "a stepping stone to your goal" : null].filter(Boolean).join(" · ")));
        })),
        read.later ? el("section.gd__way", {},
          el("b.gd__eyebrow", {}, `The way to "${read.later.goal}"`),
          el("p.gd__realistic", {}, read.later.realistic),
          el("ol.gd__path", {}, read.later.path.map((s) => el("li", {}, el("i", {}, s.when), el("span", {}, s.step, s.earns ? el("small", {}, ` Earns: ${s.earns}`) : null))))) : null,
      ],
      [
        pending ? btn({ label: "Answer it →", variant: "solid", onclick: () => go("answer") }) : btn({ label: "Pick the titles →", variant: "solid", onclick: () => go("titles") }),
        btn({ label: "Read again", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Writing the honest read.", (r) => api.assessPath(slug, rec.version, r), WORK.assess) }),
        btn({ label: "Change an answer", variant: "ghost", onclick: () => { reviewing = true; go("answer"); } }),
      ]);
  }

  /* ---------- Titles ---------- */
  function titlesBody() {
    const read = rec.doc.read;
    if (!read) return card("Read first", "The titles come from the read.", null, btn({ label: "Read it", variant: "solid", onclick: () => go("read") }));
    const can = read.now.filter((t) => t.realistic !== "later");
    picked = (picked || []).filter((t) => can.some((c) => c.title === t)); // only titles on this read can be made
    const lenses = new Set((rec.lenses || []).map((l) => l.toLowerCase()));
    const toggle = (title) => { picked = picked.includes(title) ? picked.filter((t) => t !== title) : picked.length < 3 ? [...picked, title] : picked; if (picked.length >= 3 && !picked.includes(title)) toast("Three at most. Three resumes is already a lot to keep true.", "warn"); render(); };
    const chosen = rec.doc.chosen || [];
    return card(chosen.length ? "Your titles" : "Pick up to three titles",
      chosen.length ? `Resumes exist for: ${chosen.join(", ")}. Change the set any time.` : "Each one becomes a resume, with its own checklist of what that job is screened for. The recommended ones are ticked.",
      [
        el("ul.gd__pick", {}, can.map((t) => {
          const on = picked.includes(t.title);
          return el(`li${on ? ".is-on" : ""}`, {},
            el("button", { type: "button", "aria-pressed": on ? "true" : "false", disabled: Boolean(busy), onclick: () => toggle(t.title) },
              el("span.gd__box", { "aria-hidden": "true" }, on ? "✓" : ""),
              el("span", {}, el("b", {}, t.title), el("small", {}, [REALISTIC[t.realistic]?.[0], t.postings != null ? `${t.postings} postings` : null, lenses.has(t.title.toLowerCase()) ? "resume exists" : null].filter(Boolean).join(" · ")))));
        })),
        read.now.some((t) => t.realistic === "later") ? el("p.gd__hint", {}, `Not yet on the list: ${read.now.filter((t) => t.realistic === "later").map((t) => t.title).join(", ")}. The read says what would earn ${read.now.filter((t) => t.realistic === "later").length === 1 ? "it" : "them"}.`) : null,
      ],
      btn({ label: busy ? "Working…" : `Make ${picked.length === 1 ? "this resume" : `these ${picked.length} resumes`} →`, variant: "solid", disabled: Boolean(busy) || !picked.length,
        onclick: () => run("Working out what each job is screened for.", (r) => api.chooseTitles(slug, rec.version, picked, r), picked.map((t, i) => ({ id: `t${i}`, label: `${t}: what it's screened for` })))
          .then((out) => { if (out && node?.tasks) node.tasks.forEach((task) => current.store.setTaskState(task.id, "done")); if (out) go(embedded ? "finish" : "titles"); }) }));
  }

  /* ---------- Finish ---------- */
  function finishBody() {
    const chosen = rec.doc.chosen || [];
    return card("This step is done", `Resumes are set up for ${chosen.join(", ")}. The next step builds them, one question at a time.`, null,
      btn({ label: "Go to your resume →", variant: "solid", onclick: () => current.navigate("map", "b.resume") }));
  }

  /* ---------- helpers ---------- */
  function questionText(id) {
    const f = (rec.doc.followups || []).find((x) => x.id === id);
    return f ? f.text : (QUESTION_TEXT[id] || id);
  }
  function optionLabel(id, a) {
    return (OPTIONS[id] || {})[a] || a;
  }
  function card(title, now, body, next) {
    return [el("header.gd__head", {}, el("h2", {}, title), now ? el("p.gd__now", {}, now) : null), body, next ? el("div.gd__next", {}, next) : null];
  }

  function render() {
    if (error && !rec) return mount(root, el("div.gd", {}, el("p.gd__empty", {}, error)));
    if (!rec) return mount(root, el("div.gd", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening."))));
    const valid = steps().map((s) => s.id);
    const here = valid.includes(stage) ? stage : autoStage();
    const body = { answer: answerBody, read: readBody, titles: titlesBody, finish: finishBody }[here]();
    mount(root, el(`div.gd${embedded ? ".gd--embedded" : ""}`, {},
      embedded ? null : el("header.gd__top", {}, el("b.gd__eyebrow", {}, "Where you're going"), el("h1", {}, "Your next role, and the honest way to the one after it")),
      nodeRail({ nodes: steps(), done: doneSteps(), here, onGo: go, label: "Steps" }),
      el("div.gd__card", { "aria-busy": busy ? "true" : null }, busy ? panel?.node ?? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body)));
  }

  render();
  load();
  return {
    node: root,
    update(next, nextOptions = {}) {
      current = next;
      if (nextOptions.node) node = nextOptions.node;
      if (next.state.slug !== slug) { slug = next.state.slug; rec = null; picked = null; load(); } else if (rec) render();
    },
  };
}

/* The series' wording, for the answers list (the server owns the series; this is only for display). */
const QUESTION_TEXT = {
  mode: "Which is closer to where you are right now?",
  when: "When do you need to be earning from the next role?",
  take: "The job you'd say yes to tomorrow",
  seen: "Titles you've seen posted that you'd apply to",
  goal: "In five years",
  company: "A specific company or kind of company",
  constraints: "Where you'll work and what you won't do",
  strengths: "What people say you're good at",
  blocker: "What's kept you from landing it",
};
const OPTIONS = {
  mode: { now: "I need the next job soon", goal: "I'm working toward something specific", both: "Both" },
  when: { month: "This month", quarter: "In 1 to 3 months", half: "In 3 to 6 months", open: "No deadline" },
};
