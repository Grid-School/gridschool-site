/**
 * briefing/: the lead magnet (ops/ads/creatives-2026-11/README.md, door BRIEF). An email opens the briefing and the
 * link is emailed (POST /briefing/lead, server/briefing_api.py). Coming back from that email (?open=1), or having
 * opened it in this browser before, skips the gate. The video plays above the text once LINKS.briefingFilm is set.
 */

import { PERSIST, LINKS, isPlaceholder } from "../config.js?v=3f8058e-202611020733";
import { applySiteOverrides } from "../js/site-overrides.js?v=3f8058e-202611020733";
import { track, visitorId } from "../check/events.js?v=3f8058e-202611020733";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = (() => {
  const asked = new URLSearchParams(location.search).get("api");
  if (LOCAL) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const params = new URLSearchParams(location.search);
const from = (params.get("from") || "").replace(/[^\w:.-]/g, "").slice(0, 60);
const KEY = "gridschool.briefing.v1";

const gate = document.querySelector("[data-gate]");
const body = document.querySelector("[data-body]");
const error = document.querySelector("[data-error]");
const next = document.querySelector("[data-next]");

const remembered = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};
const remember = (who) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ who, at: Date.now() }));
  } catch {
    /* private window */
  }
};

function link(text, href, solid) {
  return Object.assign(document.createElement("a"), { className: solid ? "btn btn--solid" : "plan__alt", href, textContent: text });
}

function open(who) {
  gate.hidden = true;
  body.hidden = false;
  const parent = who === "parent";
  next.replaceChildren(
    Object.assign(document.createElement("p"), {
      textContent: parent
        ? "The page for parents covers what we do, what we can't promise, and how to help without nagging. It ends with a way to send all this to your graduate."
        : "The free check takes about two minutes. It finds where your search stops and builds your map, and you keep it either way.",
    }),
    Object.assign(document.createElement("div"), { className: "sp__acts" }),
  );
  next.lastChild.append(
    parent ? link("Read the page for parents", "../parents/?from=briefing", true) : link("Take the free check", "../check/?from=briefing", true),
    parent ? link("Or take the check yourself, to see what your graduate would see", "../check/?from=briefing") : link("Or the free six-week sprint", "../sprint/?from=briefing"),
  );
  track(API, "briefing.open", { source: from });
  body.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

gate.addEventListener("submit", async (e) => {
  e.preventDefault();
  error.textContent = "";
  const email = gate.querySelector("#bf-email").value.trim();
  const who = gate.querySelector("input[name=who]:checked")?.value || "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return (error.textContent = "That email doesn't look right.");
  if (!who) return (error.textContent = "Pick the one closest to you.");
  const button = gate.querySelector("button");
  button.disabled = true;
  try {
    const res = await fetch(`${API}/briefing/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, who, from, visitor: visitorId(), company: gate.querySelector("[name=company]").value }),
    });
    if (!res.ok && res.status !== 429) throw new Error((await res.json().catch(() => ({}))).error || "");
  } catch (problem) {
    button.disabled = false;
    return (error.textContent = problem.message || "We couldn't reach our server. Try again in a moment.");
  }
  remember(who);
  open(who);
});

async function start() {
  await applySiteOverrides().catch(() => null);
  const film = !isPlaceholder(LINKS.briefingFilm) && String(LINKS.briefingFilm).startsWith("https://") ? LINKS.briefingFilm : "";
  if (film) {
    const slot = document.querySelector("[data-film]");
    slot.replaceChildren(Object.assign(document.createElement("iframe"), { src: film, title: "The briefing", allow: "fullscreen", loading: "lazy" }));
    slot.hidden = false;
  }
  track(API, "briefing.view", { source: from });
  const back = params.get("open") === "1" || remembered();
  if (back) open(params.get("who") || remembered()?.who || "grad");
}

start();
