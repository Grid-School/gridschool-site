/**
 * Who you are: the first node on every map (server/profile_step.py; ops/student-foundation.md).
 *
 * The same shape as the resume builder: one question at a time on the left, and on the right the card
 * "What we know about you" filling in as they answer. That card is the seeds record (server/seeds.py),
 * the one thing every personal tool reads, so what the student sees is literally what the generators get.
 *
 * Questions come from the intake catalog (data/intake/questions.json, chunks c0, c7, c4) through the same
 * rules the free check uses (which questions apply, in what order). Every answer saves at once through
 * PUT /intake; photos and screenshots go through the images route and their ids are the answer. Nothing
 * is asked twice: an answer from the free check or the resume is already there and is skipped past.
 * Finish: "That's me" marks the node's tasks done and asks the map to re-personalise itself (a map the
 * builder made; a coach's map is left alone), or "Something's off" sends the coach a note.
 */

import { el, mount } from "../dom.js?v=6ba739d-202610272145";
import { btn, toast } from "../ui.js?v=6ba739d-202610272145";
import { nodeRail } from "./node-rail.js?v=6ba739d-202610272145";
import { doneIds } from "../steps.js?v=6ba739d-202610272145";
import { nextUp } from "../graph/model.js?v=6ba739d-202610272145";
import { isProgressReadOnly } from "../store.js?v=6ba739d-202610272145";
import * as A from "../answer-chunk.js?v=6ba739d-202610272145";
import * as I from "../../../data/intake/intake.mjs?v=6ba739d-202610272145";
import { control } from "./answer.js?v=6ba739d-202610272145";
import { filePayload } from "./images.js?v=6ba739d-202610272145";
import { intakeReady, loadIntake, saveChunk, rebuildMap, loadSeeds } from "../intake-remote.js?v=6ba739d-202610272145";
import { imagesReady, loadImages, uploadImage, removeImage, imageUrl } from "../images-remote.js?v=6ba739d-202610272145";

/* The stages, each a few questions from one chunk. Upload questions name the images kind they go to.
   A question stage is done when every question it asks now is answered or skipped; Finish is done when
   the student said "That's me" (steps.js draws them). */
const answeredAll = (id) => (snap) => snap.stageDone(id);
const STAGES = [
  { id: "you", label: "You", chunk: "c0", ids: ["stage", "role", "level", "months", "apps", "stop"], done: answeredAll("you") },
  { id: "into", label: "Into", chunk: "c7", ids: ["techInterests", "personalInterests"], done: answeredAll("into") },
  { id: "taste", label: "Taste", chunk: "c7", ids: ["styleWords", "styleRefs", "styleShots"], done: answeredAll("taste") },
  { id: "voice", label: "Voice", chunk: "c7", ids: ["voiceSample"], done: answeredAll("voice") },
  { id: "linkedin", label: "LinkedIn", chunk: "c4", ids: ["linkedin", "photo", "banner", "headshot", "facePhotos", "inbound"], done: answeredAll("linkedin") },
  { id: "finish", label: "Finish", done: (snap) => snap.nodeDone },
];
const UPLOAD_KIND = { styleShots: "style", photo: "photo_current", banner: "banner_current", facePhotos: "face" };
const TASKS = { you: "b.profile.you", linkedin: "b.profile.linkedin" };

let catalogPromise = null;
function loadCatalog() {
  catalogPromise ??= fetch(new URL("../../../data/intake/questions.json", import.meta.url), { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error("The questions didn't load.");
    return res.json();
  });
  return catalogPromise;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ellipsis = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || "");

