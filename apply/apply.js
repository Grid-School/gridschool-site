/**
 * The application. Validates in the page, screens out people who cannot code
 * yet rather than taking their money, and hands the record to lead.js.
 */

import { submit, ingestLead } from "../js/lead.js?v=d696edf-202610102057";
import { draftMap, draftRecord, stepTitle, STAGES, STOPS } from "../js/map-draft.js?v=d696edf-202610102057";

const form = document.getElementById("form");
const screen = document.getElementById("screen");
const formError = document.getElementById("formerr");

/**
 * The draft map from the landing, when the visitor drew one (?stage=&role=&stop=).
 * Shown back to them, prefilled where the answers overlap, and sent with the
 * application so the desk opens on the map they drew.
 */
let draft = null;
const YEARS_FOR = {
  grad: "CS degree, never held a software job",
  self: "Self-taught, never held a software job",
  laidoff: "More than two years, laid off",
};
const SEARCH_FOR = {
  replies: "Sending a lot. Almost no reply.",
  technical: "Interviews happen, then they stall.",
  final: "Interviews happen, then they stall.",
};

async function showDraft() {
  const params = new URLSearchParams(location.search);
  const stage = params.get("stage");
  const stop = params.get("stop");
  if (!(stage in STAGES) || !(stop in STOPS)) return;
  const map = draftMap({ stage, role: params.get("role"), stop });
  draft = draftRecord(map);
  let library = {};
  try {
    const { modules } = await (await fetch("../data/modules/index.json")).json();
    library = Object.fromEntries(modules.map((module) => [module.id, module]));
  } catch {
    /* titles fall back to the module ref */
  }
  const card = document.getElementById("draft");
  const route = card.querySelector(".draftcard__route");
  route.replaceChildren("route ", Object.assign(document.createElement("b"), { textContent: map.route }), ` · ${map.nodes.length} steps`);
  card.querySelector(".draftcard__steps").replaceChildren(
    ...map.nodes.map((node) => Object.assign(document.createElement("li"), { textContent: stepTitle(node, library) }))
  );
  card.querySelector(".draftcard__note a").href = `../?${new URLSearchParams(map.answers)}#top`;
  card.hidden = false;
  // The machine check matters when the map starts in the practice codebase.
  if (map.route === "build") document.getElementById("ready").open = true;
  const prefill = (name, value) => {
    const field = form.elements[name];
    if (value && field && !field.value && [...field.options].some((option) => option.value === value || option.text === value)) field.value = value;
  };
  prefill("years", YEARS_FOR[map.answers.stage]);
  prefill("search", map.answers.stage === "working" && map.answers.stop === "replies" ? "" : SEARCH_FOR[map.answers.stop]);
}
showDraft();

const REQUIRED_TEXT = ["name", "email", "work", "shipped", "blocking"];
const REQUIRED_PICK = ["years", "search"];

/** The one disqualifier. Said on the page, before any money moves. */
form.addEventListener("change", (event) => {
  if (event.target.name !== "canCode") return;
  if (event.target.value === "no") showTurnDown();
  else clearTurnDown();
});

function showTurnDown() {
  screen.innerHTML = `
    <div class="fcard rejected">
      <h2>Come back when you have one thing that runs.</h2>
      <p>The residency starts from there. A free course will get you further, faster, than a year here would right now, and I'd rather send you there than take money for a spot that wouldn't help yet.</p>
      <p>Any language. Build one small program end to end, then apply again. I'll read it.</p>
    </div>`;
  screen.scrollIntoView({ behavior: "smooth", block: "center" });
  form.querySelector('button[type="submit"]').disabled = true;
}

function clearTurnDown() {
  screen.innerHTML = "";
  form.querySelector('button[type="submit"]').disabled = false;
}

function markInvalid(field, message) {
  field.setAttribute("aria-invalid", "true");
  field.addEventListener("input", () => field.removeAttribute("aria-invalid"), { once: true });
  return message;
}

function validate(data) {
  const problems = [];

  for (const key of REQUIRED_TEXT) {
    const field = form.elements[key];
    if (!data[key]?.trim()) problems.push(markInvalid(field, `${key} is required`));
  }
  for (const key of REQUIRED_PICK) {
    const field = form.elements[key];
    if (!data[key]) problems.push(markInvalid(field, `${key} is required`));
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    problems.push(markInvalid(form.elements.email, "email looks wrong"));
  }
  if (data.work && !/^https?:\/\/.+\..+/.test(data.work)) {
    problems.push(markInvalid(form.elements.work, "work link must be a URL"));
  }
  if (!data.canCode) problems.push("answer the coding question");
  if (!data.plan) problems.push("pick how you would pay");
  if (!data.commit) problems.push("confirm the time commitment");

  return problems;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const raw = Object.fromEntries(new FormData(form).entries());
  const data = { ...raw, commit: form.elements.commit.checked ? "yes" : "", ...(draft ? { route: draft.route, draft } : {}) };

  const problems = validate(data);
  if (problems.length) {
    formError.hidden = false;
    formError.textContent =
      problems.length === 1
        ? `One thing missing: ${problems[0]}.`
        : `${problems.length} things missing. The fields are marked.`;
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  formError.hidden = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending…";
  const result = submit(data);
  const ingested = await ingestLead(result.record);
  try {
    sessionStorage.setItem("gridschool.apply.ingested", ingested ? "1" : "0");
  } catch {
    /* ignore */
  }
  location.href = result.url;
});
