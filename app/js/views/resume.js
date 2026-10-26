/**
 * The resume builder (server/resume_engine.py, resume_writer.py, resume_api.py).
 *
 * Two places, one tool:
 * - Embedded in its node on the map (step.js, node type "builder"): the node IS the builder. Its steps
 *   check themselves (every line confirmed, a version saved and downloaded) and the node finishes only
 *   when the student says "Yes, this is my resume", or tells their coach what's wrong.
 * - On its own at #/resume: the same tool, for another version later, and the history of every saved one.
 *
 * Every step says what to do now and has one main button. Nothing goes on the resume until the student
 * confirms it. Every saved version has a name, the date and time it was made, and can be downloaded again.
 */

import { el, mount } from "../dom.js?v=200c41d-202610261730";
import { btn, toast } from "../ui.js?v=200c41d-202610261730";
import { nodeRail } from "./node-rail.js?v=200c41d-202610261730";
import { nextUp } from "../graph/model.js?v=200c41d-202610261730";
import { isProgressReadOnly } from "../store.js?v=200c41d-202610261730";
import { upgradeHref } from "../prep.js?v=200c41d-202610261730";
import * as api from "../resume-remote.js?v=200c41d-202610261730";
import { patient } from "../patient.js?v=200c41d-202610261730";
import { doneIds } from "../steps.js?v=200c41d-202610261730";
import { workPanel } from "./work.js?v=200c41d-202610261730";
import { needsPanel, needFor, planBlock } from "./needs.js?v=200c41d-202610261730";
import { sendSuggestion } from "../suggest-remote.js?v=200c41d-202610261730";
import { newOpId } from "../../../data/map-proposal.mjs?v=200c41d-202610261730";
import { titleRow } from "./titles.js?v=200c41d-202610261730";
import { talkButton, canTalk } from "./voice.js?v=200c41d-202610261730";
import { roundState, gained, RANGES, wantsNumber, addRange } from "../interview.js?v=200c41d-202610261730";
import { stepsFor, claimsOf, linesOf, hasOutput, allConfirmed as confirmedAll, changedSinceSave as changedSince, savedAndDownloaded } from "../resume-stages.js?v=200c41d-202610261730";

const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";


/* The steps each model call goes through, shown while it runs; the server's own (work_progress.py) replace
   these as soon as it reports, with the notes of what it found. Same ids and order as resume_api.py. */
const WORK = {
  plan: [
    { id: "read", label: "Looking at what you've done" },
    { id: "plan", label: "Finding the smallest thing that would earn it" },
    { id: "line", label: "Writing the line it earns, in advance" },
  ],
  target: [
    { id: "read", label: "Reading the title or posting" },
    { id: "needs", label: "Working out what this job is screened for" },
    { id: "next", label: "Choosing the questions that matter most for it" },
  ],
  import: [
    { id: "got", label: "Got your resume" },
    { id: "read", label: "Reading every job and line, word for word" },
    { id: "check", label: "Checking every number and skill against your own words" },
    { id: "ask", label: "Choosing the questions worth asking" },
  ],
  answer: [
    { id: "read", label: "Reading your answer for facts: what you did, what changed, any numbers" },
    { id: "merge", label: "Adding it to your record, keeping only what you said" },
    { id: "next", label: "Choosing the next question" },
  ],
  write: [
    { id: "draft", label: "Writing your lines from your answers" },
    { id: "check", label: "Checking each line: only your numbers, names and words" },
    { id: "retry", label: "Rewriting any line that didn't pass" },
    { id: "save", label: "Saving your lines" },
  ],
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

async function fileToPayload(file) {
  const name = file.name.toLowerCase();
  if (file.size > 3 * 1024 * 1024) throw new Error("That file is over 3 MB. A resume should be much smaller.");
  if (name.endsWith(".docx")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { docx: btoa(bin) };
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import(PDF_JS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, 6); n += 1) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push(content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join(""));
    }
    return { text: pages.join("\n") };
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return { text: await file.text() };
  throw new Error("Use a PDF or Word (.docx) file, or paste the text.");
}

function saveFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The resume text as clean, single-column HTML, for the preview and for printing to PDF. */
function previewHtml(text) {
  const lines = (text || "").split("\n");
  const out = [];
  let list = null;
  const close = () => {
    if (list) out.push(list);
    list = null;
  };
  lines.forEach((line, i) => {
    if (!line.trim()) return close();
    if (i === 0) return out.push(el("h1.rz-doc__name", {}, line));
    if (/^[A-Z ]{4,}$/.test(line.trim())) {
      close();
      return out.push(el("h2.rz-doc__h", {}, line.trim()));
    }
    if (line.startsWith("- ")) {
      list ??= el("ul.rz-doc__list");
      list.append(el("li", {}, line.slice(2)));
      return null;
    }
    close();
    return out.push(el(i <= 2 ? "p.rz-doc__top" : "p.rz-doc__role", {}, line));
  });
  close();
  return out;
}