export function renderProfile(ctx, options = {}) {
  const embedded = Boolean(options.embedded);
  let node = options.node || null;
  const root = el("div.view.view--resume.view--profile");
  let current = ctx;
  let slug = ctx.state.slug;
  let catalog = null;
  let state = I.emptyState();
  let seeds = null;
  let images = null;
  let stage = null;
  let busy = "";
  let reporting = false;
  let error = "";
  let draft = ""; // what's typed for the current question, kept across repaints

  const readOnly = () => isProgressReadOnly();
  const taskDone = (id) => current.state.student?.tasks?.[id]?.state === "done";
  const nodeDone = () => Boolean(node) && Object.values(TASKS).every(taskDone);

  function questionsOf(st) {
    if (!st.chunk) return [];
    return A.askedNow(catalog, st.chunk, state).filter((q) => st.ids.includes(q.id));
  }
  const settled = (q) => I.isSettled(state, q.id);
  const stageDone = (st) => st.chunk && questionsOf(st).every(settled);
  const openQuestion = (st) => questionsOf(st).find((q) => !settled(q)) ?? null;

  /* What the node's two tasks mean, so they tick themselves. */
  const youDone = () => Boolean(seeds?.complete?.target && seeds?.complete?.interests && seeds?.complete?.taste && seeds?.complete?.voice);
  const linkedinDone = () => Boolean(catalog) && stageDone(STAGES.find((s) => s.id === "linkedin"));

  async function load() {
    if (!intakeReady() || slug === "demo") {
      error = "Sign in to tell us who you are. Your answers are saved to your account.";
      return render();
    }
    try {
      const [cat, intake, sd, im] = await Promise.all([loadCatalog(), loadIntake(slug), loadSeeds(slug).catch(() => null), imagesReady() ? loadImages(slug).catch(() => null) : null]);
      catalog = cat;
      state = A.seatState(intake);
      seeds = sd?.seeds ?? sd; // GET /seeds answers {seeds: {...}}
      images = im;
      error = "";
    } catch (e) {
      error = e.message;
    }
    render();
  }

  async function refreshSeeds() {
    try {
      const out = await loadSeeds(slug);
      seeds = out?.seeds ?? out;
    } catch {
      /* the card keeps what it had */
    }
  }

  /** The body of PUT /intake for one chunk: everything answered so far, the rest skipped, done when nothing is open. */
  function payload(chunk) {
    const asked = A.askedNow(catalog, chunk, state);
    const answers = {};
    const skipped = [];
    for (const q of asked) {
      if (I.isAnswered(state, q.id)) answers[q.id] = state.answers[q.id];
      else if (state.skipped.includes(q.id)) skipped.push(q.id);
    }
    return { chunk, answers, skipped, done: asked.every((q) => I.isSettled(state, q.id)) };
  }

  async function persist(chunk, label = "Saving.") {
    if (readOnly()) {
      toast("View only: these are the student's own answers.", "warn");
      return false;
    }
    busy = label;
    render();
    try {
      await saveChunk(slug, payload(chunk));
      await refreshSeeds();
      return true;
    } catch (e) {
      toast(e.message, "warn", { ms: 6000 });
      return false;
    } finally {
      busy = "";
      render();
    }
  }

  async function answer(st, q, raw) {
    const next = A.setAnswer(state, q, raw);
    if (!I.isAnswered(next, q.id)) return toast("Type an answer, or press Skip.", "warn");
    state = next;
    draft = "";
    await persist(st.chunk);
  }

  async function skip(st, q) {
    state = I.skip(state, q.id);
    draft = "";
    await persist(st.chunk, "Skipping.");
  }

  async function upload(st, q, file) {
    const kind = UPLOAD_KIND[q.id];
    if (!kind) return;
    const have = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
    if (have.length >= (q.max || 1)) return toast(`That's ${q.max || 1} already. Remove one to add another.`, "warn");
    busy = "Adding the image.";
    render();
    try {
      const out = await uploadImage(slug, kind, await filePayload(file));
      images = out;
      // One-per-kind uploads replace the old one on the server, so the answer holds only the new id.
      const ids = kind === "face" || kind === "style" ? [...have, out.id] : [out.id];
      state = I.answer(state, q.id, ids);
      await saveChunk(slug, payload(st.chunk));
      await refreshSeeds();
    } catch (e) {
      toast(e.message, "warn", { ms: 7000 });
    } finally {
      busy = "";
      render();
    }
  }

  async function remove(st, q, id) {
    busy = "Removing.";
    render();
    try {
      images = await removeImage(slug, id);
      const ids = (state.answers[q.id] || []).filter((x) => x !== id);
      state = ids.length ? I.answer(state, q.id, ids) : A.setAnswer(state, q, "");
      await saveChunk(slug, payload(st.chunk));
      await refreshSeeds();
    } catch (e) {
      toast(e.message, "warn");
    } finally {
      busy = "";
      render();
    }
  }

  function thumb(id, cls = "pf__thumb") {
    const img = el(`img.${cls}`, { alt: "", loading: "lazy" });
    imageUrl(slug, id).then((url) => { img.src = url; }).catch(() => img.classList.add("is-broken"));
    return img;
  }

  const go = (id) => {
    stage = id;
    reporting = false;
    draft = "";
    render();
    root.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };

  function autoStage() {
    for (const st of STAGES) {
      if (st.chunk && openQuestion(st)) return st.id;
    }
    return embedded ? "finish" : "linkedin";
  }

  const doneStages = () =>
    catalog ? doneIds(STAGES, { stageDone: (id) => Boolean(stageDone(STAGES.find((s) => s.id === id))), nodeDone: nodeDone() }) : [];

  function stageCard(title, now, body, next) {
    return [el("header.rz__stagehead", {}, el("h2", {}, title), now ? el("p.rz__now", {}, now) : null), body, next ? el("div.rz__next", {}, next) : null];
  }

  /* ---------- one question ---------- */
  function questionBody(st) {
    const asked = questionsOf(st);
    const q = openQuestion(st);
    const n = asked.findIndex((x) => x === q) + 1;
    if (!q) {
      const after = STAGES[STAGES.findIndex((s) => s.id === st.id) + 1];
      const lines = asked.map((x) => el("li", {}, el("b", {}, x.prompt), " ", el("span.rz__muted", {}, A.answerLine(x, state.answers[x.id]))));
      return stageCard(`${st.label}: done`, "Change any answer by clicking it.", el("ul.pf__answers", {}, lines.map((li, i) => {
        li.addEventListener("click", () => { state = I.skip(state, asked[i].id); state.skipped = state.skipped.filter((id) => id !== asked[i].id); draft = ""; render(); });
        return li;
      })), after ? btn({ label: `${after.label} →`, variant: "solid", onclick: () => go(after.id) }) : null);
    }
    const isUpload = q.kind === "upload";
    let input;
    if (isUpload) {
      const ids = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
      const file = el("input", { type: "file", accept: (q.accept || ["image/png", "image/jpeg"]).join(","), class: "rz__file" });
      file.addEventListener("change", () => file.files?.[0] && upload(st, q, file.files[0]));
      input = el("div.pf__upload", {},
        ids.length ? el("div.pf__thumbs", {}, ids.map((id) => el("div.pf__thumbwrap", {}, thumb(id), btn({ label: "Remove", variant: "quiet", onclick: () => remove(st, q, id) })))) : null,
        ids.length < (q.max || 1) ? el("label.rz__drop", {}, el("b", {}, ids.length ? "Add another" : "Choose an image"), el("span", {}, `JPEG, PNG or WebP${q.max > 1 ? ` · up to ${q.max}` : ""}`), file) : null);
    } else {
      const raw = draft || A.toInput(q, state.answers[q.id]);
      input = control(q, draft || state.answers[q.id], {
        onInput: (value) => { draft = value; },
        onPick: (value) => answer(st, q, value), // a choice saves on the tap: one thing, one touch
      });
      if (q.kind === "text" || q.kind === "links") {
        setTimeout(() => {
          const box = input.matches?.("input, textarea") ? input : input.querySelector?.("input, textarea");
          box?.focus({ preventScroll: true });
          box?.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey || box.tagName === "INPUT")) answer(st, q, draft || raw); });
        }, 0);
      }
    }
    const saveLabel = isUpload ? (Array.isArray(state.answers[q.id]) && state.answers[q.id].length ? "That's all of them" : null) : q.kind === "choice" ? null : "Save answer";
    return stageCard(
      `${st.label} · question ${n} of ${asked.length}`,
      null,
      [
        el("div.rz__q", {}, el("p.rz__qtext", {}, q.prompt), q.help ? el("p.rz__why", {}, q.help) : null),
        input,
        state.sources?.[q.id] === "resume" ? el("p.rz__hint", {}, "Filled in from your resume. Change it if it's wrong.") : null,
      ],
      [
        saveLabel ? btn({ label: busy ? "Saving…" : saveLabel, variant: "solid", disabled: Boolean(busy), onclick: () => (isUpload ? skipUploadDone(st, q) : answer(st, q, draft || A.toInput(q, state.answers[q.id]))) }) : null,
        btn({ label: isUpload && !(state.answers[q.id] || []).length ? "I don't have one" : "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => skip(st, q) }),
      ]
    );
  }

  /** An upload question with at least one image is answered; moving on just re-renders to the next. */
  function skipUploadDone(st, q) {
    draft = "";
    render();
  }

  /* ---------- finish ---------- */
  function finishBody() {
    const next = nodeDone() ? nextUp(current.state.graph) : null;
    const checks = [
      ["Your target, what you're into, your taste and your voice", youDone(), "you"],
      ["Your LinkedIn as it is today", linkedinDone(), "linkedin"],
    ];
    const ready = checks.every(([, ok]) => ok);
    const list = el("ul.rz__checks", {}, checks.map(([label, ok, id]) =>
      el(`li${ok ? ".is-ok" : ""}`, {}, el("span.rz__tick", { "aria-hidden": "true" }, ok ? "✓" : "○"), label, ok ? null : btn({ label: "Go there", variant: "quiet", onclick: () => go(id) }))));
    if (nodeDone()) {
      return stageCard("This step is done", "Everything we make for you now starts from your card. You can change any answer any time.", list,
        next && next.id !== node?.id ? btn({ label: `Next step: ${next.title} →`, variant: "solid", onclick: () => current.navigate("map", next.id) }) : btn({ label: "Back to your map", variant: "solid", onclick: () => current.navigate("map") }));
    }
    if (reporting) {
      const box = el("textarea.rz__text", { rows: 4, placeholder: "What's off? For example: \"It has my target wrong\" or \"I couldn't add my banner\"." });
      setTimeout(() => box.focus(), 0);
      const send = async () => {
        const text = box.value.trim();
        if (!text) return toast("Say what's off in a sentence or two.", "warn");
        current.store.askAboutStep?.({ nodeId: node.id, title: node.title, text });
        reporting = false;
        toast("Sent to your coach. Your answers are saved as they are.", "ok", { ms: 6000 });
        render();
      };
      return stageCard("Tell your coach what's off", "They see your answers and will help on your next call.", box,
        [btn({ label: "Send to my coach", variant: "solid", onclick: send }), btn({ label: "Cancel", variant: "quiet", onclick: () => { reporting = false; render(); } })]);
    }
    return stageCard(
      ready ? "Is this you?" : "Almost there",
      ready ? "Read your card once more. If it's you, finish this step." : "Finish the parts below first. Each one checks itself.",
      list,
      ready
        ? [
            btn({ label: "That's me. Finish this step", variant: "solid", disabled: Boolean(busy) || readOnly(),
              onclick: async () => {
                Object.values(TASKS).forEach((id) => current.store.setTaskState(id, "done"));
                toast("Done. Everything we make for you now starts from this.", "ok");
                render();
                try {
                  const out = await rebuildMap(slug);
                  if (out?.published) toast("Your map just updated itself from your answers.", "ok", { ms: 5000 });
                } catch (e) {
                  if (e.status !== 409) toast(e.message, "warn"); // 409: a map the coach keeps by hand, left alone
                }
              } }),
            btn({ label: "Something's off", variant: "ghost", onclick: () => { reporting = true; render(); } }),
          ]
        : null
    );
  }

  /* ---------- the card: what we know about you ---------- */
  function card() {
    const s = seeds || {};
    const t = s.target || {};
    const row = (label, value, stageId) => {
      const empty = !value || (Array.isArray(value) && !value.length);
      return el(`div.pf__row${empty ? ".is-empty" : ""}`, {},
        el("b", {}, label),
        empty ? el("span.rz__muted", {}, stageId ? el("button.pf__fill", { type: "button", onclick: () => go(stageId) }, "not yet") : "not yet") : el("span", {}, Array.isArray(value) ? value.join(", ") : value));
    };
    const shots = (s.taste?.shots || []).filter(Boolean);
    const link = Array.isArray(state.answers.linkedin) ? state.answers.linkedin[0] : "";
    const photo = (state.answers.photo || [])[0];
    const banner = (state.answers.banner || [])[0];
    return el("div.pf__card", {},
      el("b.eyebrow", {}, "What we know about you"),
      el("p.rz__muted.pf__lead", {}, "Every tool reads this card: your banner, your post drafts, your project ideas, the roles we find."),
      el("h3.pf__h", {}, "Target"),
      row("Aiming at", t.titles, "you"),
      row("Level", t.level, "you"),
      el("h3.pf__h", {}, "Into"),
      row("At work", s.interests?.technical, "into"),
      row("Outside work", s.interests?.personal, "into"),
      el("h3.pf__h", {}, "Taste"),
      row("In words", s.taste?.words, "taste"),
      row("Whose style", s.taste?.references, "taste"),
      shots.length ? el("div.pf__thumbs.pf__thumbs--small", {}, shots.map((id) => thumb(id, "pf__thumb pf__thumb--small"))) : row("Looks you like", null, "taste"),
      el("h3.pf__h", {}, "Voice"),
      s.voice?.sample ? el("blockquote.pf__voice", {}, ellipsis(s.voice.sample, 220)) : row("How you write", null, "voice"),
      el("h3.pf__h", {}, "LinkedIn today"),
      row("Profile", link ? ellipsis(link, 48) : null, "linkedin"),
      photo || banner
        ? el("div.pf__thumbs.pf__thumbs--small", {}, [photo && thumb(photo, "pf__thumb pf__thumb--small pf__thumb--round"), banner && thumb(banner, "pf__thumb pf__thumb--wide")])
        : row("Photo and banner", null, "linkedin"),
      s.proof?.length ? el("p.rz__muted", {}, `Plus ${plural(s.proof.length, "confirmed resume line")}.`) : null);
  }

  function render() {
    if (error && !catalog) {
      mount(root, el("div.rz", {}, el("p.rz__empty", {}, error)));
      return;
    }
    if (!catalog) {
      mount(root, el("div.rz", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening."))));
      return;
    }
    const valid = STAGES.map((s) => s.id);
    const here = valid.includes(stage) ? stage : autoStage();
    const st = STAGES.find((s) => s.id === here);
    const body = here === "finish" ? finishBody() : questionBody(st);
    const answered = STAGES.filter((s) => s.chunk).reduce((sum, s) => sum + questionsOf(s).filter((q) => I.isAnswered(state, q.id)).length, 0);
    const total = STAGES.filter((s) => s.chunk).reduce((sum, s) => sum + questionsOf(s).length, 0);
    const head = embedded
      ? el("header.rz__head.rz__head--embedded", {}, el("p.rz__meta", {}, `${answered} of ${plural(total, "question")} answered · skip any you like`))
      : el("header.rz__head", {},
          el("div", {}, el("b.eyebrow", {}, "Who you are"), el("h1.rz__title", {}, "Tell us who you are, one question at a time")),
          el("p.rz__meta", {}, `${answered} of ${plural(total, "question")} answered`),
          btn({ label: "← Map", variant: "quiet", onclick: () => current.navigate("map") }));
    const main = el("section.rz__main", {},
      nodeRail({ nodes: embedded ? STAGES : STAGES.filter((s) => s.id !== "finish"), done: doneStages(), here, onGo: go, label: "Who you are" }),
      readOnly() ? el("p.rz__readonly", {}, "View only: these are the student's own answers.") : null,
      el("div.rz__card", { "aria-busy": busy ? "true" : null }, busy ? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body));
    const aside = el("aside.rz__preview", { "aria-label": "What we know about you" }, card());
    mount(root, el(`div.rz${embedded ? ".rz--embedded" : ""}`, {}, head, el("div.rz__grid", {}, main, aside)));
  }

  render();
  load();
  return {
    node: root,
    update(next, nextOptions = {}) {
      current = next;
      if (nextOptions.node) node = nextOptions.node;
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        catalog = null;
        load();
      } else if (catalog) {
        render();
      }
    },
  };
}
