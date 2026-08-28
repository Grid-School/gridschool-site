/**
 * The Trust Gap Diagnostic, as an artifact rather than a paragraph.
 *
 * Four 1-to-5 scores, summed to a named card the person can copy, keep, and
 * bring to the fit call. Scored entirely in the browser: the value of the free
 * rung is the honesty of the number, not a captured email. The score is saved
 * locally so the application flow can refer back to it.
 */

import { LINKS } from "../config.js";

const KEY = "gridschool.diagnostic.v1";

const QUESTIONS = [
  { id: "inherited", label: "Inherited-system proof" },
  { id: "check", label: "A check a stranger can run" },
  { id: "defense", label: "A defense, out loud" },
  { id: "trail", label: "A public trail" },
];

/* Build the five radio buttons per question. */
for (const scale of document.querySelectorAll(".diag__scale")) {
  const q = scale.dataset.q;
  for (let n = 1; n <= 5; n += 1) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = q;
    input.value = String(n);
    label.append(input, document.createTextNode(String(n)));
    scale.append(label);
  }
}

const form = document.getElementById("diag");
const err = document.getElementById("diagerr");
const result = document.getElementById("result");
const card = document.getElementById("card");
const note = document.getElementById("resultnote");
const act = document.getElementById("act");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const scores = {};
  for (const question of QUESTIONS) {
    const value = Number(data.get(question.id));
    if (!value) {
      err.hidden = false;
      return;
    }
    scores[question.id] = value;
  }
  err.hidden = true;

  const name = String(data.get("name") ?? "").trim();
  const total = Object.values(scores).reduce((sum, n) => sum + n, 0);
  const record = { name, scores, total, at: new Date().toISOString().slice(0, 10) };
  localStorage.setItem(KEY, JSON.stringify(record));
  render(record);
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

function verdictFor(total) {
  if (total <= 11) {
    return {
      line: "This is exactly the gap the Defense Lab exists to close. Not a skill gap: an evidence gap. Eight weeks turns each of these four numbers into a link.",
      note: "Bring this score to the fit call. It becomes the baseline your board is measured against.",
      cta: "Apply for a spot",
    };
  }
  if (total <= 15) {
    return {
      line: "Close, and the gap is specific: the lowest number above is the one costing you interviews. That is the number the lab attacks first.",
      note: "Bring this score to the fit call and we start from your weakest check, not from week one of a syllabus.",
      cta: "Apply for a spot",
    };
  }
  return {
    line: "Your evidence is most of the way there. You may only be missing the publish step: making what already exists findable by a stranger. The lab would sharpen it, and an honest read is you might not need all eight weeks.",
    note: "If you apply, say your score. I will tell you on the call whether the lab is worth your money, and I have turned people away for being too ready.",
    cta: "Apply anyway",
  };
}

function render(record) {
  const verdict = verdictFor(record.total);
  act.textContent = verdict.cta;
  note.textContent = verdict.note;

  card.innerHTML = "";
  const head = document.createElement("div");
  head.className = "scorecard__head";
  head.innerHTML = `
    <span class="scorecard__name">${escapeHtml(record.name || "Your trust gap")}</span>
    <span class="scorecard__total">${record.total}<small> / 20</small></span>`;

  const bars = document.createElement("div");
  bars.className = "scorecard__bars";
  for (const question of QUESTIONS) {
    const value = record.scores[question.id];
    const row = document.createElement("div");
    row.className = "scorebar";
    row.innerHTML = `
      <span class="scorebar__label">${question.label}</span>
      <span class="scorebar__track"><span class="scorebar__fill" style="width: ${value * 20}%"></span></span>
      <span class="scorebar__n">${value}</span>`;
    bars.append(row);
  }

  const verdictEl = document.createElement("p");
  verdictEl.className = "scorecard__verdict";
  verdictEl.textContent = verdict.line;

  const date = document.createElement("p");
  date.className = "scorecard__date";
  date.textContent = `Trust Gap Diagnostic · gridschool.org · ${record.at}`;

  card.append(head, bars, verdictEl, date);

  const text = cardText(record, verdict);
  document.getElementById("mailcard").href =
    `mailto:${LINKS.email}?subject=${encodeURIComponent("My Trust Gap score")}&body=${encodeURIComponent(text)}`;
}

function cardText(record, verdict) {
  const lines = [
    `TRUST GAP DIAGNOSTIC · gridschool.org · ${record.at}`,
    record.name ? `Name: ${record.name}` : null,
    "",
    ...QUESTIONS.map((question) => `${question.label}: ${record.scores[question.id]} / 5`),
    `Total: ${record.total} / 20`,
    "",
    verdict.line,
  ].filter((line) => line !== null);
  return lines.join("\n");
}

document.getElementById("copycard").addEventListener("click", (event) => {
  const record = JSON.parse(localStorage.getItem(KEY) || "null");
  if (!record) return;
  const text = cardText(record, verdictFor(record.total));
  navigator.clipboard?.writeText(text).then(() => {
    event.target.textContent = "Copied";
    setTimeout(() => (event.target.textContent = "Copy the card"), 1800);
  });
});

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
