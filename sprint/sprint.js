/**
 * sprint/: the free sprint's page. The live seat count and the waves come from GET /sprint/status
 * (server/sprint_api.py); "Apply" goes into the free check with ?sprint=1 and the source carried through.
 * Someone who already saved a check, or is signed in, can go straight to the sprint step (apply/).
 */

import { PERSIST } from "../config.js?v=1fa97ed-202610310654";
import * as Account from "../check/account.js?v=1fa97ed-202610310654";
import { track } from "../check/events.js?v=1fa97ed-202610310654";
import { checkHref, dayText, savedCheck, seatsLine, sourceFrom } from "./sprint-model.mjs?v=1fa97ed-202610310654";

const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  if (local) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();

const from = sourceFrom(location.search);
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const withApi = (href) => {
  if (!local) return href;
  const url = new URL(href, location.href);
  url.searchParams.set("api", API);
  return url.toString();
};

for (const link of document.querySelectorAll("a[data-apply]")) {
  if (link.getAttribute("href") !== "#apply") link.href = withApi(checkHref(from));
}

let hasCheck = "";
try {
  hasCheck = savedCheck(localStorage.getItem("gridschool.check.v1"));
} catch {
  /* private window */
}
const continueLink = document.querySelector("[data-continue]");
if (continueLink && (hasCheck || Account.session())) {
  continueLink.href = withApi(`apply/?from=${encodeURIComponent(from)}`);
  continueLink.hidden = false;
}

async function load() {
  let status = null;
  try {
    const res = await fetch(`${API}/sprint/status`);
    if (res.ok) status = await res.json();
  } catch {
    /* the page still works: the counter keeps its default */
  }
  if (!status) return;
  const line = seatsLine(status);
  document.querySelector("[data-left]").textContent = line.left;
  document.querySelector("[data-left-words]").textContent = line.words;
  const waves = document.querySelector("[data-waves]");
  waves.textContent = line.waves;
  waves.hidden = !line.waves;
  document.getElementById("seats").classList.toggle("is-full", line.full);
  if (status.starts && status.ends) {
    for (const el of document.querySelectorAll("[data-dates]")) el.textContent = `${dayText(status.starts)} to ${dayText(status.ends)}`;
  }
  const fine = document.querySelector("[data-fine]");
  if (!status.on) {
    fine.textContent = "Applications open soon. Take the free check now and your answers will be ready when they do.";
  } else if (!status.open) {
    fine.textContent = "New seats are closed for this sprint. Apply and you'll go on the waitlist for the next one.";
  } else if (line.full) {
    fine.textContent = "All the seats are taken right now. Apply and you'll go on the waitlist with your place. Seats open when someone goes quiet.";
  }
}

track(API, "sprint.view", { source: from });
load();
