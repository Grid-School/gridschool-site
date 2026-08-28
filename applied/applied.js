/**
 * After the application. Books the call when Cal.com is connected, and otherwise
 * hands the applicant their own record to email, which still closes the loop.
 */

import { getApplication, formatApplication, mailtoHref } from "../js/lead.js";
import { LINKS, link } from "../config.js";

const application = getApplication();

if (application?.name) {
  document.getElementById("hello").textContent = `${application.name.split(" ")[0]}, that is in. Two steps before we talk.`;
}

/* The walkthrough shortcut is for testing the funnel, not for applicants. */
if (new URLSearchParams(location.search).get("demo") === "1") {
  document.getElementById("demonote").hidden = false;
}

/* ---------- step one: the boot screen ---------- */

const bootMount = document.getElementById("bootscreen");
const studioRepo = link("studioRepo");

if (studioRepo) {
  bootMount.innerHTML = `
    <div class="fsubmit">
      <a class="btn btn--solid" href="${studioRepo}" target="_blank" rel="noopener">Open the studio repo</a>
      <a class="btn btn--ghost" href="mailto:${LINKS.email}?subject=${encodeURIComponent("Boot screen output")}">Send the output</a>
    </div>`;
} else {
  bootMount.innerHTML = `
    <p class="muted" style="font-size:14px">The repo link arrives in your inbox within one working day, with the two commands. Nothing to do until it lands.</p>`;
}

/* ---------- step two: booking ---------- */

const bookMount = document.getElementById("book");
const fitCall = link("fitCall");

if (fitCall) {
  bookMount.innerHTML = `<a class="btn btn--cta" href="${fitCall}" target="_blank" rel="noopener">Pick a slot</a>`;
} else {
  bookMount.innerHTML = `
    <p class="muted" style="font-size:14px">The booking link is not connected yet. Email me and I will send you two times inside one working day.</p>
    <div class="fsubmit">
      <a class="btn btn--cta" href="mailto:${LINKS.email}?subject=${encodeURIComponent("GridSchool fit call")}">Email me for a slot</a>
      <span class="wired">booking not connected yet</span>
    </div>`;
}

/* ---------- their copy of the application ---------- */

if (application) {
  const card = document.getElementById("receiptcard");
  const receipt = document.getElementById("receipt");
  card.hidden = false;
  receipt.textContent = formatApplication(application);
  document.getElementById("mailto").href = mailtoHref(application);
  document.getElementById("copy").addEventListener("click", (event) => {
    navigator.clipboard?.writeText(formatApplication(application)).then(() => {
      event.target.textContent = "Copied";
      setTimeout(() => (event.target.textContent = "Copy it"), 1800);
    });
  });
}
