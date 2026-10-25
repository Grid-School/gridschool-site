/**
 * Suggest changes: the student proposes changes to their own map, on the map.
 *
 * The map stays the map (map-is-the-product): suggest mode draws the student's
 * suggestion on their own Route, the new steps dashed and tagged "Your idea",
 * a step they think no longer fits faded. They act on nodes:
 *
 *   tap a step       Add a step after it · Add a task · Move it · Rename ·
 *                    Doesn't fit anymore · Ask Aden about it
 *   drag a step      onto another: it comes after that one instead
 *   drag "+ New step" onto the step it comes after
 *   "Ask Aden"       a note for the whole map ("what should I learn next?")
 *
 * Every change is checked against the map rules as it's made
 * (data/map-proposal.mjs checkOps), so a change that would break the map is
 * refused with the reason before it's ever sent. Nothing reaches the live map:
 * the suggestion goes to Aden (suggest-remote.js), who keeps, edits or
 * declines each change and publishes. The draft is kept in this browser until
 * it's sent; sending again replaces an open suggestion.
 */

import { el, mount, clear } from "../dom.js?v=6b238ed-202610252203";
import { btn, toast } from "../ui.js?v=6b238ed-202610252203";
import { buildGraph } from "../graph/model.js?v=6b238ed-202610252203";
import { isLandmark } from "../graph/route.js?v=6b238ed-202610252203";
import {
  applyOps,
  checkOps,
  describeOp,
  newOpId,
  newNodeId,
  withoutOp,
  opTargets,
  OP_LABEL,
  MAX_OPS,
  MAX_NOTE,
  MAX_TITLE,
  NEW_PREFIX,
} from "../../../data/map-proposal.mjs?v=6b238ed-202610252203";
import {
  suggestReady,
  listSuggestions,
  sendSuggestion,
  withdrawSuggestion,
  readDraft,
  writeDraft,
  answerSeen,
  markAnswerSeen,
} from "../suggest-remote.js?v=6b238ed-202610252203";

const DRAG_SLOP = 8;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** A map rule's complaint, in the student's words where we know it. */
export function plainError(error, titleOf) {
  const wait = /nothing can wait on (\S+), a (\w+) node/.exec(error);
  if (wait) {
    const what = { habit: "an every-week habit", reference: "something to read", milestone: "a milestone" }[wait[2]] ?? `a ${wait[2]}`;
    return `Nothing can come after “${titleOf(wait[1])}”: it's ${what}, not a step you finish. Pick the step before it.`;
  }
  if (/cannot require side quest/.test(error)) return "A main step can't wait on a side quest. Put it after a main step.";
  if (/cycle/.test(error)) return "That would make a loop: each step would be waiting on the other.";
  if (/must come after a/.test(error)) return "This kind of step has to come after a call with your coach.";
  if (/is not on your map/.test(error)) return "Your map changed since you started editing. Reload the page; your other edits are kept.";
  return `This would break a rule of the map (${error}).`;
}

/**
 * ctx(): the board context ({ state }) the map view holds.
 * redraw(): the map view draws again (the suggestion changed what's on it).
 */
