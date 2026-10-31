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

import { el, mount } from "../dom.js?v=7288040-202610310409";
import { btn, toast } from "../ui.js?v=7288040-202610310409";
import { careerOf, searchOf, activeTargets, MAX_ACTIVE_TARGETS } from "../search.js?v=7288040-202610310409";
import { isProgressReadOnly } from "../store.js?v=7288040-202610310409";
import { field } from "../ui.js?v=7288040-202610310409";
import { webLink } from "../search.js?v=7288040-202610310409";
import { createPositioningCard } from "./positioning-card.js?v=7288040-202610310409";

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
    const mem = { ctx };  // what a step keeps between repaints (a drafter mid-draft, a field being typed in)
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

export const renderLinkedinStep = shell(({ ctx, node, mem }) => {
  const s = ctx.state.student;
  const career = careerOf(s);
  const search = searchOf(s);
  const ro = isProgressReadOnly();
  // A headline drafted a moment ago counts: the drafter knows before the record syncs (positioning-card.js).
  mem.card ??= createPositioningCard({ getCtx: () => mem.ctx, onDrafted: () => mem.rerender?.() });
  const drafted = Boolean(career.headline || mem.card.headline());
  const live = Boolean(search.profileAt);
  const [draftTask, liveTask] = node?.tasks ?? [];
  follow(ctx, draftTask, drafted);
  follow(ctx, liveTask, live);
  return el(
    "ol.stepcheck__list",
    {},
    row({
      n: 1,
      title: "Your headline and About",
      done: drafted,
      // The drafter itself, here in the step (it used to live two screens away, in Jobs → Profile).
      body: (() => {
        mem.card ??= createPositioningCard({ getCtx: () => mem.ctx });
        mem.card.render();
        return mem.card.node;
      })(),
    }),
    row({
      n: 2,
      title: "Your headshot and banner",
      text: "Made from your own photos and sized for LinkedIn. Skip it if you're happy with yours.",
      done: false,
      optional: true,
      action: btn({ label: "Open Photos", variant: "ghost", onclick: () => ctx.navigate("images") }),
    }),
    row({
      n: 3,
      title: "Your portfolio link",
      text: "The site or project page that proves it. Campaign emails link to it.",
      done: Boolean(search.portfolio),
      optional: true,
      body: portfolioField(ctx, mem, search.portfolio, ro),
    }),
    row({
      n: 4,
      title: "Put them on LinkedIn",
      text: live
        ? `Live since ${new Date(search.profileAt).toLocaleDateString()}.`
        : "Copy the headline and About onto your profile, add the photo and banner, then say so here.",
      done: live,
      action: live || ro
        ? null
        : btn({
            label: "It's live on LinkedIn",
            variant: drafted ? "solid" : "ghost",
            onclick: () => {
              if (!drafted) return toast("Draft your headline and About first, so there's something to put up.", "warn");
              ctx.store.updateSearch(() => ({ profileAt: new Date().toISOString() }), { kind: "search.profile", payload: {} });
            },
          }),
    })
  );
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
