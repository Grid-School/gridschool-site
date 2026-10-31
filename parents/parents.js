/**
 * parents/: the page for parents (film P's script as text until it's filmed; ops/beliefs-and-films-2026-10-31.md).
 * Opened from a grad's "ask your parents" note (?for=<check id>): it names the grad and lets the parent say they
 * read it and will join the call (POST /fit/<id>/parent, server/fit_api.py). Without a link it's the same page,
 * ending in the free check for their grad.
 */

import { PERSIST } from "../config.js?v=fc7db25-202610310827";
import { track } from "../check/events.js?v=fc7db25-202610310827";

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

async function tap(joining) {
  for (const b of act.querySelectorAll("button")) b.disabled = true;
  try {
    const res = await fetch(`${API}/fit/${forId}/parent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joining }) });
    if (!res.ok) throw new Error();
    status.textContent = joining
      ? "Thank you. I'll see you both on the call. It starts with what your grad wants, and you can ask anything."
      : "Thank you for reading it. Your grad will decide what's next, and you're welcome on the call any time.";
  } catch {
    for (const b of act.querySelectorAll("button")) b.disabled = false;
    status.textContent = "That didn't go through. Try again in a moment, or reply to any of our emails.";
  }
}

async function start() {
  track(API, "parents.view", { check: forId });
  if (!forId) return;
  try {
    const res = await fetch(`${API}/fit/${forId}/parent`);
    if (!res.ok) return;
    const { first } = await res.json();
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
