/**
 * The resume builder (server/resume_engine.py, resume_writer.py), opened from its node on the map.
 *
 * One question at a time on the left, the resume as it stands on the right. A row of nodes says
 * where they are: Start (paste or upload what they have), Questions (the engine asks the single most
 * useful one), Write (lines from their answers, each checked against what they said), Check (they
 * confirm every line is true and that they could explain it), Download (Word, PDF, text).
 * Nothing prints on the resume until they confirm it.
 */

import { el, mount } from "../dom.js?v=8b2a230-202610250853";
import { btn, toast } from "../ui.js?v=8b2a230-202610250853";
import { nodeRail, nodeIntro } from "./node-rail.js?v=8b2a230-202610250853";
import * as api from "../resume-remote.js?v=8b2a230-202610250853";

const PDF_JS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const STAGES = [
  { id: "start", label: "Start" },
  { id: "questions", label: "Questions" },
  { id: "write", label: "Write" },
  { id: "check", label: "Check" },
  { id: "download", label: "Download" },
];

function claimsOf(rec) {
  return (rec?.graph?.claims || []).filter((c) => c.status !== "rejected");
}

function doneStages(rec, downloaded) {
  const g = rec?.graph || {};
  const lines = claimsOf(rec).filter((c) => c.line);
  const done = [];
  if ((g.roles || []).length || (g.queue || []).length) done.push("start");
  if ((g.roles || []).length && !rec.next) done.push("questions");
  if (lines.length) done.push("write");
  if (lines.length && lines.every((c) => c.status === "confirmed")) done.push("check");
  if (downloaded) done.push("download");
  return done;
}

function autoStage(rec) {
  const g = rec?.graph || {};
  if (rec.next) return "questions";
  if (!(g.roles || []).length && !(g.projects || []).length) return "start";
  const lines = claimsOf(rec).filter((c) => c.line);
  if (!lines.length) return "write";
  if (lines.some((c) => c.status !== "confirmed")) return "check";
  return "download";
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

/** The preview text as clean, single-column HTML, for the page and for printing to PDF. */
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
  if (!win) return toast("Your browser blocked the print window. Allow pop-ups for this page.", "warn");
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
}

