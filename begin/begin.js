/**
 * Where people land after paying for GridSchool Complete (server: billing.py, billing_api.py).
 *
 * 1. Sign in: the link in the welcome email does it, or the email they paid with gets a code.
 * 2. Wait for the seat: the payment webhook makes it, usually within seconds.
 * 3. Welcome: their first name, the first thing their own check found, Aden's
 *    video when LINKS.welcomeVideo is set, and what happens next with a real time
 *    (when.js). People read most right after they buy; this is the page they reread.
 * 4. Open the map: the account becomes a board session (POST /account/seat) and the board opens.
 *    If that hand-off says the sign-in expired, the sign-in form comes back.
 *
 * Someone who had a free map pays from it (Have us do this): the payment turns that same seat
 * into the paid one (billing_api.py), so step 2 waits for its plan to read 'complete' and
 * step 4 opens the board they already had, with everything they did on it.
 */

import { PERSIST, link } from "../config.js?v=8b2a230-202610250853";
import * as Account from "../check/account.js?v=8b2a230-202610250853";
import { enterSeat } from "../app/js/persist-auth.js?v=8b2a230-202610250853";
import { reviewLabel } from "./when.js?v=8b2a230-202610250853";

// Localhost never talks to production: ?api= when given, else the page's own origin.
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  if (local) return (asked || location.origin).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const card = document.getElementById("card");
const WAIT_MS = 90_000;

/** Our words for a failure, never the browser's ("Failed to fetch"). */
function say(problem) {
  const message = problem?.message || "";
  if (!message || problem instanceof TypeError || /fetch|network|load failed/i.test(message)) return "We couldn't reach our server. Nothing is lost; try again in a moment.";
  return message;
}

/** What the map starts on, by the check's first finding (ids from intake_rules.RULES). */
const STARTING_ON = {
  reach: "getting your applications in front of a person",
  story: "making your resume read like the role you want",
  volume: "sending more of the right applications",
  target: "settling on one role to aim for",
  gap: "showing what you're doing now",
  proof: "giving reviewers something of yours they can open",
  screen: "winning the first recruiter call",
  technical: "getting you through the technical round",
  final: "turning final rounds into offers",
  level: "aiming at the level your work supports",
};

function startingOn(me) {
  const first = (me.checks || []).find((check) => Array.isArray(check.top) && check.top.length)?.top[0];
  if (!first) return "Your map starts with what you told us in the free check. Each step says why it's there and what we're preparing for you.";
  if (STARTING_ON[first.id]) return `We're starting where your free check pointed first: ${STARTING_ON[first.id]}.`;
  return first.title ? `We're starting where your free check pointed first: ${first.title.replace(/\.$/, "")}.` : "Your map starts with what your free check found.";
}

function h(tag, className, text, attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) if (child) node.append(child);
  return node;
}
const show = (...nodes) => card.replaceChildren(...nodes.filter(Boolean));
const button = (label, onClick, solid = true) => {
  const node = h("button", `btn ${solid ? "btn--solid" : "btn--line"}`, label, { type: "button" });
  node.addEventListener("click", onClick);
  return node;
};

function signInView(message = "") {
  const form = h("form", "save", null, { novalidate: "" });
  const email = h("input", "", null, { type: "email", autocomplete: "email", placeholder: "The email you paid with", "aria-label": "Email" });
  const error = h("p", "card__error", message, { role: "alert" });
  const go = h("button", "btn btn--solid", "Send my code", { type: "submit" });
  form.append(h("div", "save__row", null, {}, [email, go]), error);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const value = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return (error.textContent = "That email doesn't look right.");
    go.disabled = true;
    try {
      const { sent } = await Account.sendCode(API, value);
      if (!sent) throw new Error("We couldn't send a code just now. Reply to your receipt email and we'll get you in.");
      codeView(value);
    } catch (problem) {
      error.textContent = say(problem);
      go.disabled = false;
    }
  });
  show(
    h("p", "eyebrow", "Welcome to GridSchool"),
    h("h1", "card__title", "Let's open your map."),
    h("p", "card__lead", "Sign in with the email you paid with. We'll send you a 6-digit code; no password."),
    form
  );
  email.focus();
}

function codeView(email) {
  const form = h("form", "save", null, { novalidate: "" });
  const code = h("input", "code-input", null, { inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, placeholder: "6-digit code", "aria-label": "6-digit code" });
  const error = h("p", "card__error", "", { role: "alert" });
  const go = h("button", "btn btn--solid", "Confirm", { type: "submit" });
  form.append(h("div", "save__row", null, {}, [code, go]), error);
  code.addEventListener("input", () => {
    code.value = code.value.replace(/\D/g, "").slice(0, 6);
    if (code.value.length === 6) form.requestSubmit();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    go.disabled = true;
    try {
      await Account.verifyCode(API, email, code.value);
      waitForSeat();
    } catch (problem) {
      error.textContent = say(problem);
      go.disabled = false;
    }
  });
  show(h("p", "eyebrow", "Check your email"), h("h1", "card__title", `We sent a code to ${email}.`), form);
  code.focus();
}

