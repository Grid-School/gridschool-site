/**
 * Who you are: the first node on every map (server/profile_step.py; ops/student-foundation.md).
 *
 * The same shape as the resume builder: one question at a time on the left, and on the right the card
 * "What we know about you" filling in as they answer. That card is the seeds record (server/seeds.py),
 * the one thing every personal tool reads, so what the student sees is literally what the generators get.
 *
 * Questions come from the intake catalog (data/intake/questions.json, chunks c0, c7, c4) through the same
 * rules the free check uses (which questions apply, in what order). Every answer saves at once through
 * PUT /intake; photos and screenshots go through the images route, which keeps their answer in step with
 * what's stored. Nothing is asked twice: an answer from the free check or the resume is already there and
 * is skipped past.
 *
 * Changing your mind (2026-10-30, a student couldn't add a second style screenshot or change one):
 * - Back works across the whole step, question by question, and every answer can be opened and changed.
 * - An upload question takes as many images as it says, picked together or dropped in, with a count, and
 *   every image has Replace and Remove. The question stays open until they say they're done.
 * - What a change leaves out of date is said, never silently remade (server/profile_deps.py): the card
 *   updates at once; a map the app builds updates itself once the step is done (no AI, nothing lost);
 *   banners, headshots, the LinkedIn draft, project ideas and the voice doc cost AI, so they're marked
 *   "made before this change" with one click to make them again.
 * The pure part (moving, upload rules, stale lines) is ../profile-flow.js.
 *
 * Finish: "That's me" marks the node's tasks done and asks the map to re-personalise itself (a map the
 * builder made; a coach's map is left alone), or "Something's off" sends the coach a note.
 */

import { el, mount } from "../dom.js?v=c7fe5aa-202610310430";
import { btn, toast } from "../ui.js?v=c7fe5aa-202610310430";
import { nodeRail } from "./node-rail.js?v=c7fe5aa-202610310430";
import { doneIds } from "../steps.js?v=c7fe5aa-202610310430";
import { nextUp } from "../graph/model.js?v=c7fe5aa-202610310430";
import { isProgressReadOnly } from "../store.js?v=c7fe5aa-202610310430";
import * as A from "../answer-chunk.js?v=c7fe5aa-202610310430";
import * as I from "../../../data/intake/intake.mjs?v=c7fe5aa-202610310430";
import * as F from "../profile-flow.js?v=c7fe5aa-202610310430";
import { control } from "./answer.js?v=c7fe5aa-202610310430";
import { filePayload } from "./images.js?v=c7fe5aa-202610310430";
import { readDraft, writeDraft, clearDraft } from "../drafts.js?v=c7fe5aa-202610310430";
import { intakeReady, loadIntake, saveChunk, rebuildMap, loadSeeds } from "../intake-remote.js?v=c7fe5aa-202610310430";
import { imagesReady, loadImages, uploadImage, removeImage, imageUrl, makeImages } from "../images-remote.js?v=c7fe5aa-202610310430";
import { draftPositioning } from "../roles-remote.js?v=c7fe5aa-202610310430";
import { loadStudio, makeProjects, buildVoice } from "../studio-remote.js?v=c7fe5aa-202610310430";

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
const DRAFT = (qid) => `profile.${qid}`;
const DISMISS_KEY = (slug) => `gridschool.stale.v1.${slug}`;

let catalogPromise = null;
function loadCatalog() {
  catalogPromise ??= fetch(new URL("../../../data/intake/questions.json", import.meta.url), { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error("The questions didn't load. Reload the page to try again.");
    return res.json();
  });
  return catalogPromise;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ellipsis = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || "");
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function readDismissed(slug) {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY(slug)) || "{}") || {};
  } catch {
    return {};
  }
}
function writeDismissed(slug, value) {
  try {
    localStorage.setItem(DISMISS_KEY(slug), JSON.stringify(value));
  } catch {
    /* storage unavailable: it shows again next visit */
  }
}

