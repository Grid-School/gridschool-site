/**
 * The two light builder steps between the resume and Send this week (flow rebuild, step two):
 *
 *   Your LinkedIn (b.linkedin, server/linkedin_step.py)       headline and About, headshot and banner, live
 *   Pick five targets (s.targets, server/targets_step.py)     up to five companies worked on every channel
 *
 * Each is a short checklist whose rows read the student's own record, with one button to the tool that does
 * the work (Jobs → Profile, Photos, Jobs → Targets). The step's tasks follow the record, so it finishes
 * itself when the work is done, from wherever it was done.
 */

import { weekdayWord } from "../search.js?v=3c8024f-202611042144";
import { workPanel } from "./work.js?v=3c8024f-202611042144";
import { el, mount } from "../dom.js?v=3c8024f-202611042144";
import { btn, toast, copy } from "../ui.js?v=3c8024f-202611042144";
import { careerOf, searchOf, activeTargets, MAX_ACTIVE_TARGETS } from "../search.js?v=3c8024f-202611042144";
import { isProgressReadOnly } from "../store.js?v=3c8024f-202611042144";
import { field } from "../ui.js?v=3c8024f-202611042144";
import { webLink } from "../search.js?v=3c8024f-202611042144";
import { createPositioningCard } from "./positioning-card.js?v=3c8024f-202611042144";
import { renderImages } from "./images.js?v=3c8024f-202611042144";

const taskDone = (state, task) => state.student?.tasks?.[task?.id]?.state === "done";

/** Mark a step's task done once the record says so (never undone here: the student's word stands). */
function follow(ctx, task, isDone) {
  if (!task || !isDone || isProgressReadOnly() || taskDone(ctx.state, task)) return;
  // After this render: the store's change repaints the page, and a repaint inside a paint nests.
  queueMicrotask(() => {
    if (!taskDone(ctx.store.state(), task)) ctx.store.setTaskState(task.id, "done");
  });
}

function row({ n, title, text, done, optional = false, action = null, body = null }) {
  return el(
    "li.stepcheck__row",
    { class: [done ? "is-done" : null, body ? "has-body" : null].filter(Boolean).join(" ") || null },
    el("span.stepcheck__mark", { "aria-hidden": "true" }, done ? "✓" : String(n)),
    el("div.stepcheck__text", {}, el("b", {}, title, optional ? el("small", {}, " · optional") : null), text ? el("p", {}, text) : null, body),
    action ? el("div.stepcheck__act", {}, action) : null
  );
}

function shell(build) {
  return (ctx, options = {}) => {
    let current = ctx;
    let node = options.node ?? null;
    const root = el("div.stepcheck");
    const mem = { ctx, options };  // what a step keeps between repaints (a drafter mid-draft, a field being typed in)
    mem.rerender = () => render();
    const render = () => {
      mem.ctx = current;
      mount(root, build({ ctx: current, node, mem }));
    };
    render();
    return {
      node: root,
      update(next, nextOptions = {}) {
        current = next;
        node = nextOptions.node ?? node;
        render();
      },
      destroy() {},
    };
  };
}

function portfolioField(ctx, mem, saved, ro) {
  if (!mem.portfolio) {
    const f = field({ label: "Portfolio link", id: "ln-portfolio", placeholder: "yoursite.com or the project page" });
    f.input.inputMode = "url";
    const save = btn({
      label: "Save link",
      variant: "ghost",
      onclick: () => {
        const url = webLink(f.input.value);
        if (url === null) return toast("That doesn't look like a web address. Try yoursite.com, or leave it empty.", "warn");
        mem.ctx.store.updateSearch(() => ({ portfolio: url.slice(0, 300) }), { kind: "search.portfolio", payload: {} });
        toast(url ? "Portfolio link saved." : "Portfolio link removed.");
      },
    });
    mem.portfolio = { f, save, node: el("div.stepcheck__field", {}, f.node, save) };
  }
  const { f, save, node } = mem.portfolio;
  if (document.activeElement !== f.input) f.input.value = saved ?? "";
  f.input.disabled = ro;
  save.disabled = ro;
  return node;
}

