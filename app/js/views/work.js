/**
 * The waiting panel for a long AI call: a page being read, the steps of the work, and what the model has
 * found so far, as it finds it. Any tool can use it: give it the steps it will go through and, if the
 * server reports progress (server/work_progress.py), a poll that returns that run's progress or null.
 *
 * Until the server says otherwise, the first step is shown as the one in progress and the clock runs.
 * Nothing is made up to fill the wait: notes come only from the server, and a step is ticked only when
 * the server says it's done (or the call has come back).
 */

import { el } from "../dom.js?v=fc7db25-202610310827";

const SHOWN_NOTES = 6;

function visual() {
  // A page with lines, a beam reading down it, lines lighting up behind the beam (work.css, motion off when asked).
  const lines = [92, 64, 80, 0, 88, 72, 58, 0, 84, 66].map((w, i) =>
    w ? el("span.work__line", { style: `--w:${w}%; --i:${i}` }) : el("span.work__gap"));
  return el("div.work__art", { "aria-hidden": "true" }, el("div.work__page", {}, lines, el("span.work__beam")));
}

export function workPanel({ title, steps, poll, every = 1000 }) {
  const titleEl = el("p.work__title", {}, title);
  const clock = el("span.work__clock", {}, "0:00");
  const list = el("ol.work__steps");
  const notes = el("ul.work__notes", { "aria-live": "polite" });
  const node = el("div.work", { role: "status" }, visual(), el("div.work__body", {}, el("div.work__top", {}, titleEl, clock), list, notes));
  const started = Date.now();
  let shape = "";
  let seen = 0;
  let stopped = false;
  let wait = null;

  function drawSteps(items) {
    const next = JSON.stringify(items.map((s) => [s.label, s.state, s.detail || ""]));
    if (next === shape) return; // unchanged: leave the DOM (and its animations) alone
    shape = next;
    list.replaceChildren(...items.map((s) =>
      el(`li.work__step.is-${s.state}`, {},
        el("span.work__dot", { "aria-hidden": "true" }, s.state === "done" ? "✓" : ""),
        el("span.work__label", {}, s.label, s.detail ? el("small", {}, s.detail) : null))));
  }

  function addNotes(all) {
    for (const n of all.slice(seen)) {
      notes.append(el("li.work__note", {}, n.text));
      while (notes.children.length > SHOWN_NOTES) notes.firstElementChild.remove();
    }
    seen = Math.max(seen, all.length);
  }

  function update(progress) {
    if (!progress) return;
    if (Array.isArray(progress.steps) && progress.steps.length) drawSteps(progress.steps);
    if (Array.isArray(progress.notes)) addNotes(progress.notes);
  }

  function tick() {
    const s = Math.floor((Date.now() - started) / 1000);
    clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  async function loop() {
    if (stopped) return;
    try {
      update(await poll());
    } catch {
      // No progress from this server (an older one, or another process): the steps and clock still show.
    }
    if (!stopped) wait = setTimeout(loop, every);
  }

  drawSteps(steps.map((s, i) => ({ ...s, state: i === 0 ? "active" : "todo" })));
  const timer = setInterval(tick, 1000);
  if (poll) wait = setTimeout(loop, 500);

  return {
    node,
    update,
    setTitle(text) {
      titleEl.textContent = text;
    },
    /** The call came back: tick every step, then the caller moves on. */
    complete() {
      const items = JSON.parse(shape || "[]").map(([label, , detail]) => ({ label, detail, state: "done" }));
      drawSteps(items);
      node.classList.add("is-complete");
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      clearTimeout(wait);
    },
  };
}