async function waitForSeat() {
  const started = Date.now();
  show(h("p", "eyebrow", "Almost there"), h("h1", "card__title", "Setting up your map…"), h("div", "steps-wait", null, {}, [h("div", "dots", null, { "aria-hidden": "true" }), h("span", "", "Carrying over what your free check found.")]));
  while (Date.now() - started < WAIT_MS) {
    const me = await Account.me(API);
    if (!me) return signInView("Your sign-in expired. Sign in again.");
    if (me.seat?.plan === "complete") return welcomeView(me);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  show(
    h("p", "eyebrow", "Still working on it"),
    h("h1", "card__title", "Your payment went through; your map is taking longer than usual."),
    h("p", "card__lead", "Reply to your receipt email and a person will have you in within the hour. Nothing is lost."),
    h("div", "card__row", null, {}, [button("Check again", waitForSeat, false)])
  );
}

function nextBlock() {
  const steps = [
    [`By ${reviewLabel()}`, "Aden goes through your map himself and changes anything the check got wrong."],
    ["This week", "We start on the work marked Prepared for you on each step. When a piece is ready, it shows up on your map."],
    ["Your part", "Only what needs you: sending from your own accounts, and confirming facts about yourself."],
  ];
  return h("section", "next", null, { "aria-label": "What happens next" }, [
    h("p", "card__sub next__title", "What happens next"),
    h("ol", "next__list", null, {}, steps.map(([when, what]) => h("li", "", null, {}, [h("span", "next__when", when), h("span", "next__what", what)]))),
  ]);
}

function welcomeView(me) {
  const video = link("welcomeVideo");
  const first = (me.name || "").trim().split(/\s+/)[0];
  const error = h("p", "card__error", "", { role: "alert" });
  const open = button("Open my map →", async () => {
    if (me.demo) return (location.href = "../app/?s=demo&map=complete");
    open.disabled = true;
    open.textContent = "Opening…";
    error.textContent = "";
    try {
      const res = await fetch(`${API}/account/seat`, { method: "POST", headers: { authorization: `Bearer ${Account.session()?.token || ""}`, "content-type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) return signInView("Your sign-in expired. Sign in again and your map opens.");
      if (!res.ok) throw new Error(body.error || "Your map didn't open. Try again in a moment.");
      // The same seat whether it was made at checkout or was their free seat until now (billing_api.py).
      const slug = await enterSeat(body);
      const board = new URL("../app/", location.href);
      board.searchParams.set("s", slug);
      // On this Mac the board talks to the same local API as this page, never production.
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) board.searchParams.set("api", API);
      location.href = board.toString();
    } catch (problem) {
      open.disabled = false;
      open.textContent = "Open my map →";
      error.textContent = say(problem);
    }
  });
  show(
    me.demo ? h("p", "card__fine", "Demo walkthrough: nothing was charged. The map that opens is a made-up example.", { style: "margin: 0 0 14px" }) : null,
    h("p", "eyebrow", "You're in"),
    h("h1", "card__title", first ? `Welcome, ${first}.` : "Welcome."),
    h("p", "card__lead", startingOn(me)),
    video ? h("iframe", "video", null, { src: video, title: "A welcome from Aden", allow: "fullscreen; picture-in-picture", loading: "lazy" }) : null,
    nextBlock(),
    h("div", "card__row", null, {}, [open]),
    error,
    h("p", "card__fine", "Changed your mind? On the one-time price you have 14 days to ask for a full refund. On the monthly plan, cancel any time from the link in your email. Or reply to any email from us.")
  );
}

async function boot() {
  const params = new URLSearchParams(location.search);
  // Walkthroughs (from demo/checkout/): the real welcome, with the demo name and the check's top finding.
  if (params.get("demo") === "1") {
    const top = (params.get("top") || "").replace(/[^a-z]/g, "").slice(0, 20);
    return welcomeView({ demo: true, name: (params.get("name") || "Sam Rivera").slice(0, 60), checks: top ? [{ top: [{ id: top }] }] : [] });
  }
  const signin = params.get("signin");
  if (signin) {
    params.delete("signin");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    await Account.verifyLink(API, signin).catch(() => null);
  }
  if (!Account.session()) return signInView(signin ? "That sign-in link has expired or was used. Ask for a code instead." : "");
  waitForSeat();
}

boot();