export function createSuggest({ ctx, redraw }) {
  const s = {
    on: false,
    ops: [],
    note: "",
    base: null,
    proposals: [],
    loaded: false,
    card: null, // { node, form, after } | { review: true } | { ask: true }
    picking: null, // a step waiting for "comes after which step?"
    sending: false,
    error: null,
  };

  const slug = () => ctx().state.slug;
  const curriculum = () => ctx().state.curriculum;
  /* Only a map the coach published can be edited: on the fallback (no published map yet) every change
     would be against steps that aren't the student's, so the button doesn't appear at all. */
  const ready = () => suggestReady(slug()) && Boolean(curriculum()?.nodes?.length) && Number.isInteger(ctx().state.mapVersion);
  const open = () => s.proposals.find((p) => p.status === "open") ?? null;

  const bar = el("div.sgbar", { hidden: true, role: "region", "aria-label": "Your map edits" });
  const card = el("div.sgcard", { hidden: true, role: "dialog", "aria-label": "Edit your map" });
  const pill = el("div.sgpill", { hidden: true, role: "status" });
  const ghost = el("div.sgghost", { hidden: true, "aria-hidden": "true" });

  /* ---------- state ---------- */

  function loadDraft() {
    const draft = readDraft(slug());
    const live = open();
    if (draft?.ops?.length) {
      s.ops = draft.ops;
      s.note = draft.note ?? "";
      s.base = draft.base ?? ctx().state.mapVersion ?? null;
    } else if (live) {
      // Pick up where the sent suggestion is: changing it and sending again replaces it.
      s.ops = structuredClone(live.ops);
      s.note = live.note ?? "";
      s.base = live.base;
    } else {
      s.ops = [];
      s.note = "";
      s.base = ctx().state.mapVersion ?? null;
    }
  }

  function save() {
    writeDraft(slug(), { base: s.base, ops: s.ops, note: s.note });
  }

  async function refresh() {
    if (!suggestReady(slug())) return;
    try {
      s.proposals = await listSuggestions(slug());
      s.loaded = true;
    } catch {
      s.loaded = false;
    }
    render();
  }

  function titleOf(id) {
    const graph = previewGraph() ?? ctx().state.graph;
    return graph?.byId?.get(id)?.title ?? ctx().state.graph.byId.get(id)?.title ?? id;
  }

  /** A task's wording on the live map (what the student is changing from). */
  function taskTitleOf(nodeId, taskId) {
    return ctx().state.graph.byId.get(nodeId)?.tasks?.find((task) => task.id === taskId)?.title ?? null;
  }

  /** The board's curriculum with the suggestion drawn in, or null when there's nothing to draw. */
  function previewCurriculum() {
    if (!s.on || !s.ops.length) return null;
    return { ...curriculum(), nodes: applyOps(curriculum(), s.ops).map.nodes };
  }

  let memo = { key: null, graph: null };
  function previewGraph() {
    if (!s.on || !s.ops.length) return null;
    const state = ctx().state;
    const key = JSON.stringify(s.ops);
    if (memo.key === key && memo.source === state.graph) return memo.graph;
    const cur = previewCurriculum();
    memo = { key, source: state.graph, graph: buildGraph(cur, state.student) };
    return memo.graph;
  }

  /** Would this op be refused? The reasons, in plain words; empty when it's fine. */
  function refusal(op) {
    const checked = checkOps(curriculum(), [...s.ops, op]).at(-1);
    return checked.ok ? [] : checked.errors.map((error) => plainError(error, titleOf));
  }

  function addOp(op) {
    if (s.ops.length >= MAX_OPS) {
      toast(`That's ${MAX_OPS} changes. Send these first.`, "warn");
      return false;
    }
    const reasons = refusal(op);
    if (reasons.length) {
      showError(reasons[0]);
      return false;
    }
    s.ops = [...s.ops, op];
    s.error = null;
    save();
    closeCard();
    redraw();
    return true;
  }

  function removeOp(id) {
    s.ops = withoutOp(s.ops, id);
    save();
    redraw();
  }

  /* ---------- turning it on and off ---------- */

  function setOn(on) {
    if (on === s.on) return;
    s.on = on;
    s.picking = null;
    s.error = null;
    if (on) loadDraft();
    closeCard({ quiet: true });
    redraw();
  }

  /* ---------- what a tap does in suggest mode ---------- */

  /** True when suggest mode took the tap. */
  function tap(id) {
    if (!s.on) return false;
    if (isLandmark(id)) return true;
    if (s.picking) {
      const node = s.picking;
      s.picking = null;
      if (node === id) {
        renderCard();
        return true;
      }
      openCard({ node, form: "move", after: id });
      return true;
    }
    openCard({ node: id, form: null });
    return true;
  }

  function openCard(next) {
    s.card = next;
    s.error = null;
    renderCard();
    render();
  }

  function closeCard({ quiet = false } = {}) {
    s.card = null;
    s.error = null;
    card.hidden = true;
    clear(card);
    if (!quiet) render();
  }

  /* ---------- the card: one step's actions, one form at a time ---------- */

  const isNew = (id) => typeof id === "string" && id.startsWith(NEW_PREFIX);
  const addOpFor = (id) => s.ops.find((op) => op.kind === "add" && newNodeId(op) === id);

  function input(label, { textarea = false, rows = 2, max = MAX_TITLE, placeholder = "", value = "" } = {}) {
    const field = textarea
      ? el("textarea", { rows, maxlength: max, placeholder })
      : el("input", { type: "text", maxlength: max, placeholder });
    field.value = value;
    return { field, node: el("label.sgcard__field", {}, el("span", {}, label), field) };
  }

  function form(title, fields, onAdd, addLabel = "Add to my edits") {
    const submit = () => onAdd(Object.fromEntries(Object.entries(fields).map(([key, f]) => [key, f.field.value])));
    for (const f of Object.values(fields)) {
      f.field.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey || f.field.tagName === "INPUT")) {
          event.preventDefault();
          submit();
        }
      });
    }
    return el(
      "div.sgcard__form",
      {},
      el("b.sgcard__title", {}, title),
      Object.values(fields).map((f) => f.node),
      s.error ? el("p.sgcard__error", { role: "alert" }, s.error) : null,
      el(
        "div.sgcard__acts",
        {},
        btn({ label: "Back", variant: "quiet", onclick: () => openCard({ ...s.card, form: null }) }),
        btn({ label: addLabel, variant: "solid", onclick: submit })
      )
    );
  }

  const need = (text, field) => {
    if (String(text ?? "").trim()) return true;
    field.focus();
    return false;
  };

  function nodeForms(id) {
    const node = ctx().state.graph.byId.get(id);
    const title = titleOf(id);
    const kind = s.card.form;
    if (kind === "add") {
      const f = {
        title: input("What's the step?", { placeholder: "Ship a small Chrome extension" }),
        tasks: input("Tasks, one per line (optional)", { textarea: true, rows: 3, max: 800, placeholder: "Pick the idea\nPublish it" }),
        note: input("Why it helps (for your coach)", { textarea: true, max: MAX_NOTE, placeholder: "Two of my target roles ask for it" }),
      };
      return form(`A new step after “${title}”`, f, (v) => {
        if (!need(v.title, f.title.field)) return;
        const tasks = v.tasks.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 6).map((t) => t.slice(0, MAX_TITLE));
        addOp({ id: newOpId(), kind: "add", after: id, title: v.title.trim(), ...(tasks.length ? { tasks } : {}), ...(v.note.trim() ? { note: v.note.trim() } : {}) });
      });
    }
    if (kind === "task") {
      const f = {
        title: input("The task", { placeholder: "Record a two-minute test Loom" }),
        note: input("Why (optional)", { textarea: true, max: MAX_NOTE }),
      };
      return form(`A new task on “${title}”`, f, (v) => {
        if (!need(v.title, f.title.field)) return;
        addOp({ id: newOpId(), kind: "task", node: id, title: v.title.trim(), ...(v.note.trim() ? { note: v.note.trim() } : {}) });
      });
    }
    if (kind === "move" && s.card.after) {
      const f = { note: input("Why (optional)", { textarea: true, max: MAX_NOTE }) };
      return form(`“${title}” comes after “${titleOf(s.card.after)}”`, f, (v) => {
        const added = isNew(id) ? addOpFor(id) : null;
        if (added) {
          // Moving their own new step: it just sits after a different step.
          const ops = s.ops.map((op) => (op === added ? { ...op, after: s.card.after } : op));
          const reasons = checkOps(curriculum(), ops).filter((c) => !c.ok);
          if (reasons.length) {
            showError(plainError(reasons[0].errors[0], titleOf));
            return;
          }
          s.ops = ops;
          save();
          closeCard();
          redraw();
          return;
        }
        addOp({ id: newOpId(), kind: "move", node: id, after: s.card.after, ...(v.note.trim() ? { note: v.note.trim() } : {}) });
      }, "Move it");
    }
    if (kind === "rename") {
      const f = { title: input("A clearer name", { value: title }), note: input("Why (optional)", { textarea: true, max: MAX_NOTE }) };
      return form(`Rename “${title}”`, f, (v) => {
        if (!need(v.title, f.title.field) || v.title.trim() === title) return;
        addOp({ id: newOpId(), kind: "rename", node: id, title: v.title.trim(), ...(v.note.trim() ? { note: v.note.trim() } : {}) });
      });
    }
    if (kind === "retire") {
      const f = { note: input("What changed?", { textarea: true, rows: 3, max: MAX_NOTE, placeholder: "I already did this at work" }) };
      return form(`“${title}” doesn't fit anymore`, f, (v) => {
        if (!need(v.note, f.note.field)) return;
        addOp({ id: newOpId(), kind: "retire", node: id, note: v.note.trim() });
      });
    }
    if (kind === "taskedit" || kind === "taskdrop") {
      const old = taskTitleOf(id, s.card.task) ?? "this task";
      if (kind === "taskedit") {
        const f = { title: input("New wording", { value: old }), note: input("Why (optional)", { textarea: true, max: MAX_NOTE }) };
        return form(`A task on “${title}”`, f, (v) => {
          if (!need(v.title, f.title.field) || v.title.trim() === old) return;
          addOp({ id: newOpId(), kind: "taskedit", node: id, task: s.card.task, title: v.title.trim(), ...(v.note.trim() ? { note: v.note.trim() } : {}) });
        }, "Change it");
      }
      const f = { note: input("Why isn't it needed? (optional)", { textarea: true, rows: 2, max: MAX_NOTE, placeholder: "I already did this at work" }) };
      return form(`Remove “${old}” from “${title}”`, f, (v) => {
        addOp({ id: newOpId(), kind: "taskdrop", node: id, task: s.card.task, ...(v.note.trim() ? { note: v.note.trim() } : {}) });
      }, "Remove it");
    }
    if (kind === "ask") {
      const f = { note: input("What would you like your coach to add or change here?", { textarea: true, rows: 3, max: MAX_NOTE, placeholder: "Can you break this into smaller tasks?" }) };
      return form(`Ask your coach about “${title}”`, f, (v) => {
        if (!need(v.note, f.note.field)) return;
        addOp({ id: newOpId(), kind: "ask", node: id, note: v.note.trim() });
      });
    }
    // No form open yet: what can be done with this step.
    const mine = isNew(id);
    const changes = s.ops.filter((op) => opTargets(op)[0] === id);
    const act = (form, label) => btn({ label, variant: "ghost", onclick: () => openCard({ node: id, form }) });
    // The step's tasks as they'd be with this suggestion; ones they added are undone from the list below.
    const tasks = ((previewGraph() ?? ctx().state.graph).byId.get(id)?.tasks ?? []).filter((task) => !task.suggested && task.title);
    return el(
      "div.sgcard__menu",
      {},
      el("b.sgcard__title", {}, title),
      mine ? el("span.sgcard__tag", {}, "Your idea") : node ? null : null,
      el(
        "div.sgcard__grid",
        {},
        act("add", "Add a step after this"),
        act("task", "Add a task"),
        btn({
          label: "Move it",
          variant: "ghost",
          title: "Then tap the step it should come after",
          onclick: () => {
            s.picking = id;
            closeCard();
            render();
          },
        }),
        mine ? null : act("rename", "Rename"),
        mine ? null : act("retire", "Doesn't fit anymore"),
        mine ? null : act("ask", "Ask your coach about this")
      ),
      tasks.length
        ? el(
            "ul.sgcard__tasks",
            { "aria-label": "Tasks on this step" },
            el("li.sgcard__taskhead", {}, "Tasks"),
            tasks.map((task) =>
              el(
                "li",
                {},
                el("span", {}, task.title),
                btn({ label: "Edit", variant: "quiet", onclick: () => openCard({ node: id, form: "taskedit", task: task.id }) }),
                btn({ label: "Remove", variant: "quiet", onclick: () => openCard({ node: id, form: "taskdrop", task: task.id }) })
              )
            )
          )
        : null,
      changes.length
        ? el(
            "ul.sgcard__mine",
            {},
            changes.map((op) =>
              el("li", {}, el("span", {}, describeOp(op, titleOf, taskTitleOf)), btn({ label: "Undo", variant: "quiet", onclick: () => (removeOp(op.id), renderCard()) }))
            )
          )
        : null,
      el("div.sgcard__acts", {}, btn({ label: "Close", variant: "quiet", onclick: () => closeCard() }))
    );
  }

  function askForm() {
    const f = { note: input("What would help you most next?", { textarea: true, rows: 4, max: MAX_NOTE, placeholder: "I keep running into system design questions. What should I add?" }) };
    return form("Ask your coach for steps", f, (v) => {
      if (!need(v.note, f.note.field)) return;
      addOp({ id: newOpId(), kind: "ask", note: v.note.trim() });
    });
  }

  function review() {
    const checked = checkOps(curriculum(), s.ops);
    const live = open();
    const noteBox = el("textarea", { rows: 2, maxlength: MAX_NOTE, placeholder: "Anything your coach should know about these (optional)" });
    noteBox.value = s.note;
    noteBox.addEventListener("input", () => {
      s.note = noteBox.value;
      save();
    });
    const bad = checked.filter((c) => !c.ok);
    return el(
      "div.sgcard__review",
      {},
      el("b.sgcard__title", {}, `Your edits: ${s.ops.length} change${s.ops.length === 1 ? "" : "s"}`),
      el("p.sgcard__hint", {}, "Your coach reads each one, keeps what helps, and may adjust it. Your map changes only when they publish."),
      el(
        "ol.sgcard__list",
        {},
        checked.map(({ op, ok, errors }) =>
          el(
            "li",
            { class: ok ? null : "is-bad" },
            el("span.sgcard__kind", {}, OP_LABEL[op.kind]),
            el("span.sgcard__what", {}, describeOp(op, titleOf, taskTitleOf)),
            op.note ? el("span.sgcard__note", {}, op.note) : null,
            ok ? null : el("span.sgcard__error", {}, plainError(errors[0], titleOf)),
            btn({ label: "Remove", variant: "quiet", onclick: () => (removeOp(op.id), s.ops.length ? renderCard() : closeCard()) })
          )
        )
      ),
      el("label.sgcard__field", {}, el("span", {}, "A note for your coach"), noteBox),
      live ? el("p.sgcard__hint", {}, `This replaces the edits you sent on ${day(live.created_at)}.`) : null,
      s.error ? el("p.sgcard__error", { role: "alert" }, s.error) : null,
      el(
        "div.sgcard__acts",
        {},
        live ? btn({ label: "Withdraw what I sent", variant: "quiet", onclick: () => withdraw(live) }) : null,
        btn({ label: "Keep editing", variant: "quiet", onclick: () => closeCard() }),
        btn({ label: s.sending ? "Sending…" : "Send to your coach", variant: "solid", disabled: s.sending || bad.length > 0 || !s.ops.length, onclick: () => send() })
      )
    );
  }

  /** A refusal under the open form, keeping what they typed. */
  function showError(text) {
    s.error = text;
    const host = card.querySelector(".sgcard__form, .sgcard__review");
    if (!host) return renderCard();
    host.querySelector(".sgcard__error[role=alert]")?.remove();
    host.querySelector(".sgcard__acts")?.before(el("p.sgcard__error", { role: "alert" }, text));
  }

  function renderCard() {
    if (!s.card) {
      card.hidden = true;
      clear(card);
      return;
    }
    card.hidden = false;
    mount(card, s.card.review ? review() : s.card.ask ? askForm() : nodeForms(s.card.node));
    card.querySelector("input, textarea")?.focus({ preventScroll: true });
  }

  /* ---------- sending ---------- */

  async function send() {
    if (s.sending || !s.ops.length) return;
    s.sending = true;
    s.error = null;
    renderCard();
    try {
      await sendSuggestion(slug(), { base: s.base ?? ctx().state.mapVersion ?? null, ops: s.ops, note: s.note.trim() });
      writeDraft(slug(), null);
      s.sending = false;
      s.ops = [];
      s.note = "";
      closeCard({ quiet: true });
      setOn(false);
      toast("Sent to your coach. Your map stays as it is until they publish the update.");
      await refresh();
    } catch (error) {
      s.sending = false;
      s.error = error.errors?.length ? plainError(error.errors[0], titleOf) : `Not sent: ${error.message} Your changes are kept here.`;
      renderCard();
    }
  }

  async function withdraw(proposal) {
    try {
      await withdrawSuggestion(slug(), proposal.id);
      toast("Withdrawn. Your changes are still here to edit.");
      await refresh();
      renderCard();
    } catch (error) {
      toast(`Couldn't withdraw: ${error.message}`, "warn");
    }
  }

  /* ---------- the bar along the bottom and the pill up top ---------- */

  function render() {
    const can = ready();
    bar.hidden = !s.on;
    if (s.on) {
      const count = s.ops.length;
      const line = s.picking
        ? `Tap the step “${titleOf(s.picking)}” should come after.`
        : count
          ? `${count} change${count === 1 ? "" : "s"} so far. Your map stays as it is until your coach publishes.`
          : "Tap a step to change it, or drag + New step onto the step it comes after.";
      mount(
        bar,
        el(
          "div.sgbar__tools",
          {},
          el("button.sgchip", { type: "button", "data-sg-new": "", title: "Drag onto the step it comes after" }, "+ New step"),
          el("button.sgchip.sgchip--ask", { type: "button", onclick: () => openCard({ ask: true }) }, "Ask your coach")
        ),
        el("div.sgbar__text", {}, el("b", {}, "Editing your map"), el("span", {}, line)),
        s.picking ? btn({ label: "Cancel", variant: "quiet", onclick: () => ((s.picking = null), render()) }) : null,
        count && !s.picking ? btn({ label: "Review and send", variant: "solid", onclick: () => openCard({ review: true }) }) : null,
        btn({ label: "Done", variant: "quiet", onclick: () => setOn(false) })
      );
    }
    renderPill(can);
  }

  function renderPill(can) {
    const live = open();
    const answered = s.proposals.find((p) => ["merged", "declined"].includes(p.status));
    const latest = s.proposals[0];
    pill.hidden = true;
    if (s.on || !can) return;
    if (live) {
      pill.hidden = false;
      mount(
        pill,
        el("span.sgpill__dot", { "aria-hidden": "true" }),
        el("span", {}, `Your edits are with your coach · ${live.ops.length} change${live.ops.length === 1 ? "" : "s"}, sent ${day(live.created_at)}`),
        el("button.sgpill__b", { type: "button", onclick: () => setOn(true) }, "Open")
      );
      return;
    }
    if (answered && answered === latest && !answerSeen(slug(), answered.id)) {
      const kept = answered.kept?.length ?? 0;
      const line =
        answered.status === "merged"
          ? `Your coach updated your map from your edits${answered.ops.length ? ` (${kept} of ${answered.ops.length} changes in)` : ""}`
          : "Your coach answered your edits";
      pill.hidden = false;
      mount(
        pill,
        el("span.sgpill__dot", { class: answered.status === "merged" ? "is-ok" : null, "aria-hidden": "true" }),
        el("span", {}, line, answered.reply ? el("q.sgpill__reply", {}, answered.reply) : null),
        el("button.sgpill__b", { type: "button", onclick: () => (markAnswerSeen(slug(), answered.id), render()) }, "OK")
      );
    }
  }

  /* ---------- dragging: a step onto a step, or + New step onto a step ---------- */

  let drag = null;
  let swallowClick = false;

  const nodeAt = (x, y) => {
    const hit = document.elementFromPoint(x, y)?.closest?.(".rz-node");
    const id = hit?.dataset?.id;
    return id && !isLandmark(id) ? { id, g: hit } : null;
  };

  function highlight(target) {
    if (drag?.over?.g && drag.over.g !== target?.g) drag.over.g.classList.remove("is-drop-target");
    if (target?.g && target.id !== drag.from) target.g.classList.add("is-drop-target");
    drag.over = target;
  }

  function startDrag(event, from, label) {
    drag = { from, label, x: event.clientX, y: event.clientY, moved: false, over: null, pointerId: event.pointerId };
  }

  function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_SLOP) return;
    drag.moved = true;
    ghost.hidden = false;
    ghost.textContent = drag.label;
    ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 10}px)`;
    highlight(nodeAt(event.clientX, event.clientY));
  }

  function onUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const done = drag;
    drag.over?.g?.classList.remove("is-drop-target");
    drag = null;
    ghost.hidden = true;
    if (!done.moved) return;
    swallowClick = true;
    const target = nodeAt(event.clientX, event.clientY);
    if (!target) return;
    if (done.from === "+new") openCard({ node: target.id, form: "add" });
    else if (target.id !== done.from) openCard({ node: done.from, form: "move", after: target.id });
  }

  /** Wire dragging onto the map's host (the Route's container). */
  function attach(world) {
    world.addEventListener(
      "pointerdown",
      (event) => {
        if (!s.on || (event.button !== 0 && event.pointerType === "mouse")) return;
        const hit = event.target.closest?.(".rz-node");
        const id = hit?.dataset?.id;
        if (!id || isLandmark(id)) return;
        // In suggest mode a step is picked up, not the map panned.
        event.stopPropagation();
        startDrag(event, id, titleOf(id));
      },
      true
    );
    world.addEventListener(
      "click",
      (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
      },
      true
    );
    bar.addEventListener("pointerdown", (event) => {
      if (!event.target.closest?.("[data-sg-new]")) return;
      event.preventDefault();
      startDrag(event, "+new", "+ New step");
    });
    bar.addEventListener("click", (event) => {
      if (!event.target.closest?.("[data-sg-new]")) return;
      // A tap (no drag) on + New step: say how it works.
      if (!swallowClick) toast("Drag it onto the step it comes after. Or tap a step and pick “Add a step after this”.");
      swallowClick = false;
    });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function detach() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  }

  return {
    elements: [pill, card, bar, ghost],
    isOn: () => s.on,
    ready,
    setOn,
    tap,
    attach,
    detach,
    refresh,
    render,
    renderCard,
    /** The graph to draw: the suggestion drawn in while suggesting, else null (draw the live map). */
    graph: previewGraph,
    /** A signature part, so a rename or a mark redraws the map. */
    signature: () => (s.on ? s.ops.map((op) => `${op.id}:${op.kind}:${op.title ?? ""}:${op.after ?? ""}`).join(",") : ""),
  };
}