export function renderResume(ctx) {
  const node = el("div.view.view--resume");
  let slug = ctx.state.slug;
  let rec = null;
  let stage = null;
  let busy = "";
  let downloaded = false;
  let editing = null;
  let lastReport = null;
  let error = "";

  async function load() {
    if (!api.resumeReady()) {
      error = "Sign in to build your resume. It's saved to your account.";
      return render();
    }
    try {
      take(await api.loadResume(slug));
    } catch (e) {
      error = e.message;
      render();
    }
  }

  function take(next) {
    const week = next.week ?? rec?.week;
    const plan = next.plan ?? rec?.plan;
    rec = { ...next, week, plan };
    error = "";
    render();
  }

  async function run(label, fn) {
    if (busy) return;
    busy = label;
    render();
    try {
      const out = await fn();
      if (out) {
        lastReport = out.report || null;
        take(out);
      }
    } catch (e) {
      if (e.status === 409 && e.payload?.graph) {
        take(e.payload);
        toast(e.message, "warn");
      } else {
        toast(e.message, "warn");
      }
    } finally {
      busy = "";
      render();
    }
  }

  const go = (id) => {
    stage = id;
    editing = null;
    render();
    node.querySelector(".rz__main")?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  /* ---------- Start ---------- */
  function startBody() {
    const has = (rec.graph.roles || []).length > 0;
    const paste = el("textarea.rz__text", { rows: 12, placeholder: "Paste your whole resume here: every job, every line, as it is now." });
    const file = el("input", { type: "file", accept: ".pdf,.docx,.txt", class: "rz__file" });
    const submit = async (payload) =>
      run("Reading your resume. About 15 seconds.", () => api.importResume(slug, rec.version, { ...payload, replace: has || undefined }));
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        await submit(await fileToPayload(f));
      } catch (e) {
        toast(e.message, "warn");
      }
    });
    return [
      nodeIntro(has ? "Start over from another resume" : "Start with the resume you have",
        has ? "This replaces what's here with a fresh read. Your target job stays." : "We read every line, keep your words, and then ask about what's missing. Nothing is made up."),
      el("div.rz__start", {},
        el("label.rz__drop", {}, el("b", {}, "Upload a PDF or Word file"), el("span", {}, "Or paste below"), file),
        paste,
        el("div.rz__row", {}, btn({ label: has ? "Read this one instead" : "Read my resume", variant: "solid", disabled: Boolean(busy), onclick: () => paste.value.trim() ? submit({ text: paste.value }) : toast("Paste your resume or choose a file first.", "warn") }))),
      el("div.rz__fresh", {},
        el("h3", {}, has ? "Or start over from nothing" : "No resume, or one you'd rather not use?"),
        el("p.rz__why", {}, "We'll ask about your jobs and projects one at a time and build it from what you tell us. About 30 minutes."),
        el("div.rz__row", {}, btn({ label: "Start from nothing", variant: "ghost", disabled: Boolean(busy),
          onclick: () => (!has || confirm("Start over from nothing? What's here now is replaced; your target job stays.")) && run("Starting.", () => api.startFresh(slug, rec.version, has)) }))),
    ];
  }

  /* ---------- Questions ---------- */
  function questionsBody() {
    const q = rec.next;
    const left = (rec.graph.queue || []).filter((x) => x.state === "open").length;
    if (!q) {
      return [nodeIntro("That's every question for now", "Next, we write each line from what you told us."), el("div.rz__row", {}, btn({ label: "Write my lines →", variant: "solid", onclick: () => go("write") }))];
    }
    const box = el("textarea.rz__text", { rows: 6, placeholder: "Type it the way you'd say it. A rough number is fine: say \"about\"." });
    const send = () => box.value.trim() ? run("Reading your answer.", () => api.answerQuestion(slug, rec.version, q.id, box.value)) : toast("Type an answer, or skip this one.", "warn");
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
    });
    setTimeout(() => box.focus(), 0);
    return [
      el("p.rz__count", {}, `${left} ${left === 1 ? "question" : "questions"} left · skip any you can't answer`),
      el("div.rz__q", {}, el("h2.rz__qtext", {}, q.text), q.why ? el("p.rz__why", {}, q.why) : null),
      box,
      el("div.rz__row", {},
        btn({ label: busy ? "Saving…" : "Save answer", variant: "solid", disabled: Boolean(busy), onclick: send }),
        btn({ label: "Skip", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Skipping.", () => api.skipQuestion(slug, rec.version, q.id)) }),
        claimsOf(rec).length ? btn({ label: "Write my lines now", variant: "ghost", disabled: Boolean(busy), onclick: () => go("write") }) : null),
      reportLine(),
    ];
  }

  function reportLine() {
    const r = lastReport;
    if (!r) return null;
    const bits = [];
    if (r.claims) bits.push(`Read ${r.claims} lines from your resume`);
    if (r.new_roles) bits.push(`added ${r.new_roles} ${r.new_roles === 1 ? "job" : "jobs"}`);
    if (r.updated) bits.push(`added to ${r.updated} ${r.updated === 1 ? "line" : "lines"}`);
    if (r.new_claims) bits.push(`${r.new_claims} new ${r.new_claims === 1 ? "line" : "lines"}`);
    if (r.merged) bits.push(`merged ${r.merged} repeat`);
    if (r.new_projects) bits.push(`${r.new_projects} new ${r.new_projects === 1 ? "project" : "projects"}`);
    if (r.dropped_terms) bits.push(`left out ${r.dropped_terms} ${r.dropped_terms === 1 ? "thing" : "things"} that weren't in what you typed`);
    if (r.dropped_numbers) bits.push(`left out ${r.dropped_numbers} ${r.dropped_numbers === 1 ? "number" : "numbers"} you didn't say`);
    if (r.dropped_lines) bits.push(`skipped ${r.dropped_lines} ${r.dropped_lines === 1 ? "line" : "lines"} that weren't in your file`);
    return bits.length ? el("p.rz__report", {}, `${bits.join(" · ")}.`) : null;
  }

  /* ---------- Write ---------- */
  function writeBody() {
    const n = claimsOf(rec).length;
    const written = claimsOf(rec).filter((c) => c.line).length;
    return [
      nodeIntro("Write every line from your answers", "Each line uses only what you told us. A line that adds a number, tool or name you didn't give is rewritten, or your own words are used instead."),
      el("div.rz__row", {}, btn({ label: busy ? "Writing…" : written ? "Rewrite my lines" : `Write ${n} lines`, variant: "solid", disabled: Boolean(busy) || !n, onclick: () => run("Writing your lines. About 20 seconds.", () => api.writeLines(slug, rec.version)) }),
        written ? btn({ label: "Check them →", variant: "ghost", onclick: () => go("check") }) : null),
      lastReport && "written" in lastReport
        ? el("p.rz__report", {}, `Wrote ${lastReport.written}${lastReport.rewritten ? `, fixed ${lastReport.rewritten} on a second try` : ""}${lastReport.fell_back ? `, kept your own words for ${lastReport.fell_back}` : ""}${lastReport.dropped ? `, left out ${lastReport.dropped} we couldn't write truthfully (we'll ask about them)` : ""}.`)
        : null,
    ];
  }

  /* ---------- Check ---------- */
  function checkBody() {
    const lines = claimsOf(rec).filter((c) => c.line);
    const todo = lines.filter((c) => c.status !== "confirmed");
    if (!lines.length) return [nodeIntro("Nothing to check yet", "Write your lines first."), el("div.rz__row", {}, btn({ label: "← Write", variant: "ghost", onclick: () => go("write") }))];
    return [
      nodeIntro("Is every word true?", "Confirm each line only if it's true and you could explain it in an interview. Only confirmed lines go on your resume."),
      el("p.rz__count", {}, todo.length ? `${todo.length} to check · ${lines.length - todo.length} confirmed` : "Every line is confirmed."),
      el("ol.rz__lines", {}, [...todo, ...lines.filter((c) => c.status === "confirmed")].map(lineItem)),
      !todo.length ? el("div.rz__row", {}, btn({ label: "Download →", variant: "solid", onclick: () => go("download") })) : null,
    ];
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
        ok ? el("span.rz__ok", {}, "✓ Confirmed") : btn({ label: "True, keep it", variant: "solid", disabled: Boolean(busy), onclick: () => run("Saving.", () => api.confirmLine(slug, rec.version, c.id, "yes")) }),
        btn({ label: "Edit", variant: "ghost", disabled: Boolean(busy), onclick: () => { editing = c.id; render(); } }),
        btn({ label: "Leave it off", variant: "quiet", disabled: Boolean(busy), onclick: () => run("Saving.", () => api.confirmLine(slug, rec.version, c.id, "no")) })));
  }

  /* ---------- Download ---------- */
  function downloadBody() {
    const name = (rec.graph.person?.name || "resume").split(/\s+/).join("-");
    const target = rec.graph.targets?.[0]?.posting?.url || "";
    const get = (fmt) =>
      run(`Making your ${fmt === "docx" ? "Word file" : "text file"}.`, async () => {
        const out = await api.renderResume(slug, fmt, target);
        if (fmt === "docx") {
          const bin = atob(out.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          saveFile(out.filename, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        } else {
          saveFile(out.filename, new Blob([out.text], { type: "text/plain" }));
        }
        downloaded = true;
        const read = out.parse?.ok ? "We read it back: every job and line came out in order." : `Check it: ${out.parse?.missing?.length} lines didn't read back cleanly.`;
        const tip = out.ats ? ` Applying on ${out.ats.ats}: ${out.ats.tip}` : "";
        toast(`Saved ${out.filename}. ${read}${tip}`, out.parse?.ok ? "ok" : "warn", { ms: tip ? 9000 : 5000 });
        return null;
      });
    return [
      nodeIntro("Download your resume", "One column, standard headings, one date style: the layout hiring software reads most reliably."),
      el("div.rz__downloads", {},
        btn({ label: "Word (.docx)", variant: "solid", disabled: Boolean(busy), onclick: () => get("docx") }),
        btn({ label: "PDF (print, then Save as PDF)", variant: "ghost", onclick: () => { downloaded = true; printPdf(rec.preview, `${name}-resume`); render(); } }),
        btn({ label: "Plain text", variant: "quiet", disabled: Boolean(busy), onclick: () => get("txt") })),
      el("p.rz__why", {}, "Applying through Workday, iCIMS or Taleo? Use the Word file. Greenhouse, Lever and Ashby read the PDF well."),
    ];
  }

  function render() {
    if (error && !rec) {
      mount(node, el("div.rz", {}, el("p.rz__empty", {}, error)));
      return;
    }
    if (!rec) {
      mount(node, el("div.rz", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening your resume."))));
      return;
    }
    const here = stage || autoStage(rec);
    const done = doneStages(rec, downloaded);
    const body = { start: startBody, questions: questionsBody, write: writeBody, check: checkBody, download: downloadBody }[here]();
    const p = rec.progress || {};
    const week = rec.week?.import ? `${rec.week.import.used} of ${rec.week.import.limit} resumes this week` : "";
    const target = rec.graph.targets?.[0];
    const head = el("header.rz__head", {},
      el("div", {}, el("b.eyebrow", {}, "Resume"), el("h1.rz__title", {}, target?.titles?.[0] ? `Your resume for ${target.titles[0]}` : "Build your resume, one question at a time")),
      el("p.rz__meta", {}, [p.roles ? `${p.roles} ${p.roles === 1 ? "job" : "jobs"}` : "", p.claims ? `${p.claims} ${p.claims === 1 ? "line" : "lines"}` : "", p.confirmed ? `${p.confirmed} confirmed` : "", week].filter(Boolean).join(" · ")),
      btn({ label: "← Map", variant: "quiet", onclick: () => ctx.navigate("map") }));
    const main = el("section.rz__main", {}, nodeRail({ nodes: STAGES, done, here, onGo: go, label: "Resume steps" }),
      el("div.rz__card", { "aria-busy": busy ? "true" : null }, busy ? el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, busy)) : body));
    const preview = el("aside.rz__preview", { "aria-label": "Your resume so far" },
      el("b.eyebrow", {}, "Your resume so far"),
      rec.preview ? el("div.rz-doc", {}, previewHtml(rec.preview)) : el("p.rz__empty", {}, "Lines appear here as you confirm them. Nothing goes on your resume until you say it's true."));
    mount(node, el("div.rz", {}, head, el("div.rz__grid", {}, main, preview)));
  }

  render();
  load();
  return {
    node,
    update(next) {
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        rec = null;
        load();
      }
    },
  };
}
