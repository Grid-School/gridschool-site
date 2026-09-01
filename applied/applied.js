/**
 * After the application. Persist already has the record when ingest succeeded.
 * Mailto is only the fallback if that post failed. Cal.com is later.
 */

import { getApplication, formatApplication, mailtoHref } from "../js/lead.js";
import { link } from "../config.js";

const application = getApplication();

if (application?.name) {
  document.getElementById("hello").textContent = `${application.name.split(" ")[0]}, that is in.`;
}

if (new URLSearchParams(location.search).get("demo") === "1") {
  document.getElementById("demonote").hidden = false;
}

const bookMount = document.getElementById("book");
const fitCall = link("fitCall");
if (fitCall) {
  bookMount.innerHTML = `<a class="btn btn--cta" href="${fitCall}" target="_blank" rel="noopener">Pick a slot</a>`;
} else {
  bookMount.innerHTML = `
    <p class="muted" style="font-size:14px">I will email you two times. You do not need to write me first.</p>
    <span class="wired">booking not connected yet</span>`;
}

const studioRepo = link("studioRepo");
const bootCard = document.getElementById("bootcard");
const bootMount = document.getElementById("bootscreen");
if (studioRepo) {
  bootCard.hidden = false;
  bootMount.innerHTML = `
    <div class="fsubmit">
      <a class="btn btn--solid" href="${studioRepo}" target="_blank" rel="noopener">Open the studio repo</a>
    </div>`;
}

if (application) {
  const card = document.getElementById("receiptcard");
  const receipt = document.getElementById("receipt");
  const send = document.getElementById("receiptsend");
  const note = document.getElementById("receiptnote");
  let ingested = false;
  try {
    ingested = sessionStorage.getItem("gridschool.apply.ingested") === "1";
  } catch {
    ingested = false;
  }
  card.hidden = false;
  receipt.textContent = formatApplication(application);
  if (ingested) {
    note.textContent = "This is on my desk and in apply@. Reply is not required.";
    send.hidden = true;
  } else {
    document.getElementById("lede").textContent =
      "The desk did not receive this. Email it so I have it in front of me.";
    note.textContent = "Send this once. After that, wait for my reply.";
    send.hidden = false;
    document.getElementById("mailto").href = mailtoHref(application);
    document.getElementById("copy").addEventListener("click", (event) => {
      navigator.clipboard?.writeText(formatApplication(application)).then(() => {
        event.target.textContent = "Copied";
        setTimeout(() => (event.target.textContent = "Copy it"), 1800);
      });
    });
  }
}
