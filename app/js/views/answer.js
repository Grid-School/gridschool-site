/**
 * A q-step's questions, answered on the step itself (complete_map.py puts `chunk` on each q-step).
 *
 * The questions, their order and which ones apply come from the check's logic (data/intake/intake.mjs);
 * answer-chunk.js turns the form into the PUT /students/:slug/intake body. Saving marks the chunk done,
 * checks the step's one task (so the step lights), then asks the server to rebuild and republish the map
 * from every answer so far (server/onboarding_api.py), and reopens the board on it. Nobody reviews it:
 * the map is rebuilt by the same rules that built it.
 */

import { el } from "../dom.js?v=9e8fcb7-202610272025";
import { btn } from "../ui.js?v=9e8fcb7-202610272025";
import * as A from "../answer-chunk.js?v=9e8fcb7-202610272025";
import { intakeReady, loadIntake, saveChunk, rebuildMap } from "../intake-remote.js?v=9e8fcb7-202610272025";
import { registerLeaveGuard, clearLeaveGuard } from "../leave-guard.js?v=9e8fcb7-202610272025";

let catalogPromise = null;
const seats = new Map(); // slug -> intake state from the server
const drafts = new Map(); // `${slug}:${chunk}` -> state being edited, kept across repaints
const editing = new Set(); // `${slug}:${chunk}` reopened after it was done
const notes = new Map(); // `${slug}:${chunk}` -> what the last save did, shown after the step repaints

function loadCatalog() {
  catalogPromise ??= fetch(new URL("../../../data/intake/questions.json", import.meta.url), { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error("The questions didn't load.");
    return res.json();
  });
  return catalogPromise;
}

async function loadSeat(slug) {
  if (seats.has(slug)) return seats.get(slug);
  let state = A.seatState(null);
  if (intakeReady() && slug !== "demo") state = A.seatState(await loadIntake(slug));
  seats.set(slug, state);
  return state;
}

/** One question's control. `onPick` re-draws the form (a pick can change which questions apply). */
export function control(question, value, { onInput, onPick }) {
  const raw = A.toInput(question, value);
  const id = `aq-${question.id}`;
  if (question.kind === "choice" || question.kind === "multi") {
    const multi = question.kind === "multi";
    return el(
      "div.answer__opts",
      { role: multi ? "group" : "radiogroup", "aria-labelledby": `${id}-label` },
      question.options.map((option) => {
        const on = multi ? raw.includes(option.value) : raw === option.value;
        return el(
          "button.answer__opt",
          {
            type: "button",
            "aria-pressed": String(on),
            dataset: { q: question.id, v: option.value },
            onclick: () => {
              const next = multi ? (on ? raw.filter((v) => v !== option.value) : [...raw, option.value]) : on ? "" : option.value;
              onPick(next);
            },
          },
          option.label
        );
      })
    );
  }
  if (question.kind === "range") {
    const [lowLabel, highLabel] = question.labels ?? ["From", "To"];
    const box = { ...raw };
    const input = (key, label) =>
      el(
        "label.answer__range-part",
        {},
        el("span", {}, label),
        el("input", { type: "number", inputMode: "numeric", min: question.min ?? 0, max: question.max ?? undefined, value: box[key], oninput: (e) => onInput({ ...box, [key]: (box[key] = e.target.value) }) })
      );
    return el("div.answer__range", { id }, input("min", lowLabel), input("max", highLabel));
  }
  if (question.kind === "number") {
    return el("input.answer__input", { id, type: "number", min: question.min ?? 0, max: question.max ?? undefined, value: raw, oninput: (e) => onInput(e.target.value) });
  }
  if (question.kind === "links") {
    return el("textarea.answer__input", { id, rows: Math.min(4, Number(question.max) || 2), placeholder: "https://", value: raw, oninput: (e) => onInput(e.target.value) });
  }
  if (question.kind === "text") {
    const max = Number(question.max) || 1000;
    if (max <= 120) return el("input.answer__input", { id, type: "text", maxLength: max, value: raw, oninput: (e) => onInput(e.target.value) });
    return el("textarea.answer__input", { id, rows: max >= 2000 ? 6 : max > 600 ? 4 : 2, maxLength: max, value: raw, oninput: (e) => onInput(e.target.value) });
  }
  return el("p.answer__later", {}, "You can add this later from your map. Leave it for now.");
}

/**
 * The block that stands in for a q-step's task list. `done` is the step lit; `onSaved` checks its task.
 */