function printPdf(text, name) {
  const win = window.open("", "_blank");
  if (!win) return toast("Your browser blocked the print window. Allow pop-ups for this page, then try again.", "warn");
  const body = el("div", {}, previewHtml(text));
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><style>
    @page { size: letter; margin: 0.6in; }
    body { font: 10.5pt/1.35 Calibri, Arial, sans-serif; color: #111; margin: 0; }
    h1 { font-size: 18pt; margin: 0 0 2pt; }
    h2 { font-size: 10.5pt; letter-spacing: .06em; border-bottom: 1px solid #888; margin: 12pt 0 4pt; padding-bottom: 1pt; }
    p { margin: 2pt 0; } .rz-doc__role { font-weight: 700; margin-top: 6pt; }
    ul { margin: 2pt 0 4pt; padding-left: 16pt; } li { margin: 1pt 0; }
  </style></head><body>${body.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
  return null;
}

/** A stage's card: what it is, what to do now, the work, and the one way forward. */
function stageCard(title, now, body, next) {
  return [el("header.rz__stagehead", {}, el("h2", {}, title), now ? el("p.rz__now", {}, now) : null), body, next ? el("div.rz__next", {}, next) : null];
}

/**
 * ctx: { state, store, navigate }. options.embedded: inside its map node (step.js); options.node: that node.
 */
export function renderResume(ctx, options = {}) {
  const embedded = Boolean(options.embedded);
  let node = options.node || null;
  const root = el("div.view.view--resume");
  let current = ctx;
  let slug = ctx.state.slug;
  let rec = null;
  let saves = [];
  let stage = null;
  let busy = "";
  let editing = null;
  let lastReport = null;
  let lastSaveId = null;
  let reporting = false;
  let error = "";
  let panel = null;
  let lastGain = null;
  let lastPlan = null;
  let keepGoing = false;

  const readOnly = () => isProgressReadOnly();
  const stages = () => stepsFor(embedded);
  const taskDone = (task) => current.state.student?.tasks?.[task.id]?.state === "done";
  const nodeDone = () => Boolean(node?.tasks?.length) && node.tasks.every(taskDone);
  const latest = () => saves[0] || null;
  const allConfirmed = () => confirmedAll(rec);
  const changedSinceSave = () => changedSince({ rec, saves });

  async function load() {
    if (!api.resumeReady()) {
      error = "Sign in to build your resume. It's saved to your account.";
      return render();
    }
    try {
      const [r, s] = await Promise.all([api.loadResume(slug), api.listSaves(slug).catch(() => ({ saves: [] }))]);
      saves = s.saves || [];
      take(r);
    } catch (e) {
      error = e.message;
      render();
    }
  }

  function take(next) {
    rec = { ...next, week: next.week ?? rec?.week, plan: next.plan ?? rec?.plan };
    error = "";
    render();
  }

  /**
   * One call to the engine. `work` (one of WORK) is for the calls that wait on the model: while they run,
   * the card shows what's being done and what the model has found so far (work.js, server/work_progress.py).
   */
  async function run(label, fn, work = null) {
    if (busy) return;
    if (readOnly()) {
      toast("View only: this is the student's own resume.", "warn");
      return;
    }
    busy = label;
    const runId = work ? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` : "";
    // Only this call's run is shown: an older one for the same student is ignored.
    const mine = async () => {
      const p = (await api.loadProgress(slug)).progress;
      return p?.run === runId ? p : null;
    };
    panel = work ? workPanel({ title: label, steps: work, poll: mine }) : null;
    render();
    try {
      // A long model call can outlive the proxy's reply window: if the answer is lost, keep reading the
      // record until it moves (patient.js) instead of telling the student it failed when it didn't.
      const out = await patient(() => fn(runId), {
        before: rec?.version,
        load: () => api.loadResume(slug),
        waiting: () => {
          const still = "Still working. A long resume can take a minute. Don't close this.";
          if (panel) panel.setTitle(still);
          else { busy = still; render(); }
        },
      });
      if (out?.graph && panel) {
        panel.complete();
        await new Promise((r) => setTimeout(r, 600));
      }
      if (out?.graph) {
        lastReport = out.recovered ? lastReport : out.report || null;
        // The payoff for answering: what that answer added, and anything the job checks that's now shown.
        lastGain = work === WORK.answer && !out.recovered ? gained(rec, out, out.report?.touched || []) : null;
        // "Not yet" shows its plan where the answer's payoff would go; anything else clears it.
        lastPlan = work === WORK.plan ? ((out.needs || []).find((n) => n.state === "later" && n.plan && !(rec.needs || []).some((o) => o.id === n.id && o.plan))?.id || lastPlan) : null;
        if (!out.round?.done) keepGoing = false;
        // A fresh read moves on to whatever comes next (the questions), even if they'd opened Start by hand.
        if (work === WORK.import) stage = null;
        // A new title opens on its own questions: that's where its checklist and gaps are.
        if (work === WORK.target) stage = out.next ? "questions" : null;
        take(out);
      }
    } catch (e) {
      if (e.status === 409 && e.payload?.graph) {
        // The server already moved on (our read was stale, or the earlier call did land): take what's there.
        take(e.payload);
        toast("Already saved on our side. Carrying on from there.", "ok");
      } else {
        toast(e.message, "warn", { ms: 5000 });
      }
    } finally {
      panel?.stop();
      panel = null;
      busy = "";
      render();
    }
  }

  /* Where to open: the furthest step they've reached, never back to questions they chose to stop. */
  function autoStage() {
    const g = rec?.graph || {};
    const started = (g.roles || []).length || (g.projects || []).length;
    if (!started && !rec.next) return "start";
    if (linesOf(rec).length) {
      if (!allConfirmed()) return "check";
      if (!savedAndDownloaded({ rec, saves })) return "save";
      return embedded ? "finish" : "save";
    }
    if (rec.next) return "questions";
    return "write";
  }

  /* Each step's rule lives in resume-stages.js; this only takes the snapshot. */
  const doneStages = () => doneIds(stages(), { rec, saves, nodeDone: nodeDone() });

  const go = (id) => {
    stage = id;
    editing = null;
    reporting = false;
    render();
    root.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };
  const nextBtn = (label, id) => btn({ label: `${label} →`, variant: "solid", onclick: () => go(id) });

  /* ---------- Start ---------- */
  function startBody() {
    const has = (rec.graph.roles || []).length > 0;
    const paste = el("textarea.rz__text", { rows: 10, placeholder: "Paste your whole resume here: every job, every line, as it is now." });
    const file = el("input", { type: "file", accept: ".pdf,.docx,.txt", class: "rz__file" });
    const submit = (payload) => run("Reading your resume. Usually under a minute.", (r) => api.importResume(slug, rec.version, { ...payload, replace: has || undefined, run: r }), WORK.import);
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        await submit(await fileToPayload(f));
      } catch (e) {
        toast(e.message, "warn");
      }
    });
    return stageCard(
      has ? "Start over from another resume" : "Start with the resume you have",
      has ? "This replaces what's here with a fresh read. Your target job stays." : "Upload it or paste it. We keep your words and ask only about what's missing.",
      el("div.rz__start", {},
        el("label.rz__drop", {}, el("b", {}, "Upload a PDF or Word file"), el("span", {}, "Choose the file and we start reading right away."), file),
        el("p.rz__or", {}, "or paste it"),
        paste,
        el("div.rz__row", {}, btn({ label: has ? "Read this one instead" : "Read my resume", variant: "solid", disabled: Boolean(busy),
          onclick: () => (paste.value.trim() ? submit({ text: paste.value }) : toast("Paste your resume, or choose a file above.", "warn")) })),
        el("div.rz__fresh", {},
          el("h3", {}, has ? "Or start over from nothing" : "No resume, or one you'd rather not use?"),
          el("p.rz__why", {}, "We ask about your jobs and projects one at a time and build it from what you tell us. About 30 minutes."),
          el("div.rz__row", {}, btn({ label: "Start from nothing", variant: "ghost", disabled: Boolean(busy),
            onclick: () => (!has || confirm("Start over from nothing? What's here now is replaced. Your target job stays.")) && run("Starting.", () => api.startFresh(slug, rec.version, has)) })))),
      null
    );
  }

  /* ---------- Questions ---------- */
  /* ---------- Questions: an interview about the job they want ---------- */
  function needsMap(q = null) {
    const title = rec.graph.targets?.[0]?.titles?.[0];
    return needsPanel({
      title,
      needs: rec.needs || [],
      busy: Boolean(busy),
      // The whole list until they start answering; then one line, so the question comes first.
      open: !q || !(rec.round?.done > 0),
      current: needFor(q, rec.needs),
      onToggle: readOnly() ? null : (n, state) => run(state === "off" ? "Leaving that out." : "Adding it back.", () => api.setNeed(slug, rec.version, n.id, state)),
      onRefresh: readOnly() ? null : () => run("Working out what this job is screened for.", () => api.refreshNeeds(slug, rec.version)),
      onMap: readOnly() ? null : putOnMap,
    });
  }

  /* "I haven't done this yet": the smallest way to earn it, and the line it earns, written in advance. */
  const notYet = (n) => run(`Working out how you'd earn: ${n.label}.`, (r) => api.setNeed(slug, rec.version, n.id, "later", r), WORK.plan);

  /* The plan becomes a step on their map: a suggestion (suggest-remote.js), the same path as Edit my map. */
  async function putOnMap(n) {
    if (busy || !n.plan) return;
    const nodes = current.state.graph?.nodes || [];
    const after = (node && nodes.some((x) => x.id === node.id) ? node : nodes.find((x) => x.id === "b.resume") || nodes[nodes.length - 1])?.id;
    if (!after) return toast("Your map isn't published yet, so there's nowhere to put it. The plan stays here.", "warn", { ms: 5000 });
    busy = "Sending it to your map.";
    render();
    try {
      await sendSuggestion(slug, {
        base: current.state.mapVersion ?? null,
        ops: [{ kind: "add", id: newOpId(), after, type: "step", title: n.plan.do.slice(0, 120),
          note: `For ${rec.graph.targets?.[0]?.titles?.[0] || "the job I want"}: ${n.label}. When it's done, this line goes on my resume: “${n.plan.line}”`.slice(0, 600),
          tasks: [n.plan.proof ? `Have this to show: ${n.plan.proof}`.slice(0, 120) : "Finish it, with something to show"] }],
        note: `From my resume: a step to earn "${n.label}" (${n.plan.weeks ? `about ${n.plan.weeks} weeks` : "a few weeks"}).`,
      });
      take(await api.needMapped(slug, rec.version, n.id));
      toast("Sent to your map. It shows there once it's merged in.", "ok", { ms: 5000 });
    } catch (e) {
      toast(e.message, "warn", { ms: 5000 });
    } finally {
      busy = "";
      render();
    }
  }

  function gainBlock() {
    if (lastPlan) {
      const n = (rec.needs || []).find((x) => x.id === lastPlan) || null;
      if (n?.plan) {
        return el("div.rz__gain.rz__gain--plan", { "aria-live": "polite" },
          el("b", {}, `Not yet: ${n.label}. That's fine, here's how to earn it.`),
          planBlock(n, { busy: Boolean(busy), onMap: readOnly() ? null : putOnMap }));
      }
    }
    if (!lastGain || (!lastGain.lines.length && !lastGain.nowShown.length)) return reportLine();
    return el("div.rz__gain", { "aria-live": "polite" },
      el("b", {}, "From that answer"),
      lastGain.nowShown.length ? el("p.rz__gainshown", {}, `✓ Now on your resume: ${lastGain.nowShown.join(", ")}`) : null,
      lastGain.lines.length ? el("ul", {}, lastGain.lines.slice(0, 4).map((line) => el("li", {}, line))) : null);
  }

  function questionsBody() {
    const q = rec.next;
    const round = roundState(rec, { keepGoing });
    if (!q) {
      return stageCard("That's every question", "Next, we write each line of your resume from what you told us.", [needsMap(), gainBlock()], nextBtn("Write my lines", "write"));
    }
    if (round.over) {
      return stageCard(
        "That's the round",
        `You've been through ${round.size} questions. Write your lines now: everything you said goes in, and the other ${plural(round.open, "question")} will be here if you want to add more later.`,
        [needsMap(), gainBlock()],
        [nextBtn("Write my lines", "write"), btn({ label: `Keep going (${round.open} more)`, variant: "ghost", onclick: () => { keepGoing = true; render(); } })]
      );
    }
    const box = el("textarea.rz__text", { rows: 6, placeholder: "Talk it through the way you would to a friend. Rough numbers are fine: say \"about\"." });
    const send = () => (box.value.trim() ? run("Reading your answer.", (r) => api.answerQuestion(slug, rec.version, q.id, box.value, r), WORK.answer) : toast("Type an answer, or press Skip.", "warn"));
    const skipIt = (label) => run(label, () => api.skipQuestion(slug, rec.version, q.id));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
    });
    setTimeout(() => box.focus({ preventScroll: true }), 0);
    const ranges = wantsNumber(q)
      ? el("div.rz__ranges", { "aria-label": "Quick answers for a number" },
          el("span", {}, "Not sure of the number? Tap one:"),
          RANGES.map((r) => el("button.rz__chip", { type: "button", onclick: () => { box.value = addRange(box.value, r); box.focus(); } }, r)))
      : null;
    return stageCard(
      round.title,
      `${round.after} Skip any you can't answer.`,
      [
        q.node === "T1" ? null : needsMap(q),
        el("div.rz__q", {}, el("p.rz__qtext", {}, q.text), q.why ? el("p.rz__why", {}, q.why) : null),
        box,
        el("div.rz__aids", {}, talkButton(box), ranges),
        el("p.rz__hint", {}, canTalk() ? "Tip: talking is faster. Press Cmd+Enter to save." : "Tip: press Cmd+Enter to save."),
        gainBlock(),
      ],
      [
        btn({ label: busy ? "Saving…" : "Save answer", variant: "solid", disabled: Boolean(busy), onclick: send }),
        needFor(q, rec.needs)?.status === "missing" && !readOnly()
          ? btn({ label: "I haven't done this yet", variant: "ghost", disabled: Boolean(busy), onclick: () => notYet(needFor(q, rec.needs)) })
          : wantsNumber(q) ? btn({ label: "I don't know", variant: "quiet", disabled: Boolean(busy), onclick: () => skipIt("Skipping.") }) : null,
        btn({ label: "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => skipIt("Skipping.") }),
        claimsOf(rec).length ? btn({ label: "Stop here and write my lines", variant: "ghost", disabled: Boolean(busy), onclick: () => go("write") }) : null,
      ]
    );
  }

  function reportLine() {
    const r = lastReport;
    if (!r) return null;
    const bits = [];
    if (r.claims) bits.push(`read ${plural(r.claims, "line")} from your resume`);
    if (r.new_roles) bits.push(`added ${plural(r.new_roles, "job")}`);
    if (r.new_claims) bits.push(`${plural(r.new_claims, "new line")}`);
    if (r.updated) bits.push(`added to ${plural(r.updated, "line")}`);
    if (r.merged) bits.push(`merged ${plural(r.merged, "repeat")}`);
    if (r.new_projects) bits.push(`${plural(r.new_projects, "new project")}`);
    if (r.dropped_numbers) bits.push(`left out ${plural(r.dropped_numbers, "number")} you didn't say`);
    if (r.dropped_terms) bits.push(`left out ${plural(r.dropped_terms, "thing")} that weren't in what you typed`);
    if (r.dropped_lines) bits.push(`skipped ${plural(r.dropped_lines, "line")} that weren't in your file`);
    if (!bits.length) return null;
    const text = bits.join(" · ");
    return el("p.rz__report", {}, `Last answer: ${text.charAt(0).toLowerCase()}${text.slice(1)}.`);
  }

  /* ---------- Write ---------- */
  function writeBody() {
    if (rec.plan === "free") {
      // Free gets the audit (resume_api.WEEKLY): the questions and everything said is kept; writing is Complete.
      return stageCard("Writing your new lines is part of GridSchool Complete",
        "Everything you answered is kept. With Complete, we write every line from your answers, you check each one, and you download the finished resume.",
        null,
        btn({ label: "See GridSchool Complete →", variant: "solid", href: upgradeHref(current.state.graph, node) }));
    }
    const n = claimsOf(rec).length;
    const written = linesOf(rec).length;
    const r = lastReport && "written" in lastReport ? lastReport : null;
    return stageCard(
      written ? "Your lines are written" : "Write every line",
      written
        ? "Next, check each one. Rewrite them if you answered more questions since."
        : `We turn your answers into ${plural(n, "resume line")}. A line can only use what you told us.`,
      r
        ? el("p.rz__report", {}, `Wrote ${r.written}${r.rewritten ? `, fixed ${r.rewritten} on a second try` : ""}${r.fell_back ? `, kept your own words for ${r.fell_back}` : ""}${r.dropped ? `, left out ${r.dropped} we couldn't write truthfully (we'll ask about them)` : ""}.`)
        : null,
      [
        written ? nextBtn("Check my lines", "check") : null,
        btn({ label: busy ? "Writing…" : written ? "Rewrite my lines" : `Write ${plural(n, "line")}`, variant: written ? "ghost" : "solid", disabled: Boolean(busy) || !n,
          onclick: () => run("Writing your lines. Usually under a minute.", (r) => api.writeLines(slug, rec.version, r), WORK.write) }),
      ]
    );
  }

  /* ---------- Check ---------- */
  function checkBody() {
    const lines = linesOf(rec);
    const todo = lines.filter((c) => c.status !== "confirmed");
    if (!lines.length) return stageCard("Nothing to check yet", "Write your lines first.", null, nextBtn("Write my lines", "write"));
    return stageCard(
      todo.length ? `Check ${plural(todo.length, "line")}` : "Every line is confirmed",
      todo.length ? "Keep a line only if it's true and you could explain it in an interview. Only kept lines go on your resume." : "Next, name this version and save it.",
      el("ol.rz__lines", {}, [...todo, ...lines.filter((c) => c.status === "confirmed")].map(lineItem)),
      todo.length ? null : nextBtn("Name and save it", "save")
    );
  }

  function lineItem(c) {
    const ok = c.status === "confirmed";
    if (editing === c.id) {
      const box = el("textarea.rz__text", { rows: 3 }, c.line);
      const why = el("input.rz__input", { placeholder: "How you'd explain it in an interview (optional, just for you)", value: c.defense || "" });
      setTimeout(() => box.focus(), 0);
      return el("li.rz__line.is-editing", {}, box, why, el("div.rz__row", {},
        btn({ label: "Save my words", variant: "solid", disabled: Boolean(busy), onclick: () => { editing = null; run("Saving.", () => api.confirmLine(slug, rec.version, c.id, "edit", { text: box.value, defense: why.value })); } }),
        btn({ label: "Cancel", variant: "quiet", onclick: () => { editing = null; render(); } })));
    }
    const source = c.original && c.original !== c.line ? el("p.rz__was", {}, `Was: ${c.original}`) : null;
    return el(`li.rz__line${ok ? ".is-ok" : ""}`, {},
      el("p.rz__linetext", {}, c.line),
      source,
      el("div.rz__row", {},
        ok ? el("span.rz__ok", {}, "✓ Kept") : btn({ label: "True, keep it", variant: "solid", disabled: Boolean(busy), onclick: () => run("Saving.", () => api.confirmLine(slug, rec.version, c.id, "yes")) }),
        btn({ label: "Edit", variant: "ghost", disabled: Boolean(busy), onclick: () => { editing = c.id; render(); } }),
        btn({ label: "Leave it off", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Saving.", () => api.confirmLine(slug, rec.version, c.id, "no")) })));
  }

  /* ---------- Save: name it, keep it, download it; every version kept ---------- */
  async function download(save, fmt) {
    if (fmt === "pdf") {
      printPdf(save.text, save.name);
      return;
    }
    if (busy) return;
    stage = "save";
    busy = fmt === "docx" ? "Making your Word file." : "Making your text file.";
    render();
    try {
      const out = await api.renderSave(slug, save.id, fmt);
      if (fmt === "docx") {
        const bin = atob(out.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        saveFile(out.filename, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      } else {
        saveFile(out.filename, new Blob([out.text], { type: "text/plain" }));
      }
      const read = out.parse?.ok ? "We read it back: every job and line came out in order." : `Check it: ${out.parse?.missing?.length} lines didn't read back cleanly.`;
      const tip = out.ats ? ` Applying on ${out.ats.ats}: ${out.ats.tip}` : "";
      toast(`Downloaded ${out.filename}. ${read}${tip}`, out.parse?.ok ? "ok" : "warn", { ms: tip ? 9000 : 5000 });
      saves = (await api.listSaves(slug)).saves || saves;
    } catch (e) {
      toast(e.message, "warn");
    } finally {
      busy = "";
      render();
    }
  }

  function saveRow(save, highlight) {
    return el(`li.rz__save${highlight ? ".is-new" : ""}`, {},
      el("div.rz__savehead", {}, el("b", {}, save.name), el("small", {}, `${when(save.created_at)} · ${plural(save.lines, "line")}${save.downloads ? ` · downloaded ${plural(save.downloads, "time")}` : ""}`)),
      el("div.rz__row", {},
        btn({ label: "Word (.docx)", variant: highlight ? "solid" : "ghost", disabled: Boolean(busy), onclick: () => download(save, "docx") }),
        btn({ label: "PDF", variant: "ghost", onclick: () => download(save, "pdf") }),
        btn({ label: "Text", variant: "quiet", disabled: Boolean(busy), onclick: () => download(save, "txt") })));
  }

  function saveBody() {
    if (!allConfirmed()) {
      return stageCard("Check your lines first", "Only lines you keep are saved.", null, nextBtn("Check my lines", "check"));
    }
    const title = rec.graph.targets?.[0]?.titles?.[0];
    const fresh = !latest() || changedSinceSave();
    const name = el("input.rz__input", { value: title ? `Resume for ${title}` : "My resume", maxLength: 120, "aria-label": "Name this version" });
    const doSave = async () => {
      if (busy || readOnly()) return;
      stage = "save";
      busy = "Saving this version.";
      render();
      try {
        const out = await api.saveResume(slug, name.value);
        lastSaveId = out.save.id;
        saves = [out.save, ...saves.filter((s) => s.id !== out.save.id)];
        toast(`Saved "${out.save.name}". Download it below.`, "ok");
      } catch (e) {
        toast(e.message, "warn");
      } finally {
        busy = "";
        render();
      }
    };
    const newest = latest();
    return stageCard(
      fresh ? "Name this version and save it" : "Download your resume",
      fresh
        ? changedSinceSave()
          ? `Your resume changed since "${newest.name}" was saved. Save a new version to download it; "${newest.name}" stays in your list.`
          : "Give it a name you'll recognise later, like the job or company it's for."
        : "Applying through Workday, iCIMS or Taleo? Use the Word file. Greenhouse, Lever and Ashby read the PDF well.",
      [
        fresh
          ? el("div.rz__name", {}, el("label", {}, el("span", {}, "Name"), name),
              btn({ label: busy ? "Saving…" : "Save this version", variant: "solid", disabled: Boolean(busy), onclick: doSave }))
          : null,
        saves.length
          ? el("div.rz__saves", {}, el("h3", {}, "Your saved resumes"),
              el("ol.rz__savelist", {}, saves.map((s, i) => saveRow(s, s.id === lastSaveId || (!fresh && i === 0)))))
          : null,
        saves.length ? hireNote() : null,
      ],
      embedded && savedAndDownloaded({ rec, saves }) ? nextBtn("Finish this step", "finish") : null
    );
  }

  /* Confirmed lines and target titles already feed Hire (server/hire_feed.py); the profile drafts from them. */
  function hireNote() {
    return el("div.rz__hire", {},
      el("p.rz__why", {}, "Your role reads, campaigns and the job radar now work from these lines and your target titles. Next, draft your LinkedIn headline and About from them."),
      el("div.rz__row", {}, btn({ label: "Draft my headline and About →", variant: "ghost", onclick: () => current.navigate("do", "profile") })));
  }

  /* ---------- Finish (in its node): approve, or tell the coach what's wrong ---------- */
  function finishBody() {
    const newest = latest();
    const next = nodeDone() ? nextUp(current.state.graph) : null;
    const checks = [
      ["Every line on your resume is one you kept", allConfirmed(), "check"],
      ["You saved a version and downloaded it", savedAndDownloaded({ rec, saves }), "save"],
    ];
    const ready = checks.every(([, ok]) => ok);
    const list = el("ul.rz__checks", {}, checks.map(([label, ok, id]) =>
      el(`li${ok ? ".is-ok" : ""}`, {}, el("span.rz__tick", { "aria-hidden": "true" }, ok ? "✓" : "○"), label, ok ? null : btn({ label: "Go there", variant: "quiet", onclick: () => go(id) }))));
    if (nodeDone()) {
      return stageCard("This step is done", newest ? `Your resume: "${newest.name}", saved ${when(newest.created_at)}. You can make another version any time.` : null, [list, hireNote()],
        next && next.id !== node?.id ? btn({ label: `Next step: ${next.title} →`, variant: "solid", onclick: () => current.navigate("map", next.id) }) : btn({ label: "Back to your map", variant: "solid", onclick: () => current.navigate("map") }));
    }
    if (reporting) {
      const box = el("textarea.rz__text", { rows: 4, placeholder: "What's wrong? For example: \"My dates at Acme are off\" or \"It left out my best project\"." });
      setTimeout(() => box.focus(), 0);
      const send = async () => {
        const text = box.value.trim();
        if (!text) return toast("Say what's wrong in a sentence or two.", "warn");
        if (busy) return;
        busy = "Sending to your coach.";
        render();
        try {
          await api.reportProblem(slug, text, newest?.id);
          current.store.askAboutStep?.({ nodeId: node.id, title: node.title, text: `Resume: ${text}` });
          reporting = false;
          toast("Sent to your coach. They'll reply on Discord. Your resume is saved as it is.", "ok", { ms: 6000 });
        } catch (e) {
          toast(e.message, "warn");
        } finally {
          busy = "";
          render();
        }
      };
      return stageCard("Tell your coach what's wrong", "They see your answers and your resume, and will help on Discord or your next call.", box,
        [btn({ label: "Send to my coach", variant: "solid", disabled: Boolean(busy), onclick: send }), btn({ label: "Cancel", variant: "quiet", onclick: () => { reporting = false; render(); } })]);
    }
    return stageCard(
      ready ? "Is this your resume?" : "Almost there",
      ready ? `"${newest.name}", saved ${when(newest.created_at)}. Read it once more before you finish.` : "Finish the steps below first. Each one checks itself.",
      list,
      ready
        ? [
            btn({ label: "Yes, this is my resume. Finish this step", variant: "solid", disabled: Boolean(busy) || readOnly(),
              onclick: () => {
                node.tasks.forEach((task) => current.store.setTaskState(task.id, "done"));
                toast("Done. Your resume is saved, and this step is complete.", "ok");
                render();
              } }),
            btn({ label: "Something's wrong", variant: "ghost", onclick: () => { reporting = true; render(); } }),
          ]
        : null
    );
  }

  function render() {
    if (error && !rec) {
      mount(root, el("div.rz", {}, el("p.rz__empty", {}, error)));
      return;
    }
    if (!rec) {
      mount(root, el("div.rz", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening your resume."))));
      return;
    }
    const valid = stages().map((s) => s.id);
    const here = valid.includes(stage) ? stage : autoStage();
    const body = { start: startBody, questions: questionsBody, write: writeBody, check: checkBody, save: saveBody, finish: finishBody }[here]();
    const p = rec.progress || {};
    const week = rec.week?.import ? `${rec.week.import.used} of ${rec.week.import.limit} resumes this week` : "";
    const meta = [p.roles ? plural(p.roles, "job") : "", p.claims ? plural(p.claims, "line") : "", p.confirmed ? `${p.confirmed} kept` : "", saves.length ? plural(saves.length, "saved version") : "", week]
      .filter(Boolean).join(" · ");
    const target = rec.graph.targets?.[0];
    const head = embedded
      ? el("header.rz__head.rz__head--embedded", {}, el("p.rz__meta", {}, meta || "Nothing yet. Start below."))
      : el("header.rz__head", {},
          el("div", {}, el("b.eyebrow", {}, "Resume"), el("h1.rz__title", {}, target?.titles?.[0] ? `Your resume for ${target.titles[0]}` : "Build your resume, one question at a time")),
          el("p.rz__meta", {}, meta),
          btn({ label: "← Map", variant: "quiet", onclick: () => current.navigate("map") }));
    // One record, many titles: the row switches the lens (titles.js); nothing is copied.
    const titles = titleRow({
      targets: rec.targets || [],
      busy: Boolean(busy),
      onSwitch: readOnly() ? null : (t) => { stage = null; run(`Switching to ${t.title}.`, () => api.switchTarget(slug, rec.version, t.id)); },
      onAdd: readOnly() ? null : (text) => { stage = null; run("Working out what this job is screened for.", (r) => api.addTarget(slug, rec.version, text, r), WORK.target); },
      onRemove: readOnly() ? null : (t) => { stage = null; run("Removing.", () => api.removeTarget(slug, rec.version, t.id)); },
    });
    const main = el("section.rz__main", {},
      titles,
      nodeRail({ nodes: stages(), done: doneStages(), here, onGo: go, label: "Resume steps" }),
      readOnly() ? el("p.rz__readonly", {}, "View only: this is the student's own resume. Changes are theirs to make.") : null,
      el("div.rz__card", { "aria-busy": busy ? "true" : null }, busy ? panel?.node ?? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body));
    // The resume shows beside the steps only once lines are written: before that there's nothing of theirs to show.
    const preview = hasOutput(rec) && rec.preview
      ? el("aside.rz__preview", { "aria-label": "Your resume so far" }, el("b.eyebrow", {}, "Your resume so far"), el("div.rz-doc", {}, previewHtml(rec.preview)))
      : null;
    mount(root, el(`div.rz${embedded ? ".rz--embedded" : ""}`, {}, head, el(`div.rz__grid${preview ? "" : ".rz__grid--solo"}`, {}, main, preview)));
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
        rec = null;
        saves = [];
        load();
      } else if (rec) {
        render();
      }
    },
  };
}
