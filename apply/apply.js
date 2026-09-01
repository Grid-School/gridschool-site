/**
 * The application. Validates in the page, screens out people who cannot code
 * yet rather than taking their money, and hands the record to lead.js.
 */

import { submit, ingestLead } from "../js/lead.js";

const form = document.getElementById("form");
const screen = document.getElementById("screen");
const formError = document.getElementById("formerr");

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
      <p>This lab starts from there. A free course will get you further, faster, than eight weeks here would right now, and I'd rather send you there than take money for a spot that wouldn't help yet.</p>
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
  const data = { ...raw, commit: form.elements.commit.checked ? "yes" : "" };

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
  const result = submit(data);
  const ingested = await ingestLead(result.record);
  try {
    sessionStorage.setItem("gridschool.apply.ingested", ingested ? "1" : "0");
  } catch {
    /* ignore */
  }
  location.href = result.mode === "external" ? result.url : "../applied/";
});