export function answerBlock({ node, slug, done, onSaved }) {
  const key = `${slug}:${node.chunk}`;
  const guard = `answers-${node.id}`;
  const body = el("div.answer__body", {}, el("p.muted", {}, "Loading your questions..."));
  const section = el(
    "section.step__answer",
    { "aria-label": "Your answers" },
    el("b.eyebrow", {}, "Your answers"),
    el("p.step__answer-lead", {}, "Answer what you can and skip the rest. When you save, your map rebuilds itself around your answers."),
    body
  );
  let catalog = null;
  let dirty = false;

  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    registerLeaveGuard(guard, () => dirty, "Your answers aren't saved yet. Click Save my answers or you will lose them.");
  };

  function summary(state) {
    const asked = A.askedNow(catalog, node.chunk, state);
    const note = notes.get(key);
    return [
      note ? el("p.answer__status.answer__status--done", { role: "status" }, note) : null,
      el(
        "dl.answer__summary",
        {},
        asked.flatMap((q) => [el("dt", {}, q.prompt), el("dd", {}, A.answerLine(q, state.answers[q.id]))])
      ),
      el("div.answer__acts", {}, btn({ label: "Change my answers", variant: "ghost", onclick: () => (editing.add(key), notes.delete(key), draw()) })),
    ].filter(Boolean);
  }

  function form() {
    let state = drafts.get(key) ?? seats.get(slug) ?? A.seatState(null);
    const status = el("p.answer__status", { role: "status", "aria-live": "polite" });
    const count = el("p.answer__count");
    const errors = new Map();
    const paintCount = () => {
      const { answered, total } = A.answeredCount(catalog, node.chunk, state);
      count.textContent = `${answered} of ${total} answered`;
    };
    const set = (question, raw) => {
      state = A.setAnswer(state, question, raw);
      drafts.set(key, state);
      errors.get(question.id)?.replaceChildren();
      markDirty();
      paintCount();
    };
    const list = el("div.answer__list");
    const paintList = (focusQ = null, focusV = null) => {
      errors.clear();
      list.replaceChildren(
        ...A.askedNow(catalog, node.chunk, state).map((q, index) => {
          const err = el("p.answer__err", { role: "alert" });
          errors.set(q.id, err);
          return el(
            "div.answer__q",
            {},
            el("p.answer__prompt", { id: `aq-${q.id}-label` }, el("span.answer__n", {}, String(index + 1)), q.prompt),
            q.help ? el("p.answer__help", {}, q.help) : null,
            control(q, state.answers[q.id], {
              onInput: (raw) => set(q, raw),
              onPick: (raw) => {
                set(q, raw);
                const picked = Array.isArray(raw) ? raw.at(-1) : raw;
                paintList(q.id, picked);
              },
            }),
            err
          );
        })
      );
      if (focusQ) list.querySelector(`[data-q="${focusQ}"]${focusV ? `[data-v="${focusV}"]` : ""}`)?.focus({ preventScroll: true });
      paintCount();
    };
    paintList();

    const save = btn({ label: "Save my answers", variant: "solid" });
    save.addEventListener("click", async () => {
      const found = A.problems(catalog, node.chunk, state);
      for (const [qid, message] of Object.entries(found)) errors.get(qid)?.replaceChildren(message);
      if (Object.keys(found).length) {
        status.textContent = "Fix the answer marked above, then save.";
        return;
      }
      const payload = A.payloadFor(catalog, node.chunk, state);
      const finish = (note) => {
        dirty = false;
        clearLeaveGuard(guard);
        drafts.delete(key);
        editing.delete(key);
        notes.set(key, note);
        onSaved(); // checks the step's task: the step lights and repaints with the summary and this note
      };
      if (!intakeReady() || slug === "demo") {
        seats.set(slug, state);
        finish("Saved on this page only. Sign in to your own map to keep your answers.");
        return;
      }
      save.disabled = true;
      status.textContent = "Saving...";
      try {
        seats.set(slug, A.seatState(await saveChunk(slug, payload)));
      } catch (error) {
        save.disabled = false;
        status.textContent = error.message || "That didn't save. Try again in a moment.";
        return;
      }
      status.textContent = "Saved. Rebuilding your map...";
      let result = null;
      let line;
      try {
        result = await rebuildMap(slug);
        line = A.rebuildLine(result);
      } catch (error) {
        line = error.status === 409 ? A.rebuildLine(null) : `Your answers are saved. ${error.status === 429 ? error.message : "Your map will catch up the next time you save."}`;
      }
      finish(line);
      // The board reads the published map when it loads; give the checked task a moment to reach the server.
      if (result?.status === "published") {
        setTimeout(() => {
          location.hash = "#/map";
          location.reload();
        }, 1500);
      }
    });

    return [list, el("div.answer__acts", {}, save, count), status];
  }

  function draw() {
    if (!catalog) return;
    const state = seats.get(slug) ?? A.seatState(null);
    body.replaceChildren(...(done && !editing.has(key) ? summary(state) : form()));
  }

  Promise.all([loadCatalog(), loadSeat(slug)])
    .then(([loaded]) => {
      catalog = loaded;
      draw();
    })
    .catch((error) => body.replaceChildren(el("p.answer__status", { role: "alert" }, error.message || "Your questions didn't load. Reload the page to try again.")));

  return section;
}
