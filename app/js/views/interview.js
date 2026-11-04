/**
 * The interview: the resume step as a conversation (ops/intake-and-resume-system-2026-11.md).
 *
 * Laid out like any chat the student already knows: the conversation scrolls in the middle, what they can do
 * right now is pinned at the bottom, and a checklist beside it shows what's in and what's left. The assistant's
 * words appear as they're written. Facts get chips, never a free box; stories get a text turn with a talk
 * button. "Not sure" is a tap and moves on. Every turn is saved on the server before anything else runs
 * (server/interview_api.py), and a returning student opens on a recap. The moment there is enough to write, a
 * door to the resume builder appears; the builder itself (resume.js) still writes, checks and saves the lines.
 */

import { el, mount } from "../dom.js?v=3c8024f-202611042144";
import { btn, toast } from "../ui.js?v=3c8024f-202611042144";
import { isProgressReadOnly } from "../store.js?v=3c8024f-202611042144";
import * as api from "../interview-remote.js?v=3c8024f-202611042144";
import { loadProgress } from "../resume-remote.js?v=3c8024f-202611042144";
import { talkButton } from "./voice.js?v=3c8024f-202611042144";
import { bindDraft, clearDraft } from "../drafts.js?v=3c8024f-202611042144";
import { renderResume, openResumeAt, fileToPayload } from "./resume.js?v=3c8024f-202611042144";

const SESSION_MINUTES = 8;
const SHOWN_TURNS = 14;
const WORK = {
  import: [
    { id: "got", label: "Got your history" },
    { id: "read", label: "Reading every job and line, word for word" },
    { id: "check", label: "Checking every number and skill against your own words" },
    { id: "ask", label: "Choosing what to ask first" },
  ],
  answer: [
    { id: "read", label: "Reading your answer" },
    { id: "check", label: "Checking the numbers against your words" },
    { id: "next", label: "Choosing the next question" },
  ],
};
const STATE_MARK = { known: "✓", partial: "·", empty: "" };
const STAGE_WORDS = {
  engineer: "working as an engineer now",
  between_roles: "an engineer between roles",
  student: "still in school",
  career_changer: "moving into software from another field",
  new_grad: "a new graduate",
};
const WELCOME = ""; // No welcome: the first screen is the resume drop zone, and "Not sure" teaches itself as a chip.

const started = new Set(); // seats whose sitting was marked started in this page load
const revealed = new Set(); // message keys already typed out, so a repaint never retypes them
const reduceMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Write `text` into `node` a word at a time, the way a reply arrives. Returns a promise that resolves when done. */
function typeInto(node, text, key) {
  if (!text) return Promise.resolve();
  if (revealed.has(key) || reduceMotion()) {
    node.textContent = text;
    revealed.add(key);
    return Promise.resolve();
  }
  revealed.add(key);
  const words = text.split(/(\s+)/);
  node.textContent = "";
  node.classList.add("is-typing");
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      node.textContent += words[i] ?? "";
      i += 1;
      if (i < words.length) setTimeout(tick, /\s/.test(words[i] ?? "") ? 0 : 26);
      else {
        node.classList.remove("is-typing");
        resolve();
      }
    };
    tick();
  });
}

