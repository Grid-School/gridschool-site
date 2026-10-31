/**
 * Edit my map: the student changes their own map by touching the map.
 *
 * The map stays the map (map-is-the-product): editing tints it and draws the
 * student's changes on their own Route, new steps dashed and tagged "Your idea",
 * a step that no longer fits faded. Everything is direct:
 *
 *   the tray         drag Step, Every week or Milestone onto a line (it goes
 *                    between those two steps) or onto a step (it comes after
 *                    it); drag Task onto a step. Name it where it lands.
 *   a step           drag it onto another: it comes after that one instead
 *   its dots         one per task (filled when done), and + to add a task
 *   its ×            doesn't fit anymore (on a step of their own: take it out)
 *   its name         click it to rename it in place
 *   a tap            everything above in one card, for a phone
 *   the panel        every change so far, each with Undo, and Send to your coach
 *
 * While dragging, the target lights and the ghost says what will happen, or why
 * it can't: a place the map rules refuse never lights as a place to drop.
 *
 * Every change is checked against the map rules as it's made
 * (data/map-proposal.mjs checkOps), so a change that would break the map is
 * refused with the reason before it's ever sent. Nothing reaches the live map:
 * the suggestion goes to Aden (suggest-remote.js), who keeps, edits or
 * declines each change and publishes. The draft is kept in this browser until
 * it's sent; sending again replaces an open suggestion.
 */