export function renderProfile(ctx, options = {}) {
  const embedded = Boolean(options.embedded);
  let node = options.node || null;
  const root = el("div.view.view--resume.view--profile");
  let current = ctx;
  let slug = ctx.state.slug;
  let catalog = null;
  let state = I.emptyState();
  let seeds = null;
  let stale = [];
  let dismissed = readDismissed(slug);
  let images = null;
  let stage = null;
  let cursor = null; // {stage, q}: a question opened on purpose (Back, Change, an upload in progress)
  let busy = "";
  let reporting = false;
  let error = "";
  let cardNote = ""; // "Updated from your answer", for one render after a change
  let mapNote = ""; // what happened to the map after a change, when the step is done
  let mapPending = false; // the map should update but couldn't just now
  const drafts = {}; // what's typed per question, kept across repaints, Back and reloads

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
  const flow = () => F.flowOf(STAGES, questionsOf);
  const stageOf = (id) => STAGES.find((s) => s.id === id);
  const questionOf = (id) => catalog.questions.find((q) => q.id === id);

  /* What the node's two tasks mean, so they tick themselves. */
  const youDone = () => Boolean(seeds?.complete?.target && seeds?.complete?.interests && seeds?.complete?.taste && seeds?.complete?.voice);
  const linkedinDone = () => Boolean(catalog) && stageDone(stageOf("linkedin"));

  async function load() {
    if (!intakeReady() || slug === "demo") {
      error = "Sign in to tell us who you are. Your answers are saved to your account.";
      return render();
    }
    try {
      const [cat, intake, sd, im] = await Promise.all([loadCatalog(), loadIntake(slug), loadSeeds(slug).catch(() => null), imagesReady() ? loadImages(slug).catch(() => null) : null]);
      catalog = cat;
      state = A.seatState(intake);
      takeSeeds(sd);
      images = im;
      error = "";
    } catch (e) {
      error = e.message;
    }
    render();
  }

  function takeSeeds(out) {
    seeds = out?.seeds ?? out; // GET /seeds answers {seeds: {...}, stale: [...]}
    stale = Array.isArray(out?.stale) ? out.stale : stale;
  }

  async function refreshSeeds() {
    try {
      takeSeeds(await loadSeeds(slug));
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

  function refuseReadOnly() {
    if (!readOnly()) return false;
    toast("View only: these are the student's own answers.", "warn");
    return true;
  }

  async function persist(chunk, label = "Saving.") {
    if (refuseReadOnly()) return false;
    busy = label;
    render();
    try {
      await saveChunk(slug, payload(chunk));
      await refreshSeeds();
      return true;
    } catch (e) {
      toast(`${e.message} Your answer is still here; try Save again.`, "warn", { ms: 6000 });
      return false;
    } finally {
      busy = "";
      render();
    }
  }

  /**
   * After an answer really changed: the card is already fresh (say so), and a map the app builds follows the
   * answers it's built from, once the step is done. Before that, "That's me" builds it.
   */
  async function afterChange(qids) {
    cardNote = "Updated from your answer.";
    if (!nodeDone() || !qids.some(F.touchesMap)) return;
    await updateMap(false);
  }

  async function updateMap(asked) {
    try {
      const out = await rebuildMap(slug);
      mapPending = false;
      mapNote = out?.status === "published" ? "Your map updated itself from your new answer. Your progress is kept." : asked ? "Your map already fits your answers." : "";
    } catch (e) {
      if (e.status === 409 || e.status === 403) {
        mapPending = false;
        mapNote = "Your coach keeps your map up to date by hand, so they'll see this change.";
      } else {
        mapPending = true;
        mapNote = "";
        if (asked) toast(e.message, "warn");
      }
    }
    render();
  }

  async function answer(st, q, raw) {
    const next = A.setAnswer(state, q, raw);
    if (!I.isAnswered(next, q.id)) return toast("Type an answer, or press Skip.", "warn");
    const before = state;
    const changed = !same(before.answers[q.id], next.answers[q.id]) || before.skipped.includes(q.id);
    state = next;
    // A save the server refused stays on this question with what was typed: moving on would show an answer
    // as saved that isn't, and the step could never finish.
    if (!(await persist(st.chunk))) {
      state = before;
      return render();
    }
    delete drafts[q.id];
    clearDraft(slug, DRAFT(q.id));
    cursor = null; // on to the next open question here, or this part's summary
    if (changed) await afterChange([q.id]);
    render();
  }

  async function skip(st, q) {
    const before = state;
    state = I.skip(state, q.id);
    if (!(await persist(st.chunk, "Skipping."))) {
      state = before;
      return render();
    }
    delete drafts[q.id];
    clearDraft(slug, DRAFT(q.id));
    cursor = null;
    if (I.isAnswered(before, q.id)) await afterChange([q.id]);
    render();
  }

  /* ---------- uploads: several at once, replace in place, remove ---------- */

  /** What the server says the question holds now (images_api.sync_answer), into the page's state. */
  function takeAnswer(q, out) {
    images = out;
    const ids = out?.answer?.question === q.id ? out.answer.ids : null;
    if (!ids) return;
    if (ids.length) state = I.answer(state, q.id, ids);
    else state = A.setAnswer(state, q, "");
  }

  const idsOf = (q) => (Array.isArray(state.answers[q.id]) ? state.answers[q.id] : []);

  async function addFiles(st, q, files) {
    const kind = UPLOAD_KIND[q.id];
    if (!kind || refuseReadOnly() || busy) return;
    const list = Array.from(files || []);
    const notImages = list.filter((f) => !F.isImageFile(f));
    const plan = F.planAdd(idsOf(q).length, list.filter(F.isImageFile), q);
    const failed = notImages.length ? [`${notImages[0].name || "That file"} isn't an image. Use ${F.formatsOf(q)}.`] : [];
    if (!plan.take.length) {
      return toast(failed[0] || F.addedLine({ added: 0, left: plan.left }, q), "warn", { ms: 7000 });
    }
    const before = idsOf(q);
    let added = 0;
    cursor = { stage: st.id, q: q.id }; // stay here until they say they're done
    for (const [i, file] of plan.take.entries()) {
      busy = plan.take.length > 1 ? `Adding image ${i + 1} of ${plan.take.length}.` : "Adding the image.";
      render();
      try {
        takeAnswer(q, await uploadImage(slug, kind, await filePayload(file)));
        added += 1;
      } catch (e) {
        failed.push(e.message);
      }
    }
    busy = "";
    await refreshSeeds();
    if (!same(before, idsOf(q))) await afterChange([q.id]);
    const line = F.addedLine({ added, left: plan.left, failed }, q);
    if (line) toast(line, failed.length || plan.left ? "warn" : "ok", { ms: failed.length || plan.left ? 8000 : 3000 });
    render();
  }

  async function replace(st, q, oldId, file) {
    const kind = UPLOAD_KIND[q.id];
    if (!kind || !file || refuseReadOnly() || busy) return;
    if (!F.isImageFile(file)) return toast(`That isn't an image. Use ${F.formatsOf(q)}.`, "warn");
    cursor = { stage: st.id, q: q.id };
    busy = "Replacing the image.";
    render();
    try {
      // One-image kinds replace on the server by themselves; the others swap this one, in its place.
      takeAnswer(q, await uploadImage(slug, kind, await filePayload(file), F.maxOf(q) > 1 ? oldId : null));
      await refreshSeeds();
      await afterChange([q.id]);
      toast("Replaced.", "ok");
    } catch (e) {
      toast(`${e.message} Your old image is still there.`, "warn", { ms: 7000 });
    } finally {
      busy = "";
      render();
    }
  }

  async function remove(st, q, id) {
    if (refuseReadOnly() || busy) return;
    cursor = { stage: st.id, q: q.id };
    busy = "Removing.";
    render();
    try {
      takeAnswer(q, await removeImage(slug, id));
      await refreshSeeds();
      await afterChange([q.id]);
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

  /** A file input, hidden inside a label that looks like a button or a drop area. */
  function filePicker(q, { multiple, onFiles }) {
    const input = el("input.rz__file", { type: "file", accept: (q.accept || ["image/jpeg", "image/png", "image/webp"]).filter((t) => t.startsWith("image/")).join(","), multiple: multiple || null });
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      input.value = ""; // the same file can be picked again after a remove
      if (files.length) onFiles(files);
    });
    return input;
  }

  function uploadInput(st, q) {
    const ids = idsOf(q);
    const max = F.maxOf(q);
    const full = ids.length >= max;
    const disabled = Boolean(busy) || readOnly();
    const tiles = ids.map((id, i) =>
      el("figure.pf__thumbwrap", {},
        thumb(id),
        el("figcaption.rz__muted", {}, max > 1 ? `Image ${i + 1}` : "Your image"),
        el("div.pf__thumbacts", {},
          el("label.b.b--quiet.pf__replace", { "aria-disabled": disabled ? "true" : null }, "Replace",
            filePicker(q, { multiple: false, onFiles: (files) => replace(st, q, id, files[0]) })),
          btn({ label: "Remove", variant: "quiet", disabled, onclick: () => remove(st, q, id) }))));
    let drop = null;
    if (!full) {
      const room = max - ids.length;
      drop = el("label.rz__drop", {},
        el("b", {}, ids.length ? (room > 1 ? `Add more (up to ${room} more)` : "Add one more") : max > 1 ? `Choose images (up to ${max})` : "Choose an image"),
        el("span", {}, max > 1 ? "Or drop them here. You can pick several at once." : "Or drop it here."),
        filePicker(q, { multiple: max > 1, onFiles: (files) => addFiles(st, q, files) }));
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
      drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
      drop.addEventListener("drop", (e) => {
        e.preventDefault();
        drop.classList.remove("is-over");
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) addFiles(st, q, files);
      });
    }
    const count = F.countLine(ids.length, q);
    return el("div.pf__upload", {},
      el("p.rz__hint.pf__rule", {}, F.uploadRule(q)),
      ids.length ? el("div.pf__thumbs", {}, tiles) : null,
      count ? el("p.rz__muted.pf__count", { "aria-live": "polite" }, count) : null,
      drop);
  }

  /* ---------- moving ---------- */

  function go(id) {
    stage = id;
    cursor = null;
    reporting = false;
    render();
    root.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  function open(target) {
    if (!target) return;
    stage = target.stage;
    cursor = target.q ? { stage: target.stage, q: target.q } : null;
    reporting = false;
    render();
    root.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  function autoStage() {
    for (const st of STAGES) {
      if (st.chunk && openQuestion(st)) return st.id;
    }
    return embedded ? "finish" : "linkedin";
  }

  /** Where they are now: {stage, q} on a question, {stage} on a summary, {stage: "finish"}. */
  function hereNow() {
    const here = STAGES.some((s) => s.id === stage) ? stage : autoStage();
    if (here === "finish") return { stage: "finish" };
    const st = stageOf(here);
    const q = shownQuestion(st);
    return q ? { stage: here, q: q.id } : { stage: here };
  }

  function shownQuestion(st) {
    const asked = questionsOf(st);
    const pinned = cursor && cursor.stage === st.id ? asked.find((q) => q.id === cursor.q) : null;
    return pinned || openQuestion(st);
  }

  const backButton = () => {
    const target = F.backFrom(flow(), hereNow(), STAGES.map((s) => s.id));
    return target ? btn({ label: "← Back", variant: "quiet", disabled: Boolean(busy), onclick: () => open(target) }) : null;
  };

  const doneStages = () =>
    catalog ? doneIds(STAGES, { stageDone: (id) => Boolean(stageDone(stageOf(id))), nodeDone: nodeDone() }) : [];

  function stageCard(title, now, body, next) {
    return [el("header.rz__stagehead", {}, el("h2", {}, title), now ? el("p.rz__now", {}, now) : null), body, next ? el("div.rz__next", {}, next) : null];
  }

  /* ---------- one question, or a part's answers ---------- */
  function questionBody(st) {
    const asked = questionsOf(st);
    const q = shownQuestion(st);
    if (!q) return summaryBody(st, asked);
    const n = asked.findIndex((x) => x === q) + 1;
    const isUpload = q.kind === "upload";
    const answered = I.isAnswered(state, q.id);
    let input;
    let saveLabel = null;
    let primary = null;
    if (isUpload) {
      input = uploadInput(st, q);
      if (idsOf(q).length) primary = () => { cursor = null; render(); };
      saveLabel = idsOf(q).length ? "Done, next question" : null;
    } else {
      // What's typed and not saved beats the saved answer: this visit's, else this device's from before a reload.
      const saved = A.toInput(q, state.answers[q.id]);
      if (drafts[q.id] === undefined && typeof saved === "string" && q.kind !== "choice") {
        const stored = readDraft(slug, DRAFT(q.id));
        if (stored !== null) drafts[q.id] = stored;
      }
      input = control(q, drafts[q.id] ?? state.answers[q.id], {
        onInput: (v) => {
          drafts[q.id] = v;
          if (typeof v === "string") writeDraft(slug, DRAFT(q.id), v === saved ? "" : v);
        },
        // A choice saves on the tap: one thing, one touch. Tapping the one already picked keeps it.
        onPick: (v) => (v === "" && answered ? (cursor = null, render()) : answer(st, q, v)),
      });
      if (q.kind === "text" || q.kind === "links" || q.kind === "number") {
        setTimeout(() => {
          const box = input.matches?.("input, textarea") ? input : input.querySelector?.("input, textarea");
          box?.focus({ preventScroll: true });
          box?.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey || box.tagName === "INPUT")) answer(st, q, drafts[q.id] ?? saved); });
        }, 0);
      }
      if (q.kind !== "choice") {
        saveLabel = answered ? "Save change" : "Save answer";
        primary = () => answer(st, q, drafts[q.id] ?? saved);
      }
    }
    const place = F.placeOf(flow(), { stage: st.id, q: q.id });
    const forward = F.forwardFrom(flow(), { stage: st.id, q: q.id });
    const settledNow = settled(q);
    return stageCard(
      `${st.label} · question ${n} of ${asked.length}`,
      place ? `Question ${place.n} of ${place.total} in this step.${settledNow && !isUpload ? " You answered this already; change it or move on." : ""}` : null,
      [
        el("div.rz__q", {}, el("p.rz__qtext", {}, q.prompt), q.help ? el("p.rz__why", {}, q.help) : null),
        input,
        state.sources?.[q.id] === "resume" ? el("p.rz__hint", {}, "Filled in from your resume. Change it if it's wrong.") : null,
      ],
      [
        backButton(),
        saveLabel ? btn({ label: busy ? "Saving…" : saveLabel, variant: "solid", disabled: Boolean(busy), onclick: primary }) : null,
        settledNow && !isUpload
          ? btn({ label: "Next →", variant: "quiet", disabled: Boolean(busy), onclick: () => (forward ? open(forward) : go(embedded ? "finish" : st.id)) })
          : !idsOf(q).length
            ? btn({ label: isUpload ? (F.maxOf(q) > 1 ? "I don't have any" : "I don't have one") : "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => skip(st, q) })
            : null,
      ]
    );
  }

  /** A part with every question answered or skipped: each answer, and a Change button on each. */
  function summaryBody(st, asked) {
    const after = STAGES[STAGES.findIndex((s) => s.id === st.id) + 1];
    const lines = asked.map((x) => {
      const ids = x.kind === "upload" ? idsOf(x) : [];
      const shown = x.kind === "upload"
        ? ids.length ? el("span.pf__thumbs.pf__thumbs--small", {}, ids.map((id) => thumb(id, "pf__thumb pf__thumb--small"))) : el("span.rz__muted", {}, "Skipped")
        : el("span.rz__muted", {}, A.answerLine(x, state.answers[x.id]));
      return el("li", {},
        el("div.pf__answer", {}, el("b", {}, x.prompt), shown),
        btn({ label: "Change", variant: "quiet", disabled: Boolean(busy), onclick: () => open({ stage: st.id, q: x.id }) }));
    });
    return stageCard(`${st.label}: done`, "Change any answer here. Everything made from it is checked for you.", el("ul.pf__answers", {}, lines),
      [backButton(), after ? btn({ label: `${after.label} →`, variant: "solid", onclick: () => go(after.id) }) : null]);
  }

  /* ---------- what a change left out of date ---------- */

  async function runStale(view) {
    if (refuseReadOnly() || busy) return;
    if (view.do === "open-studio") return current.navigate("studio", "posts");
    if (view.do === "map") return updateMap(true);
    const label = {
      "make-banner": "Making three banners. About a minute.",
      "make-headshot": "Making three headshots. About a minute.",
      position: "Drafting your headline and About.",
      projects: "Writing new project ideas.",
      voice: "Remaking your voice doc.",
    }[view.do];
    busy = label;
    render();
    try {
      if (view.do === "make-banner") await makeImages(slug, "banner");
      else if (view.do === "make-headshot") await makeImages(slug, "headshot");
      else if (view.do === "position") await draftPositioning(slug);
      else if (view.do === "projects") await makeProjects(slug);
      else if (view.do === "voice") {
        const studio = await loadStudio(slug);
        await buildVoice(slug, studio?.studio?.voice?.samples || []);
      }
      await refreshSeeds();
      const where = { "make-banner": "Pick one on your Profile images step.", "make-headshot": "Pick one on your Profile images step.", position: "They're on your Jobs page, under Profile.", projects: "They're in Projects.", voice: "It's in Posts." }[view.do];
      toast(`Done. ${where}`, "ok", { ms: 6000 });
    } catch (e) {
      toast(e.message, "warn", { ms: 8000 });
    } finally {
      busy = "";
      render();
    }
  }

  function staleBox() {
    const items = F.staleToShow(stale, dismissed);
    if (mapPending) items.unshift({ id: "map", text: "Your answers changed after your map was built. Update your map? Your progress is kept.", label: "Update my map", do: "map", costs: false, key: "map" });
    if (!items.length && !mapNote) return null;
    return el("section.pf__stale", { "aria-label": "Made before your change" },
      mapNote ? el("p.pf__stale-note", {}, mapNote) : null,
      items.map((item) =>
        el("div.pf__stale-item", {},
          el("p", {}, item.text, item.costs ? el("span.rz__muted", {}, " Uses this month's allowance.") : null),
          el("div.pf__stale-acts", {},
            btn({ label: item.label, variant: "ghost", disabled: Boolean(busy) || readOnly(), onclick: () => runStale(item) }),
            item.id === "map" ? null : btn({ label: "Not now", variant: "quiet", onclick: () => { dismissed = { ...dismissed, [item.id]: item.key }; writeDismissed(slug, dismissed); render(); } })))));
  }

  /* ---------- finish ---------- */
  function finishBody() {
    const next = nodeDone() ? nextUp(current.state.graph) : null;
    // "Go there" opens the first part the card is actually missing, not the start of the questions.
    const c = seeds?.complete ?? {};
    const missingPart = !c.target ? "you" : !c.interests ? "into" : !c.taste ? "taste" : !c.voice ? "voice" : "you";
    const checks = [
      ["Your target, what you're into, your taste and your voice", youDone(), missingPart],
      ["Your LinkedIn as it is today", linkedinDone(), "linkedin"],
    ];
    const ready = checks.every(([, ok]) => ok);
    const list = el("ul.rz__checks", {}, checks.map(([label, ok, id]) =>
      el(`li${ok ? ".is-ok" : ""}`, {}, el("span.rz__tick", { "aria-hidden": "true" }, ok ? "✓" : "○"), label, ok ? null : btn({ label: "Go there", variant: "quiet", onclick: () => go(id) }))));
    if (nodeDone()) {
      return stageCard("This step is done", "Everything we make for you now starts from your card. You can change any answer any time: use Back or the parts above.", list,
        [backButton(), next && next.id !== node?.id ? btn({ label: `Next step: ${next.title} →`, variant: "solid", onclick: () => current.navigate("map", next.id) }) : btn({ label: "Back to your map", variant: "solid", onclick: () => current.navigate("map") })]);
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
      [
        backButton(),
        ...(ready
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
                    // 409: a map the coach keeps by hand; 403: a seat whose map the coach builds. Both are left alone.
                    if (e.status !== 409 && e.status !== 403) toast(e.message, "warn");
                  }
                } }),
              btn({ label: "Something's off", variant: "ghost", onclick: () => { reporting = true; render(); } }),
            ]
          : []),
      ]
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
    const note = cardNote;
    cardNote = "";
    return el("div.pf__card", {},
      el("b.eyebrow", {}, "What we know about you"),
      el("p.rz__muted.pf__lead", {}, "Every tool reads this card: your banner, your post drafts, your project ideas, the roles we find."),
      note ? el("p.pf__fresh", { role: "status" }, "✓ ", note) : null,
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
    const st = stageOf(here);
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
      staleBox(),
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
        dismissed = readDismissed(slug);
        load();
      } else if (catalog) {
        render();
      }
    },
  };
}