/** Your LinkedIn, on the 2026-11-03 critique: the object is the two fields the student pastes into, each with
 * its own copy and the instruction in LinkedIn's own words; blanks are flagged before they can be pasted; the
 * confirmation settles the step and moves on; nothing optional on the screen. */
export const renderLinkedinStep = shell(({ ctx, node, mem }) => {
  const s = ctx.state.student;
  const career = careerOf(s);
  const search = searchOf(s);
  const ro = isProgressReadOnly();
  mem.card ??= createPositioningCard({ getCtx: () => mem.ctx, onDrafted: () => mem.rerender?.() });
  const headline = mem.card.headline() || career.headline || "";
  const about = mem.card.about() || career.about || "";
  const drafted = Boolean(headline);
  const live = Boolean(search.profileAt);
  const [draftTask, liveTask] = node?.tasks ?? [];
  follow(ctx, draftTask, drafted);
  follow(ctx, liveTask, live);
  // The first draft writes itself, once, and never while one is already on the record or in flight.
  if (!drafted && !ro && !mem.autoDrafted && !mem.card.busy() && !mem.card.error()) {
    mem.autoDrafted = true;
    queueMicrotask(() => mem.card.start());
  }
  const copies = search.profileCopies || {};
  const markCopied = (field) => ctx.store.updateSearch((x) => ({ profileCopies: { ...(x.profileCopies || {}), [field]: new Date().toISOString().slice(0, 10) } }), { kind: "search.profilecopy", payload: { field } });
  const solid = (label, onclick) => el("button.sw__solid", { type: "button", onclick }, label);
  const ghost = (label, onclick, extra = {}) => el("button.sw__ghost", { type: "button", onclick, ...extra }, label);
  const quiet = (label, onclick) => el("button.sw__quiet", { type: "button", onclick }, label);
  const blanks = (text) => /\[[^\]]{1,40}\]/.test(text);
  const paragraphs = (text) => String(text || "").split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);

  const PROFILE = "https://www.linkedin.com/in/me/";
  // One ghost does the whole job, as on the notes screen: copy the text and open the page it goes on. The button
  // stays after a copy (the clipboard is lost the moment they copy anything else); the day it was copied sits beside it.
  function item(field, label, text, how) {
    const copied = copies[field];
    return el("div.ln__item", {},
      el("span.ln__label", {}, label),
      text ? el("div.ln__text", {}, ...paragraphs(text).map((p) => el("p", {}, p))) : null,
      text && blanks(text) ? el("p.ln__flag", {}, el("i", { "aria-hidden": "true" }), `Fill in the part in brackets before you paste.`) : null,
      text ? el("div.ln__acts", {},
        ghost(field === "about" ? "Copy About and open my profile" : "Copy headline and open my profile", () => { copy(text, "Copied."); if (!ro) markCopied(field); window.open(PROFILE, "_blank", "noopener"); }),
        copied ? el("span.ln__copied", {}, `Copied ${weekdayWord(copied)}`) : null,
        el("span.ln__how", {}, how)) : null);
  }

  // While the draft is written, the work shows where the result will appear: the sheet holds the steps.
  if (!drafted && !mem.panel) mem.panel = workPanel({ title: "Writing your headline and About", steps: [{ id: "read", label: "Reading your resume" }, { id: "write", label: "Writing your headline and About" }] });
  if (drafted && mem.panel) { try { mem.panel.complete(); mem.panel.stop(); } catch { /* fine */ } mem.panel = null; }
  const sheet = el("div.ln__sheet", {},
    drafted ? item("headline", "Headline", headline, "In Edit intro, the pencil at the top of your profile.") : (mem.panel?.node || null),
    drafted ? el("hr.ln__rule") : null,
    drafted ? item("about", "About", about, "Under About's own pencil. None yet? Add profile section.") : null);

  let move, lead, body;
  const failed = !drafted && mem.card.error();
  if (failed) {
    const err = mem.card.error();
    const weekUsed = /this week/i.test(err);
    move = weekUsed ? "You've used this week's draft." : "We couldn't write your draft.";
    lead = weekUsed ? "It opens again next week. Your companies are next." : "Something went wrong on our side.";
    body = el("div.ln__main", {},
      el("div.sw__acts", {}, weekUsed
        ? solid("Skip to your companies", () => { location.hash = "#/walk/targets"; })
        : solid("Try again", () => mem.card.start())),
      el("p.ln__small", {}, err));
  } else if (!drafted) {
    move = "We're writing your headline and About.";
    lead = "From your resume. About a minute.";
    body = el("div.ln__main", {}, sheet, el("p.ln__small", {}, "You can leave. It saves itself."));
  } else if (!live) {
    move = "Paste these into LinkedIn.";
    lead = null;
    body = el("div.ln__main", {},
      sheet,
      ro ? null : el("div.sw__acts", {}, solid("I saved both on LinkedIn", () => {
        ctx.store.updateSearch(() => ({ profileAt: new Date().toISOString() }), { kind: "search.profile", payload: {} });
        if (mem.options?.next) mem.options.next.go(); else location.hash = "#/walk/targets";
      })));
  } else {
    move = "Your headline and About are on LinkedIn.";
    lead = null;
    // The solid is the last thing in the column and it goes on.
    body = el("div.ln__main", {}, sheet, mem.options?.next ? el("div.sw__acts", {}, solid(mem.options.next.label, () => mem.options.next.go())) : null);
  }
  // The margin is always beside the sheet: what comes next, and the one-shot door with its fact.
  const margin = el("aside.sw__aside", {},
    el("section.sw__note", {}, el("span.sw__eyebrow", {}, "What happens next"), el("p.is-first", {}, "Next, your companies.")),
    drafted && !ro ? el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Not right?"),
      el("p", {}, quiet(mem.card.busy() ? "Writing\u2026" : "Write it again", () => mem.card.start())),
      el("p", {}, "One rewrite a week.")) : null);

  return el("div.sw.ln", {},
    el("section.sw__target", {},
      el("div.sw__cols", {},
        el("div.sw__main", {}, el("h3.sw__move", {}, move), lead ? el("p.sw__lead", {}, lead) : null, body),
        margin)));
});

