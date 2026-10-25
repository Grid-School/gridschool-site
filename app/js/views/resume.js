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

import { el, mount } from "../dom.js?v=d177a03-202610252138";
import { btn, toast } from "../ui.js?v=d177a03-202610252138";
import { nodeRail } from "./node-rail.js?v=d177a03-202610252138";
import { nextUp } from "../graph/model.js?v=d177a03-202610252138";
import { isProgressReadOnly } from "../store.js?v=d177a03-202610252138";
import { upgradeHref } from "../prep.js?v=d177a03-202610252138";
import * as api from "../resume-remote.js?v=d177a03-202610252138";

const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const STAGES = [
  { id: "start", label: "Start" },
  { id: "questions", label: "Questions" },
  { id: "write", label: "Write" },
  { id: "check", label: "Check" },
  { id: "save", label: "Save" },
];
const FINISH = { id: "finish", label: "Finish" };

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function claimsOf(rec) {
  return (rec?.graph?.claims || []).filter((c) => c.status !== "rejected");
}

function linesOf(rec) {
  return claimsOf(rec).filter((c) => c.line);
}

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

  const readOnly = () => isProgressReadOnly();
  const stages = () => (embedded ? [...STAGES, FINISH] : STAGES);
  const taskDone = (task) => current.state.student?.tasks?.[task.id]?.state === "done";
  const nodeDone = () => Boolean(node?.tasks?.length) && node.tasks.every(taskDone);
  const latest = () => saves[0] || null;
  const downloaded = () => saves.some((s) => s.downloads > 0);
  const allConfirmed = () => linesOf(rec).length > 0 && linesOf(rec).every((c) => c.status === "confirmed");
  const changedSinceSave = () => Boolean(latest()) && rec?.preview && latest().text.trim() !== rec.preview.trim();

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

  async function run(label, fn) {
    if (busy) return;
    if (readOnly()) {
      toast("View only: this is the student's own resume.", "warn");
      return;
    }
    busy = label;
    render();
    try {
      const out = await fn();
      if (out?.graph) {
        lastReport = out.report || null;
        take(out);
      }
    } catch (e) {
      if (e.status === 409 && e.payload?.graph) take(e.payload);
      toast(e.message, "warn", { ms: 5000 });
    } finally {
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
      if (!downloaded() || changedSinceSave()) return "save";
      return embedded ? "finish" : "save";
    }
    if (rec.next) return "questions";
    return "write";
  }

  function doneStages() {
    const g = rec?.graph || {};
    const done = [];
    if ((g.roles || []).length || (g.projects || []).length || (g.queue || []).length) done.push("start");
    if (((g.roles || []).length || (g.projects || []).length) && !rec.next) done.push("questions");
    if (linesOf(rec).length) done.push("write");
    if (allConfirmed()) done.push("check");
    if (downloaded()) done.push("save");
    if (nodeDone()) done.push("finish");
    return done;
  }

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
    const submit = (payload) => run("Reading your resume. About 15 seconds.", () => api.importResume(slug, rec.version, { ...payload, replace: has || undefined }));
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
  function questionsBody() {
    const q = rec.next;
    const open = (rec.graph.queue || []).filter((x) => x.state === "open").length;
    const answered = (rec.graph.queue || []).filter((x) => x.state === "done").length;
    if (!q) {
      return stageCard("That's every question", "Next, we write each line of your resume from what you told us.", null, nextBtn("Write my lines", "write"));
    }
    const box = el("textarea.rz__text", { rows: 6, placeholder: "Type it the way you'd say it. A rough number is fine: say \"about\"." });
    const send = () => (box.value.trim() ? run("Reading your answer.", () => api.answerQuestion(slug, rec.version, q.id, box.value)) : toast("Type an answer, or press Skip.", "warn"));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
    });
    setTimeout(() => box.focus({ preventScroll: true }), 0);
    return stageCard(
      `Question ${answered + 1}`,
      `${plural(open - 1, "more question")} after this one. Skip any you can't answer.`,
      [
        el("div.rz__q", {}, el("p.rz__qtext", {}, q.text), q.why ? el("p.rz__why", {}, q.why) : null),
        box,
        el("p.rz__hint", {}, "Tip: press Cmd+Enter to save."),
        reportLine(),
      ],
      [
        btn({ label: busy ? "Saving…" : "Save answer", variant: "solid", disabled: Boolean(busy), onclick: send }),
        btn({ label: "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Skipping.", () => api.skipQuestion(slug, rec.version, q.id)) }),
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
          onclick: () => run("Writing your lines. About 20 seconds.", () => api.writeLines(slug, rec.version)) }),
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
      embedded && downloaded() && !changedSinceSave() ? nextBtn("Finish this step", "finish") : null
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
      ["You saved a version and downloaded it", downloaded() && !changedSinceSave(), "save"],
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
    const main = el("section.rz__main", {},
      nodeRail({ nodes: stages(), done: doneStages(), here, onGo: go, label: "Resume steps" }),
      readOnly() ? el("p.rz__readonly", {}, "View only: this is the student's own resume. Changes are theirs to make.") : null,
      el("div.rz__card", { "aria-busy": busy ? "true" : null }, busy ? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body));
    const preview = el("aside.rz__preview", { "aria-label": "Your resume so far" },
      el("b.eyebrow", {}, "Your resume so far"),
      rec.preview ? el("div.rz-doc", {}, previewHtml(rec.preview)) : el("p.rz__empty", {}, "Lines appear here as you keep them. Nothing goes on your resume until you say it's true."));
    mount(root, el(`div.rz${embedded ? ".rz--embedded" : ""}`, {}, head, el("div.rz__grid", {}, main, preview)));
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
