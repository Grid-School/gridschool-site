/**
 * parents/: the page for parents (film P's script as text until it's filmed; ops/beliefs-and-films-2026-10-31.md).
 * Opened from a grad's "ask your parents" note (?for=<check id>): it names the grad and lets the parent say they
 * read it and will join the call (POST /fit/<id>/parent, server/fit_api.py). Without a link it's the same page,
 * ending in the free check for their grad.
 */

import { PERSIST, LINKS, isPlaceholder } from "../config.js?v=f96b76b-202610312232";
import { applySiteOverrides } from "../js/site-overrides.js?v=f96b76b-202610312232";
import { track } from "../check/events.js?v=f96b76b-202610312232";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = (() => {
  const asked = new URLSearchParams(location.search).get("api");
  if (LOCAL) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const forId = (() => {
  const id = new URLSearchParams(location.search).get("for") || "";
  return /^ck_[A-Za-z0-9_-]{16,40}$/.test(id) ? id : "";
})();

const lead = document.querySelector("[data-lead]");
const act = document.querySelector("[data-act]");
const status = document.querySelector("[data-status]");
const more = document.querySelector("[data-more]");
let booking = null;

/** After the tap, always a next step: pick the call time if the link is set, and a way to give the plan directly. */
function nextSteps(joining) {
  const parts = [];
  if (joining && booking) {
    const a = Object.assign(document.createElement("a"), { className: "btn btn--solid", href: booking, target: "_blank", rel: "noopener", textContent: "Pick a call time together" });
    parts.push(a);
  }
  const gift = Object.assign(document.createElement("a"), { className: "plan__alt", href: "../gift/", textContent: "Or give your graduate the self-serve plan directly" });
  parts.push(gift);
  more.replaceChildren(...parts);
  more.hidden = false;
}

async function tap(joining) {
  for (const b of act.querySelectorAll("button")) b.disabled = true;
  try {
    const res = await fetch(`${API}/fit/${forId}/parent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joining }) });
    if (!res.ok) throw new Error();
    status.textContent = joining
      ? booking
        ? "Thank you. Pick a time that works for you both. The call starts with what your graduate wants, and you can ask anything."
        : "Thank you. I'll email you both within a day with a few call times. The call starts with what your graduate wants, and you can ask anything."
      : "Thank you for reading it. Your graduate will decide what's next, and you're welcome on the call any time.";
    nextSteps(joining);
  } catch {
    for (const b of act.querySelectorAll("button")) b.disabled = false;
    status.textContent = "That didn't go through. Try again in a moment, or reply to any of our emails.";
  }
}

const linkOr = (key) => (!isPlaceholder(LINKS[key]) && String(LINKS[key]).startsWith("https://") ? LINKS[key] : null);

async function start() {
  await applySiteOverrides().catch(() => null);
  // Film P, once it exists (LINKS.parentFilm, set in config.js or the console's Site links).
  const film = linkOr("parentFilm");
  if (film) {
    const frame = Object.assign(document.createElement("iframe"), { src: film, title: "For parents", allow: "fullscreen", loading: "lazy" });
    document.querySelector("[data-film]").replaceChildren(frame);
    document.querySelector("[data-film]").hidden = false;
  }
  booking = linkOr("fitCall");
  track(API, "parents.view", { check: forId });
  if (!forId) return;
  try {
    const res = await fetch(`${API}/fit/${forId}/parent`);
    if (!res.ok) return;
    const { first, booking: link } = await res.json();
    booking = typeof link === "string" && link.startsWith("https://") ? link : booking;
    const name = first || "Your grad";
    lead.textContent = `${name} sent you this page. It takes about five minutes to read, and it's the same picture we start every student with.`;
    act.replaceChildren(
      Object.assign(document.createElement("button"), { className: "btn btn--solid", type: "button", textContent: `I read it. I'll join the call with ${first || "them"}`, onclick: () => tap(true) }),
      Object.assign(document.createElement("button"), { className: "btn btn--line", type: "button", textContent: "I read it", onclick: () => tap(false) }),
    );
  } catch {
    /* the page still reads the same */
  }
}

start();