import { el, mount, clear } from "../dom.js?v=7288040-202610310409";
import { btn, toast } from "../ui.js?v=7288040-202610310409";
import { buildGraph } from "../graph/model.js?v=7288040-202610310409";
import { isLandmark } from "../graph/route.js?v=7288040-202610310409";
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
} from "../../../data/map-proposal.mjs?v=7288040-202610310409";
import {
  suggestReady,
  listSuggestions,
  sendSuggestion,
  withdrawSuggestion,
  readDraft,
  writeDraft,
  answerSeen,
  markAnswerSeen,
} from "../suggest-remote.js?v=7288040-202610310409";

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

  const tray = el("div.sgtray", { hidden: true, role: "toolbar", "aria-label": "Add to your map" });
  const panel = el("aside.sgpanel", { hidden: true, "aria-label": "Your changes" });
  const pop = el("div.sgpop", { hidden: true, role: "dialog", "aria-label": "Name it" });
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
    closePop();
    redraw();
    render();
    return true;
  }

  function removeOp(id) {
    s.ops = withoutOp(s.ops, id);
    save();
    redraw();
    render();
  }

  /* ---------- turning it on and off ---------- */

  function setOn(on) {
    if (on === s.on) return;
    s.on = on;
    s.picking = null;
    s.error = null;
    if (on) loadDraft();
    closeCard({ quiet: true });
    closePop();
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

  function review({ inPanel = false } = {}) {
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
      el("b.sgcard__title", {}, s.ops.length ? `Your changes: ${s.ops.length}` : "Your changes"),
      el("p.sgcard__hint", {}, s.ops.length
        ? "Your coach reads each one, keeps what helps, and may adjust it. Your map changes only when they publish."
        : "Nothing yet. Drag something from the tray onto your map, drag a step to move it, or click a step's name to rename it."),
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
            btn({ label: "Undo", variant: "quiet", onclick: () => (removeOp(op.id), inPanel ? render() : s.ops.length ? renderCard() : closeCard()) })
          )
        )
      ),
      s.ops.length ? el("label.sgcard__field", {}, el("span", {}, "A note for your coach"), noteBox) : null,
      live ? el("p.sgcard__hint", {}, `This replaces the edits you sent on ${day(live.created_at)}.`) : null,
      s.error ? el("p.sgcard__error", { role: "alert" }, s.error) : null,
      el(
        "div.sgcard__acts",
        {},
        live ? btn({ label: "Withdraw what I sent", variant: "quiet", onclick: () => withdraw(live) }) : null,
        inPanel ? null : btn({ label: "Keep editing", variant: "quiet", onclick: () => closeCard() }),
        s.ops.length ? btn({ label: s.sending ? "Sending…" : "Send to your coach", variant: "solid", disabled: s.sending || bad.length > 0, onclick: () => send() }) : null
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
      const sent = await sendSuggestion(slug(), { base: s.base ?? ctx().state.mapVersion ?? null, ops: s.ops, note: s.note.trim() });
      writeDraft(slug(), null);
      s.sending = false;
      s.ops = [];
      s.note = "";
      closeCard({ quiet: true });
      setOn(false);
      // A self-serve map takes the change at once (map_automerge.py); a coach-kept map waits for the coach.
      toast(sent?.status === "merged" ? "Done. It's on your map." : "Sent to your coach. Your map stays as it is until they publish the update.");
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

  /* ---------- the tray, the panel and the pill up top ---------- */

  const TRAY = [
    { drag: "step", label: "Step", hint: "Something you finish" },
    { drag: "habit", label: "Every week", hint: "Something you keep doing every week" },
    { drag: "milestone", label: "Milestone", hint: "A moment worth marking, like a first offer call" },
    { drag: "task", label: "Task", hint: "One thing to do inside a step" },
  ];

  function render() {
    const can = ready();
    tray.hidden = !s.on;
    panel.hidden = !s.on;
    tray.parentElement?.classList.toggle("is-editing", s.on);
    if (s.on) {
      const count = s.ops.length;
      const line = s.picking
        ? `Tap the step “${titleOf(s.picking)}” should come after.`
        : "Drag onto a line to go between two steps, or onto a step to come after it.";
      mount(
        tray,
        el(
          "div.sgtray__chips",
          {},
          TRAY.map((item) =>
            el("button.sgchip", { type: "button", "data-sg-drag": item.drag, title: `${item.hint}. Drag it onto your map.` }, el("i", { class: `sgglyph sgglyph--${item.drag}`, "aria-hidden": "true" }), item.label)
          )
        ),
        el("span.sgtray__line", {}, line),
        s.picking ? btn({ label: "Cancel", variant: "quiet", onclick: () => ((s.picking = null), render()) }) : null,
        el("button.sgchip.sgchip--ask", { type: "button", onclick: () => openCard({ ask: true }) }, "Ask your coach"),
        // A phone has no room for the panel: the changes open as a card.
        el("button.sgchip.sgtray__changes", { type: "button", onclick: () => openCard({ review: true }) }, `Changes${count ? ` (${count})` : ""}`)
      );
      mount(panel, review({ inPanel: true }));
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

  /* ---------- naming things where they land ---------- */

  /** A small form at a point on screen: one field, Enter to add, Escape to leave. */
  function popAt(x, y, { title, placeholder = "", value = "", textarea = false, max = MAX_TITLE, submitLabel = "Add", required = true, submit }) {
    const field = textarea ? el("textarea", { rows: 3, maxlength: max, placeholder }) : el("input", { type: "text", maxlength: max, placeholder });
    field.value = value;
    const go = () => {
      const text = field.value.trim();
      if (required && !text) return field.focus();
      submit(text);
    };
    field.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePop();
      if (event.key === "Enter" && (!textarea || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        go();
      }
    });
    mount(
      pop,
      el("b.sgpop__title", {}, title),
      field,
      el("div.sgpop__err", { role: "alert" }),
      el("div.sgpop__acts", {}, btn({ label: "Cancel", variant: "quiet", onclick: () => closePop() }), btn({ label: submitLabel, variant: "solid", onclick: go }))
    );
    pop.hidden = false;
    const box = pop.parentElement?.getBoundingClientRect() ?? { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const w = pop.offsetWidth || 300;
    const h = pop.offsetHeight || 150;
    pop.style.left = `${Math.max(8, Math.min(x - box.left - w / 2, box.width - w - 8))}px`;
    pop.style.top = `${Math.max(8, Math.min(y - box.top + 18, box.height - h - 8))}px`;
    field.focus({ preventScroll: true });
  }

  function closePop() {
    pop.hidden = true;
    clear(pop);
  }

  /** A refusal inside the open popover, keeping what they typed. */
  function popError(text) {
    const box = pop.querySelector(".sgpop__err");
    if (box) box.textContent = text;
  }

  /** Add an op from the popover: refused ops say why in place instead of closing. */
  function addFromPop(op) {
    const reasons = refusal(op);
    if (reasons.length) return popError(reasons[0]);
    addOp(op);
  }

  const TYPE_WORD = { step: "step", habit: "every-week habit", milestone: "milestone" };

  function nameNew(x, y, { type, after, before }) {
    const word = TYPE_WORD[type] ?? "step";
    popAt(x, y, {
      title: before ? `A new ${word} between “${titleOf(after)}” and “${titleOf(before)}”` : `A new ${word} after “${titleOf(after)}”`,
      placeholder: { habit: "Apply to five roles", milestone: "First offer call" }[type] ?? "Ship a small Chrome extension",
      submit: (title) => addFromPop({ id: newOpId(), kind: "add", after, ...(before ? { before } : {}), ...(type !== "step" ? { type } : {}), title }),
    });
  }

  function nameTask(x, y, node) {
    popAt(x, y, {
      title: `A new task on “${titleOf(node)}”`,
      placeholder: "Record a two-minute test Loom",
      submit: (title) => addFromPop({ id: newOpId(), kind: "task", node, title }),
    });
  }

  function renameAt(x, y, id) {
    const title = titleOf(id);
    const added = isNew(id) ? addOpFor(id) : null;
    popAt(x, y, {
      title: "Rename this step",
      value: title,
      submitLabel: "Rename",
      submit: (next) => {
        if (next === title) return closePop();
        if (added) {
          // Their own new step: just a different name on it.
          s.ops = s.ops.map((op) => (op === added ? { ...op, title: next } : op));
          save();
          closePop();
          redraw();
          render();
          return;
        }
        addFromPop({ id: newOpId(), kind: "rename", node: id, title: next });
      },
    });
  }

  function retireAt(x, y, id) {
    const added = isNew(id) ? addOpFor(id) : null;
    if (added) {
      removeOp(added.id);
      toast("Taken out. Undo it from your changes if you want it back.");
      return;
    }
    popAt(x, y, {
      title: `“${titleOf(id)}” doesn't fit anymore`,
      placeholder: "What changed? For example: I already did this at work",
      textarea: true,
      max: MAX_NOTE,
      submitLabel: "Take it out",
      submit: (note) => addFromPop({ id: newOpId(), kind: "retire", node: id, note }),
    });
  }

  /* ---------- on the map: each step's task dots, its ×, its name ---------- */

  const SVG_NS = "http://www.w3.org/2000/svg";
  const NODE_R = 15;
  const MAX_DOTS = 8;
  function svg(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs ?? {})) node.setAttribute(key, value);
    parent?.append(node);
    return node;
  }
  const stop = (fn) => (event) => {
    event.stopPropagation();
    event.preventDefault();
    fn(event);
  };
  const centre = (element) => {
    const r = element.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };

  /** Draw (or clear) the editing marks on every step. Called after each draw of the map. */
  function decorate(nodeEls) {
    const graph = previewGraph() ?? ctx().state.graph;
    const done = ctx().state.student?.tasks ?? {};
    for (const [id, g] of nodeEls ?? []) {
      g.querySelector(".sgx")?.remove();
      if (!s.on || isLandmark(id)) continue;
      const node = graph?.byId?.get(id);
      if (!node) continue;
      const marks = svg("g", { class: "sgx" }, g);
      for (const kind of ["pointerdown", "click"]) marks.addEventListener(kind, (event) => event.stopPropagation());
      // The ×: doesn't fit anymore (or, on their own new step, take it out).
      const x = svg("g", { class: "sgx__x", transform: `translate(${-NODE_R - 2} ${-NODE_R - 2})`, role: "button", tabindex: 0 }, marks);
      svg("title", {}, x).textContent = isNew(id) ? "Take out your new step" : "Doesn't fit anymore";
      svg("circle", { r: 7.5 }, x);
      svg("path", { d: "M-2.6 -2.6 L2.6 2.6 M2.6 -2.6 L-2.6 2.6" }, x);
      x.addEventListener("click", stop(() => retireAt(...centre(x), id)));
      // The task dots, then + for a new one.
      const tasks = (node.tasks ?? []).filter((task) => task.title);
      const dots = svg("g", { class: "sgx__dots", transform: `translate(${NODE_R + 10} 0)` }, marks);
      tasks.slice(0, MAX_DOTS).forEach((task, index) => {
        const dot = svg("circle", {
          class: `sgx__dot${done[task.id]?.state === "done" ? " is-done" : ""}${task.suggested ? " is-new" : ""}`,
          cx: index * 9,
          r: 3.4,
        }, dots);
        svg("title", {}, dot).textContent = task.title;
        dot.addEventListener("click", stop(() => openCard({ node: id, form: null })));
      });
      const more = tasks.length > MAX_DOTS ? svg("text", { class: "sgx__more", x: MAX_DOTS * 9 - 2, y: 3.5 }, dots) : null;
      if (more) more.textContent = `+${tasks.length - MAX_DOTS}`;
      const plus = svg("g", { class: "sgx__add", transform: `translate(${Math.min(tasks.length, MAX_DOTS) * 9 + (more ? 18 : 4)} 0)`, role: "button", tabindex: 0 }, dots);
      svg("title", {}, plus).textContent = "Add a task";
      svg("circle", { r: 7 }, plus);
      svg("path", { d: "M-3 0 H3 M0 -3 V3" }, plus);
      plus.addEventListener("click", stop(() => nameTask(...centre(plus), id)));
      // The name: click it to rename.
      g.querySelector(".rz-title")?.classList.add("sgx__name");
    }
  }

  /* ---------- dragging: tray items and steps onto lines and steps ---------- */

  let drag = null;
  let swallowClick = false;

  const nodeAt = (x, y) => {
    const hit = document.elementFromPoint(x, y)?.closest?.(".rz-node");
    const id = hit?.dataset?.id;
    return id && !isLandmark(id) ? { node: id, el: hit } : null;
  };

  /** Every road line on screen, sampled, so the nearest one to the pointer can light. */
  function lineSamples() {
    return [...document.querySelectorAll(".rz-seg[data-from]")]
      .filter((path) => !isLandmark(path.dataset.from) && !isLandmark(path.dataset.to))
      .map((path) => {
        const m = path.getScreenCTM?.();
        const len = path.getTotalLength?.() ?? 0;
        if (!m || !len) return null;
        const pts = Array.from({ length: 11 }, (_, i) => {
          const p = path.getPointAtLength((len * (i + 2)) / 14);
          return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
        });
        return { el: path, after: path.dataset.from, before: path.dataset.to, pts };
      })
      .filter(Boolean);
  }

  function lineAt(x, y) {
    let best = null;
    for (const line of drag.lines ?? []) {
      for (const p of line.pts) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 26 && (!best || d < best.d)) best = { ...line, d };
      }
    }
    return best;
  }

  /** Does `id` wait on `on`, on the map as it would be with the changes so far? */
  function waitsOn(id, on) {
    const nodes = s.ops.length ? applyOps(curriculum(), s.ops).map.nodes : curriculum().nodes;
    return (nodes.find((node) => node.id === id)?.requires ?? []).includes(on);
  }

  /** The change a drop here would make, and whether the map rules take it. */
  function candidate(target) {
    if (!target) return null;
    const id = newOpId();
    if (drag.from === "task") return target.node ? { op: { id, kind: "task", node: target.node, title: "New task" } } : null;
    if (drag.type) {
      // A line between two steps where the second really waits on the first: the new step goes in between.
      // Where the line only shows the order (the second doesn't wait on the first), it comes after the first,
      // which numbers and draws it between them all the same.
      const after = target.node ?? target.after;
      const before = target.before && waitsOn(target.before, after) ? target.before : null;
      const op = { id, kind: "add", after, ...(before ? { before } : {}), ...(drag.type !== "step" ? { type: drag.type } : {}), title: "New step" };
      return { op };
    }
    if (!target.node || target.node === drag.from) return null;
    return { op: { id, kind: "move", node: drag.from, after: target.node } };
  }

  /** Moving their own new step changes its add; any other step gets a move. */
  function movedOps(from, after) {
    const added = isNew(from) ? addOpFor(from) : null;
    return added ? s.ops.map((op) => (op === added ? { ...op, after, before: undefined } : op)) : [...s.ops, { id: newOpId(), kind: "move", node: from, after }];
  }

  function verdict(found) {
    if (!found) return null;
    const ops = found.op.kind === "move" ? movedOps(found.op.node, found.op.after) : [...s.ops, found.op];
    const bad = checkOps(curriculum(), ops).find((c) => !c.ok);
    return bad ? plainError(bad.errors?.[0] ?? bad.conflict ?? "", titleOf) : null;
  }

  function describeDrop(found) {
    const op = found.op;
    if (op.kind === "task") return `A task on “${titleOf(op.node)}”`;
    if (op.kind === "move") return `“${titleOf(op.node)}” comes after “${titleOf(op.after)}”`;
    const word = TYPE_WORD[op.type ?? "step"];
    return op.before ? `A new ${word} between “${titleOf(op.after)}” and “${titleOf(op.before)}”` : `A new ${word} after “${titleOf(op.after)}”`;
  }

  function light(target, bad) {
    if (drag.lit && drag.lit !== target?.el) drag.lit.classList.remove("is-drop-target", "is-drop-bad");
    drag.lit = target?.el ?? null;
    if (drag.lit) {
      drag.lit.classList.toggle("is-drop-target", !bad);
      drag.lit.classList.toggle("is-drop-bad", Boolean(bad));
    }
  }

  function startDrag(event, from, label, type = null) {
    drag = { from, label, type, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId, lines: null, lit: null, found: null, bad: null };
  }

  function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_SLOP) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.lines = drag.type ? lineSamples() : [];
      tray.parentElement?.classList.add("is-dragging");
    }
    const hit = nodeAt(event.clientX, event.clientY);
    const target = hit && hit.node !== drag.from ? hit : drag.type ? lineAt(event.clientX, event.clientY) : null;
    const found = candidate(target);
    const bad = verdict(found);
    drag.found = found;
    drag.bad = bad;
    drag.target = target;
    light(found ? target : null, bad);
    ghost.hidden = false;
    mount(ghost, el("b", {}, drag.label), el("span", { class: bad ? "is-bad" : null }, found ? (bad ? bad : describeDrop(found)) : drag.type ? "Drop on a line or a step" : drag.from === "task" ? "Drop on a step" : "Drop on the step it comes after"));
    ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 10}px)`;
  }

  function onUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const done = drag;
    light(null);
    drag = null;
    ghost.hidden = true;
    tray.parentElement?.classList.remove("is-dragging");
    if (!done.moved) return;
    // The click that ends this drag is swallowed; if none comes (released off the map), the next one isn't.
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    if (!done.found) return;
    if (done.bad) {
      toast(done.bad, "warn");
      return;
    }
    const op = done.found.op;
    if (op.kind === "task") return nameTask(event.clientX, event.clientY, op.node);
    if (op.kind === "add") return nameNew(event.clientX, event.clientY, { type: op.type ?? "step", after: op.after, before: op.before });
    // A step moved: done at once, like any direct move; Undo is in the panel.
    s.ops = movedOps(op.node, op.after);
    save();
    redraw();
    render();
  }

  /** Wire editing onto the map's host (the Route's container). */
  function attach(world) {
    world.addEventListener(
      "pointerdown",
      (event) => {
        if (!s.on || (event.button !== 0 && event.pointerType === "mouse")) return;
        if (event.target.closest?.(".sgx")) return;
        // A finger pans the map; a step moves by tapping it, then "Move it".
        if (event.pointerType === "touch") return;
        const hit = event.target.closest?.(".rz-node");
        const id = hit?.dataset?.id;
        if (!id || isLandmark(id)) return;
        // While editing a step is picked up, not the map panned.
        event.stopPropagation();
        startDrag(event, id, titleOf(id));
      },
      true
    );
    world.addEventListener(
      "click",
      (event) => {
        if (swallowClick) {
          swallowClick = false;
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        // Click a step's name to rename it, right there.
        const name = s.on ? event.target.closest?.(".rz-title") : null;
        const id = name?.closest?.(".rz-node")?.dataset?.id;
        if (!id || isLandmark(id)) return;
        event.stopPropagation();
        event.preventDefault();
        const r = name.getBoundingClientRect();
        renameAt(r.left + r.width / 2, r.top, id);
      },
      true
    );
    tray.addEventListener("pointerdown", (event) => {
      const chip = event.target.closest?.("[data-sg-drag]");
      if (!chip) return;
      event.preventDefault();
      try {
        chip.setPointerCapture?.(event.pointerId);
      } catch {
        /* a pointer the browser no longer tracks: the window listeners still follow it */
      }
      const item = TRAY.find((t) => t.drag === chip.dataset.sgDrag);
      startDrag(event, item.drag === "task" ? "task" : "+new", item.label, item.drag === "task" ? null : item.drag);
    });
    tray.addEventListener("click", (event) => {
      if (!event.target.closest?.("[data-sg-drag]")) return;
      // A tap (no drag) on a tray item: say how it works.
      if (!swallowClick) toast("Drag it onto your map: onto a line to go between two steps, or onto a step.");
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
    elements: [pill, card, tray, panel, pop, ghost],
    isOn: () => s.on,
    ready,
    setOn,
    tap,
    attach,
    detach,
    decorate,
    refresh,
    render,
    renderCard,
    /** The graph to draw: the suggestion drawn in while suggesting, else null (draw the live map). */
    graph: previewGraph,
    /** A signature part, so a rename or a mark redraws the map. */
    signature: () => (s.on ? s.ops.map((op) => `${op.id}:${op.kind}:${op.title ?? ""}:${op.after ?? ""}`).join(",") : ""),
  };
}