export function renderInterview(ctx, options = {}) {
  let node = options.node || null;
  const root = el("div.view.view--interview");
  let current = ctx;
  let slug = ctx.state.slug;
  let st = null;
  let error = "";
  let busy = "";
  let work = null; // {steps, poll, timer, progress}
  let savedAt = null;
  let stopping = false;
  let stopOffered = false;
  let sittingStart = Date.now();
  let handed = false;
  let builder = null;
  let picks = new Set();
  let ingestChoice = "";
  let logEl = null;

  const readOnly = () => isProgressReadOnly();

  async function load() {
    try {
      const out = await api.loadInterview(slug);
      take(out);
      if (!started.has(slug) && !readOnly()) {
        started.add(slug);
        sittingStart = Date.now();
        api.markSession(slug, "start").then(take).catch(() => null);
      }
    } catch (e) {
      error = e.status === 404 ? "The interview isn't open on this seat yet." : e.message;
      render();
    }
  }

  function take(next) {
    st = next;
    error = "";
    picks = new Set();
    ingestChoice = "";
    if (!stopOffered && !handed && (Date.now() - sittingStart) / 60000 >= SESSION_MINUTES) {
      stopping = true;
      stopOffered = true;
    }
    render();
  }

  /** One call to the server. `steps` (one of WORK) shows what's being done while a model reads. */
  async function run(label, fn, steps = null) {
    if (busy) return;
    busy = label;
    const runId = steps ? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : "";
    work = steps ? { steps, progress: null, timer: null } : null;
    if (work) {
      const poll = async () => {
        try {
          const p = (await loadProgress(slug)).progress;
          if (p?.run === runId) {
            work.progress = p;
            paintWork();
          }
        } catch { /* keep going */ }
      };
      work.timer = setInterval(poll, 1000);
    }
    render();
    try {
      const out = await fn(runId);
      if (work) {
        clearInterval(work.timer);
        if (work.progress) {
          work.progress.steps.forEach((s) => (s.state = "done"));
          paintWork();
          await new Promise((r) => setTimeout(r, 450));
        }
      }
      savedAt = new Date();
      busy = "";
      work = null;
      take(out);
    } catch (e) {
      if (work) clearInterval(work.timer);
      busy = "";
      work = null;
      if (e.status === 409 && e.payload?.checklist) {
        take(e.payload);
        toast("That changed in another tab, so here's the latest.", "warn");
        return;
      }
      toast(e.message || "Something went wrong. Nothing you typed was lost.", "warn");
      render();
    }
  }

  const turn = (body) => api.sendTurn(slug, { version: st.version, resume_version: st.resume_version, ...body });
  const answerSlot = (q, value) => run("Saving.", () => turn({ question_id: q.id, kind: "answer", value }));
  const answerText = (q, text, draftId) =>
    run(q.kind === "resume" ? "Reading your answer." : "Saving.", (r) =>
      turn({ question_id: q.id, kind: "answer", text, run: r || undefined }).then((out) => {
        clearDraft(slug, draftId);
        return out;
      }), q.kind === "resume" ? WORK.answer : null);
  const notSure = (q) => run("Noting that.", () => turn({ question_id: q.id, kind: "unknown" }));
  const notApplicable = (q) => run("Noting that.", () => turn({ question_id: q.id, kind: "na" }));
  const skip = (q) => run("Skipping for now.", () => turn({ question_id: q.id, kind: "skip" }));

  async function importFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      if (file.size > 25 * 1024 * 1024) return toast("That zip is over 25 MB. The LinkedIn export is usually under 1 MB.", "warn");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return run("Reading your LinkedIn export.", (r) => api.importHistory(slug, { resume_version: st.resume_version, zip: btoa(bin), run: r }), WORK.import);
    }
    let payload;
    try {
      payload = await fileToPayload(file);
    } catch (e) {
      return toast(e.message, "warn");
    }
    return run("Reading your resume.", (r) => api.importHistory(slug, { resume_version: st.resume_version, ...payload, run: r }), WORK.import);
  }

  function handOver(stage = "write") {
    // Inside the walk the resume is the next screen, so the walk takes it from here.
    if (typeof options.onBuild === "function") return options.onBuild(stage);
    handed = true;
    openResumeAt(stage);
    builder = renderResume(current, { embedded: true, node, interview: true });
    render();
  }

  // ---------------------------------------------------------------- the conversation

  const you = (text, key) => el("div.iv__msg.iv__msg--you", { "data-key": key }, el("p", {}, text));
  function us(text, key, { stream = false, extra = null } = {}) {
    const p = el("p");
    const wrap = el("div.iv__msg.iv__msg--us", { "data-key": key }, p, extra);
    if (stream) typeInto(p, text, key).then(() => scrollToEnd());
    else {
      p.textContent = text;
      revealed.add(key);
    }
    return wrap;
  }
  /** A confirmation is a small system line, never a reply that mirrors what was just said. */
  const sys = (text, key) => el("div.iv__sys", { "data-key": key }, el("span.iv__sysmark", { "aria-hidden": "true" }, "✓"), el("span", {}, text));

  function transcript() {
    const rows = (st.transcript || []).filter((t) => ["turn", "reflection", "import", "ingest"].includes(t.type)).slice(-SHOWN_TURNS);
    const out = [];
    if (WELCOME && !rows.some((t) => t.type === "turn" || t.type === "import")) out.push(us(WELCOME, "welcome", { stream: !revealed.has("welcome") }));
    // The "noted" lines only matter for the last few turns; older ones would be a second transcript.
    const turnSeqs = rows.filter((t) => t.type === "turn").map((t) => t.seq);
    const recentFrom = turnSeqs.length > 3 ? turnSeqs[turnSeqs.length - 3] : -1;
    for (const t of rows) {
      const key = `e${t.seq}`;
      if (t.type === "reflection") { if (t.seq >= recentFrom) out.push(sys(t.text, key)); }
      else if (t.type === "import") out.push(you(t.kind === "linkedin" ? `My LinkedIn export (${t.positions ?? 0} jobs, ${t.projects ?? 0} projects)` : "My resume", key));
      else if (t.type === "ingest") { if (t.choice === "type") out.push(you(t.label || t.choice, key)); }
      else out.push(you(t.text || t.label || "…", key));
    }
    return out;
  }

  function workBubble() {
    const w = work;
    const p = w?.progress;
    const steps = (p?.steps || w?.steps || []).map((s, i) => {
      const state = p ? s.state : i === 0 ? "active" : "todo";
      return el(`li.iv__wstep.is-${state}`, {}, el("span.iv__wdot", { "aria-hidden": "true" }), el("span", {}, s.label, s.detail ? el("small", {}, ` · ${s.detail}`) : null));
    });
    const notes = (p?.notes || []).slice(-3).map((n) => el("li", {}, n.text));
    return el("div.iv__msg.iv__msg--us.iv__msg--work", { "data-work": "" },
      el("p.iv__wtitle", {}, busy, el("span.iv__clock", {}, p ? ` ${Math.floor(p.elapsed / 60)}:${String(Math.floor(p.elapsed % 60)).padStart(2, "0")}` : "")),
      el("ol.iv__wsteps", {}, steps),
      notes.length ? el("ul.iv__wnotes", { "aria-live": "polite" }, notes) : null);
  }

  function paintWork() {
    const old = root.querySelector("[data-work]");
    if (old) old.replaceWith(workBubble());
    scrollToEnd();
  }

  function scrollToEnd() {
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
    // In the walk the talk is the page: the walk's body scrolls, the composer stays in reach at its foot.
    const sc = root.closest(".walk__body");
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  // ---------------------------------------------------------------- what they can do now (pinned)

  function chips(q, { multi = false, big = false } = {}) {
    return el("div.iv__chips", { role: multi ? "group" : "radiogroup" }, (q.options || []).map(([value, label]) =>
      el(`button.iv__chip${big ? ".iv__chip--big" : ""}`, {
        type: "button",
        "aria-pressed": multi ? String(picks.has(value)) : null,
        disabled: busy || readOnly() ? true : null,
        onclick: () => {
          if (!multi) return answerSlot(q, value);
          if (picks.has(value)) picks.delete(value); else picks.add(value);
          if (value === "any" || value === "none") picks = new Set([value]);
          else { picks.delete("any"); picks.delete("none"); }
          paintComposer();
        },
      }, label)));
  }

  function escapes(q, { withSkip = true } = {}) {
    const acts = [];
    if (q.unknown) acts.push(el("button.sw__ghost", { type: "button", onclick: () => notSure(q) }, "Not sure"));
    if (q.na) acts.push(el("button.sw__ghost", { type: "button", onclick: () => notApplicable(q) }, q.na));
    if (withSkip) acts.push(el("button.sw__quiet", { type: "button", onclick: () => skip(q) }, "Skip for now"));
    return acts;
  }

  function composerFor(q) {
    if (q.kind === "ingest") return ingestComposer(q);
    if (q.kind === "chips") return el("div.iv__compose", {}, chips(q), el("div.iv__acts", {}, ...escapes(q, { withSkip: Boolean(q.unknown) })));
    if (q.kind === "multi") {
      return el("div.iv__compose", {}, chips(q, { multi: true }),
        el("div.iv__acts", {}, el("button.sw__solid", { type: "button", onclick: () => (picks.size ? answerSlot(q, [...picks]) : toast("Pick one or more first.", "warn")) }, "Save"), ...escapes(q)));
    }
    const long = q.kind === "resume" || q.kind === "text";
    const box = long
      ? el("textarea.iv__input", { rows: 1, placeholder: q.kind === "resume" ? "Talk it through the way you would to a friend. Rough numbers are fine: say \"about\"." : q.placeholder || "Type here" })
      : el("input.iv__input.iv__input--line", { type: q.kind === "url" ? "url" : "text", placeholder: q.placeholder || "", inputmode: q.kind === "url" ? "url" : "text", autocomplete: q.kind === "url" ? "url" : "off" });
    const draftId = `interview.${q.id}`;
    bindDraft(box, { slug, id: draftId });
    const grow = () => { if (long) { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 220)}px`; } };
    box.addEventListener("input", grow);
    setTimeout(() => { grow(); box.focus({ preventScroll: true }); }, 0);
    const send = () => (box.value.trim() ? answerText(q, box.value, draftId) : toast("Type something, or tap one of the other choices.", "warn"));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    const readyNow = !handed && st.stop?.good_enough;
    const sendBtn = el(`button.iv__send.${readyNow ? "sw__ghost" : "sw__solid"}`, { type: "button", onclick: send }, "Send");
    return el("div.iv__compose", {},
      el("div.iv__line", {}, box, sendBtn),
      el("div.iv__acts", {}, long ? talkButton(box) : null, ...escapes(q)));
  }

  function ingestComposer(q) {
    const file = (accept, label, note) => {
      const input = el("input.iv__file", { type: "file", accept, id: `iv-file-${accept.replace(/\W/g, "")}` });
      input.addEventListener("change", () => input.files?.[0] && importFile(input.files[0]));
      return el("label.iv__drop", { for: input.id }, el("b", {}, label), el("small", {}, note), input);
    };
    const back = btn({ label: "Back", variant: "quiet", onclick: () => { ingestChoice = ""; paintComposer(); } });
    if (ingestChoice === "linkedin") {
      return el("div.iv__compose", {}, file(".zip", "Choose the LinkedIn zip", "In LinkedIn: Settings, Data privacy, Get a copy of your data. Pick the full archive."), el("div.iv__acts", {}, back));
    }
    if (ingestChoice === "resume") {
      const paste = el("textarea.iv__input", { rows: 4, placeholder: "Or paste your whole resume here." });
      return el("div.iv__compose", {},
        file(".pdf,.docx,.txt,.md", "Choose the file", "PDF, Word or text. We read it; nothing goes on the page until you confirm it."),
        paste,
        el("div.iv__acts", {},
          btn({ label: "Read what I pasted", variant: "solid", disabled: Boolean(busy), onclick: () => (paste.value.trim().length > 40
            ? run("Reading your resume.", (r) => api.importHistory(slug, { resume_version: st.resume_version, text: paste.value, run: r }), WORK.import)
            : toast("Paste the whole resume first.", "warn")) }),
          back));
    }
    return el("div.iv__compose", {}, el("div.iv__chips", {}, (q.options || []).map(([value, label]) =>
      el("button.iv__chip.iv__chip--big", { type: "button", disabled: busy || readOnly() ? true : null, onclick: () => {
        if (value === "type") return run("Starting from what you tell us.", () => turn({ question_id: "ingest", kind: "answer", value }));
        ingestChoice = value;
        api.sendTurn(slug, { version: st.version, question_id: "ingest", kind: "answer", value }).catch(() => null);
        paintComposer();
      } }, label))));
  }

  function paintComposer() {
    const old = root.querySelector("[data-composer]");
    if (old) old.replaceWith(composer());
  }

  function composer() {
    let body;
    if (busy) body = el("p.iv__hint", {}, "One moment.");
    else if (stopping) body = el("div.iv__acts", {},
      el("button.sw__solid", { type: "button", onclick: () => { api.markSession(slug, "end").catch(() => null); location.hash = "#/map"; } }, "Continue later"),
      el("button.sw__ghost", { type: "button", onclick: () => { stopping = false; sittingStart = Date.now(); render(); } }, "Keep going"));
    else if (st.next) body = composerFor(st.next);
    // Every question answered: the way on is the next screen (which writes the resume itself when there is none).
    else body = el("div.iv__acts", {}, options.next
      ? el("button.sw__solid", { type: "button", onclick: () => options.next.go() }, options.next.label)
      : el("button.sw__solid", { type: "button", onclick: () => handOver("write") }, "Write my resume"));
    // Once there's enough, the body owns the solid: the door to the resume sits under the question, no glow.
    const ready = !busy && !stopping && !handed && st.stop?.good_enough && st.next;
    return el("div.iv__composer", { "data-composer": "" }, body,
      ready ? el("div.iv__ready", {}, el("p", {}, "There's enough to write your resume. The rest of the questions make it stronger."),
        el("div.sw__acts", {}, el("button.sw__solid", { type: "button", onclick: () => handOver("write") }, "Write my resume"))) : null);
  }

  /** The assistant's current line: the question (typed out), the stopping recap, or the done note. */
  function currentBubble() {
    if (busy) return workBubble();
    if (stopping) {
      return us("A good place to stop. Everything so far is saved. Here's what we have:", "stop", { stream: true, extra: el("ul.iv__recap", {}, (st.recap || []).map((line) => el("li", {}, line))) });
    }
    const q = st.next;
    if (!q) return us("That's everything we need for now. You can come back and add more any time; every answer makes the resume stronger.", "done", { stream: true });
    const key = `q:${q.id}`;
    const p = el("p.iv__qtext");
    const why = q.why ? el("p.iv__why", { hidden: !revealed.has(key) }, q.why) : null;
    const wrap = el("div.iv__msg.iv__msg--us.iv__msg--q", { "data-key": key }, p, why);
    typeInto(p, q.text, key).then(() => { if (why) why.hidden = false; scrollToEnd(); });
    return wrap;
  }

  /* The margin, on the design language (ops/design-language.md): what we have as a dot list, the door to the
     resume as the one glow once it lights, and the answers behind a quiet link so nothing crowds the talk. */
  let showSlots = false;
  /** The margin, on the sweep of 2026-11-03: one note of what we have (the rows nearest done, three at most)
   * and one quiet door to the answers. The solid lives in the body; nothing here glows or counts. */
  function checklist() {
    const rows = st.checklist || [];
    const order = { known: 0, partial: 1, empty: 2 };
    const shown = [...rows].sort((a, b) => (order[a.state] ?? 2) - (order[b.state] ?? 2)).slice(0, 3);
    const slots = (st.slots || []).filter((v) => v.state !== "empty");
    return el("aside.iv__side.sw__aside", { "aria-label": "What we have", "data-private": "" },
      shown.length ? el("section.sw__note", {},
        el("span.sw__eyebrow", {}, "What we have"),
        el("ul.iv__check", {}, shown.map((r) => el(`li.iv__row.is-${r.state}`, {}, el("i.iv__mark", { "aria-hidden": "true" }), el("span", {}, r.label))))) : null,
      slots.length ? el("section.sw__note", {},
        el("p", {}, el("button.sw__quiet", { type: "button", onclick: () => { showSlots = !showSlots; render(); } }, showSlots ? "Hide the answers" : "Change an answer")),
        showSlots ? el("ul.iv__slots", {}, slots.map((v) => el("li", {},
          el("span", {}, `${v.short}: ${v.label}`),
          !handed && !readOnly() ? el("button.iv__change", { type: "button", onclick: () => run("Asking that again.", () => turn({ question_id: `slot:${v.id}`, kind: "reopen" })) }, "Change") : null))) : null) : null);
  }

  /** Step one as the critic specified it: the heading is the thing to do, the object is the resume, the fallbacks
   * are links. Nothing on the screen before the student needs it. */
  function startScreen(q) {
    const fileIn = el("input.iv__file", { type: "file", accept: ".pdf,.docx,.txt,.md", id: "iv-start-file" });
    fileIn.addEventListener("change", () => { if (fileIn.files?.[0]) { pickIngest("resume"); importFile(fileIn.files[0]); } });
    const paste = el("textarea.iv__pastezone", { rows: 4, placeholder: "Drop it here, or paste it.", "aria-label": "Your resume" });
    const readPaste = () => (paste.value.trim().length > 40
      ? (pickIngest("resume"), run("Reading your resume.", (r) => api.importHistory(slug, { resume_version: st.resume_version, text: paste.value, run: r }), WORK.import))
      : toast("Paste the whole resume first.", "warn"));
    const zone = el("div.iv__start.sw__main", {},
      el("h3.sw__move", {}, "Start with your resume."),
      el("p.sw__lead", {}, "PDF or Word. We'll ask about anything it's missing."),
      el("div.iv__dropzone", {}, paste, el("div.iv__dropacts", {},
        el("label.sw__solid", { for: fileIn.id }, "Choose a file"), fileIn,
        el("button.sw__ghost", { type: "button", onclick: readPaste }, "Read what I pasted"))));
    const zip = el("input.iv__file", { type: "file", accept: ".zip", id: "iv-start-zip" });
    zip.addEventListener("change", () => { if (zip.files?.[0]) { pickIngest("linkedin"); importFile(zip.files[0]); } });
    const margin = el("aside.sw__aside", {},
      el("section.sw__note", {}, el("span.sw__eyebrow", {}, "What happens next"),
        el("p.is-first", {}, "We read every line."), el("p", {}, "We ask about what's missing."), el("p", {}, "Your resume is the next screen.")),
      el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Other ways in"),
        el("p", {}, el("button.sw__quiet", { type: "button", onclick: () => run("Starting from what you tell us.", () => turn({ question_id: "ingest", kind: "answer", value: "type" })) }, "No resume yet? Answer questions instead")),
        el("p", {}, el("button.sw__quiet", { type: "button", onclick: () => { ingestChoice = ingestChoice === "linkedin" ? "" : "linkedin"; render(); } }, "Use a LinkedIn data export")),
        ingestChoice === "linkedin" ? el("div.iv__how", {},
          el("p", {}, "On LinkedIn: Settings, then Data privacy, then Get a copy of your data. Pick the full archive. It can take up to a day to arrive."),
          el("label.sw__ghost", { for: zip.id }, "Choose the zip"), zip) : null));
    return el("div.sw__cols", {}, zone, margin);
  }
  /** Tell the record which way in was chosen, once, without waiting on it. */
  function pickIngest(value) {
    if (ingestChoice === value) return;
    ingestChoice = value;
    api.sendTurn(slug, { version: st.version, question_id: "ingest", kind: "answer", value }).catch(() => null);
  }

  function render() {
    if (error && !st) {
      mount(root, el("div.iv", {}, el("p.rz__empty", {}, error)));
      return;
    }
    if (!st) {
      mount(root, el("div.iv", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening your interview."))));
      return;
    }
    if (handed && builder) {
      mount(root, el("div.iv.iv--builder", {},
        el("p.iv__back", {}, btn({ label: "← Back to the questions", variant: "quiet", onclick: () => { handed = false; render(); } })),
        builder.node));
      return;
    }
    // Nothing said yet and the way in not chosen: the start screen, whose object is the resume.
    const fresh = st.next?.id === "ingest" && !(st.transcript || []).some((t) => t.type === "turn" || t.type === "import");
    if (fresh && !busy) {
      mount(root, el("div.iv.sw.iv--start", {}, startScreen(st.next)));
      return;
    }
    logEl = el("div.iv__log", { "data-private": "", "aria-live": "polite" }, ...transcript(), currentBubble());
    const chat = el("section.iv__chat", { "aria-label": "Your interview" },
      readOnly() ? el("p.rz__readonly", {}, "View only: this is the student's own interview.") : null,
      logEl,
      composer());
    mount(root, el("div.iv.sw", {}, chat, checklist()));
    options.onState?.();
    requestAnimationFrame(() => scrollToEnd());
  }

  render();
  load();
  return {
    node: root,
    /** What the walk reads: is there enough to build, is it done, and has the builder been handed to. */
    state: () => ({ goodEnough: Boolean(st?.stop?.good_enough), done: Boolean(st?.stop?.done), handed }),
    update(next, nextOptions = {}) {
      current = next;
      if (nextOptions.node) node = nextOptions.node;
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        st = null;
        handed = false;
        builder = null;
        load();
        return;
      }
      if (handed && builder) builder.update(next, { ...nextOptions, interview: true });
      // A store change (the map polling) must not restart the typing or drop what's being typed: repaint only the side.
      else if (st) {
        const side = root.querySelector(".iv__side");
        if (side) side.replaceWith(checklist());
      }
    },
  };
}