export const renderTargetsStep = shell(({ ctx, node }) => {
  const s = ctx.state.student;
  const ro = isProgressReadOnly();
  const active = activeTargets(s);
  const [pickTask] = node?.tasks ?? [];
  follow(ctx, pickTask, active.length >= MAX_ACTIVE_TARGETS);
  const finished = taskDone(ctx.state, pickTask);
  return el(
    "div",
    {},
    el(
      "ol.stepcheck__list",
      {},
      row({
        n: 1,
        title: `Pick up to five companies (${active.length} of ${MAX_ACTIVE_TARGETS})`,
        text: active.length
          ? null
          : "Where hiring, size and fit overlap, or simply where you want to work. Paste their posting or what they build; each one gets its campaign when you ask for it.",
        done: active.length >= MAX_ACTIVE_TARGETS || finished,
        action: btn({ label: active.length ? "Open Targets" : "Choose targets", variant: active.length ? "ghost" : "solid", onclick: () => ctx.navigate("do", "targets") }),
      })
    ),
    active.length
      ? el(
          "ul.stepcheck__targets",
          {},
          active.map((t) =>
            el(
              "li",
              {},
              el("b", {}, t.company),
              t.role ? el("span", {}, t.role) : null,
              el("span.stepcheck__camp", { class: t.campaign ? "is-on" : null }, t.campaign ? "Campaign written" : "Campaign not written yet"),
              btn({ label: "Open", variant: "quiet", onclick: () => ctx.navigate("do", "targets", t.id) })
            )
          )
        )
      : null,
    active.length && active.length < MAX_ACTIVE_TARGETS && !finished && !ro
      ? el(
          "div.stepcheck__foot",
          {},
          el("p", {}, "Five is the most that get real attention. Fewer is fine if these are the ones you want."),
          btn({ label: "These are my targets", variant: "solid", onclick: () => pickTask && ctx.store.setTaskState(pickTask.id, "done") })
        )
      : null
  );
});
