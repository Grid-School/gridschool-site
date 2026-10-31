/**
 * Where people land after paying for GridSchool Complete (server: billing.py, billing_api.py).
 *
 * 1. Sign in: the link in the welcome email does it, or the email they paid with gets a code.
 * 2. Wait for the seat: the payment webhook makes it, usually within seconds.
 * 3. Welcome: their first name, the first thing their own check found (or, with no check, that the
 *    map starts with a few questions), the welcome video when LINKS.welcomeVideo is set, and what
 *    happens next (welcome-copy.js). Complete is self-serve, so nothing here promises a review.
 *    People read most right after they buy; this is the page they reread.
 * 4. Open the map: the account becomes a board session (POST /account/seat) and the board opens.
 *    If that hand-off says the sign-in expired, the sign-in form comes back.
 *
 * Someone who had a free map pays from it (Have us do this): the payment turns that same seat
 * into the paid one (billing_api.py), so step 2 waits for its plan to read 'complete' and
 * step 4 opens the board they already had, with everything they did on it.
 *
 * Typed the wrong email at checkout: Stripe sends a Complete buyer here with ?session_id=cs_... (ops/stripe-setup.py),
 * so "Didn't get your sign-in email?" shows the email we have, masked, and moves the map to the right one
 * (recovery.js; server billing_api.checkout_fix). The session id is the proof they paid; it works for a week.
 *
 * Only for a payment: someone who reaches this page with no payment on its way (checkout/ marked
 * none in this browser, Stripe didn't send them, no welcome-email link) goes to signin/, which opens
 * whatever map the email has. The same goes for anyone whose account turns out to be free or
 * Residency once signed in (route.mjs decides for both pages), so nobody waits here for a payment
 * that never happened.
 */

import { PERSIST, link } from "../config.js?v=c7fe5aa-202610310430";
import * as Account from "../check/account.js?v=c7fe5aa-202610310430";
import { enterSeat } from "../app/js/persist-auth.js?v=c7fe5aa-202610310430";
import { startingOn, nextSteps, WAIT_LINE } from "./welcome-copy.js?v=c7fe5aa-202610310430";
import { track } from "../check/events.js?v=c7fe5aa-202610310430";
import { routeFor, fromStripe, sitePath } from "../signin/route.mjs?v=c7fe5aa-202610310430";
import { rememberSession, peek, fix, peekView, COPY } from "./recovery.js?v=c7fe5aa-202610310430";

// Localhost never talks to production: ?api= when given, else the page's own origin.
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  if (local) return (asked || location.origin).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const card = document.getElementById("card");
const WAIT_MS = 90_000;
// The checkout session from Stripe's after-payment link (kept for this tab): the proof for fixing a mistyped email.
const ARRIVED_WITH_SESSION = new URLSearchParams(location.search).has("session_id");
const SESSION = rememberSession(location.search);
// A payment on its way: checkout/ marked it in this browser, or Stripe's page just sent them here.
const PAYING = Account.paying() || fromStripe(document.referrer) || (ARRIVED_WITH_SESSION && Boolean(SESSION));
const toSignin = () => location.replace(sitePath("../signin/", location, API));

/** Our words for a failure, never the browser's ("Failed to fetch"). */
function say(problem) {
  const message = problem?.message || "";
  if (!message || problem instanceof TypeError || /fetch|network|load failed/i.test(message)) return "We couldn't reach our server. Nothing is lost; try again in a moment.";
  return message;
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

/** "Didn't get your sign-in email?": only for someone who arrived from Stripe's after-payment link. */
const textlink = (label, onClick) => {
  const node = h("button", "textlink", label, { type: "button" });
  node.addEventListener("click", onClick);
  return node;
};

function recoveryLink() {
  if (!SESSION) return null;
  const node = h("button", "btn btn--line", COPY.ask, { type: "button", style: "margin-top: 18px" });
  node.addEventListener("click", recoveryView);
  return node;
}

async function recoveryView() {
  show(h("p", "eyebrow", "Your sign-in"), h("h1", "card__title", COPY.checking));
  let answer = null;
  try {
    answer = await peek(API, SESSION);
  } catch (problem) {
    return show(h("p", "eyebrow", "Your sign-in"), h("h1", "card__title", COPY.ask), h("p", "card__error", say(problem), { role: "alert" }), h("div", "card__row", null, {}, [button("Try again", recoveryView, false), button("Back", () => signInView(), false)]));
  }
  const view = peekView(answer);
  if (!answer) {
    return show(h("p", "eyebrow", "Your sign-in"), h("h1", "card__title", view.title), h("p", "card__lead", view.lead), h("div", "card__row", null, {}, [button("Try again", recoveryView, false), button("Back", () => signInView(), false)]));
  }
  if (!view.canFix) {
    return show(h("p", "eyebrow", "Your sign-in"), h("h1", "card__title", view.title), h("p", "card__lead", view.why), h("div", "card__row", null, {}, [button("Back", () => signInView(), false)]));
  }
  const form = h("form", "save", null, { novalidate: "" });
  const email = h("input", "", null, { type: "email", autocomplete: "email", placeholder: COPY.placeholder, "aria-label": COPY.placeholder });
  const error = h("p", "card__error", "", { role: "alert" });
  const go = h("button", "btn btn--solid", COPY.fix, { type: "submit" });
  form.append(h("div", "save__row", null, {}, [email, go]), error);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const value = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return (error.textContent = "That email doesn't look right.");
    go.disabled = true;
    try {
      // The server records the change on the seat's timeline (activity email.changed) and tells your coach.
      const moved = await fix(API, SESSION, value);
      codeView(moved.email || value, moved.sent ? COPY.moved(moved.email || value) : "We moved your map there, but the code didn't send. Reply to your receipt email and we'll get you in.");
    } catch (problem) {
      error.textContent = say(problem);
      go.disabled = false;
    }
  });
  show(
    h("p", "eyebrow", "Your sign-in"),
    h("h1", "card__title", view.title),
    h("p", "card__lead", view.lead),
    form,
    h("div", "card__row", null, {}, [button(COPY.right, () => signInView(COPY.spam), false)])
  );
  email.focus();
}

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
      const { sent } = await Account.sendCode(API, value, "begin");
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
    form,
    recoveryLink()
  );
  email.focus();
}

function codeView(email, note = "") {
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
  // A code that never comes, or an email typed wrong, shouldn't need a reload (signin.js has the same two links).
  const links = h("div", "card__row", null, {}, [
    textlink("Send a new code", async () => {
      error.textContent = "";
      try {
        const { sent } = await Account.sendCode(API, email, "begin");
        error.textContent = sent ? "A new code is on its way." : "We couldn't send a code just now. Reply to your receipt email and we'll get you in.";
      } catch (problem) {
        error.textContent = say(problem);
      }
    }),
    textlink("Use a different email", () => signInView()),
  ]);
  show(
    h("p", "eyebrow", "Check your email"),
    h("h1", "card__title", `We sent a code to ${email}.`),
    note ? h("p", "card__lead", note) : null,
    h("p", "card__help", "It works for 15 minutes. Nothing after a minute? Check spam."),
    form,
    links,
    recoveryLink()
  );
  code.focus();
}

async function waitForSeat() {
  const started = Date.now();
  show(h("p", "eyebrow", "Almost there"), h("h1", "card__title", "Setting up your map…"), h("div", "steps-wait", null, {}, [h("div", "dots", null, { "aria-hidden": "true" }), h("span", "", WAIT_LINE)]));
  let me = null;
  while (Date.now() - started < WAIT_MS) {
    me = await Account.me(API);
    if (!me) return signInView("Your sign-in expired. Sign in again.");
    const next = routeFor(me, { paying: PAYING });
    if (next === "paid") {
      Account.donePaying();
      return welcomeView(me);
    }
    // Not a payment after all (a free map, a Residency board, or nothing yet): signin/ opens the right one.
    if (next !== "wait") return toSignin();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  show(
    h("p", "eyebrow", "Still working on it"),
    h("h1", "card__title", "Your map is taking longer than usual."),
    h("p", "card__lead", "If your payment went through, reply to your receipt email and a person will have you in within the hour. Nothing is lost."),
    h("div", "card__row", null, {}, [
      button("Check again", waitForSeat, false),
      // Left Stripe without paying: the free map (or the free check) is still theirs.
      button(me?.seat?.plan === "free" ? "Open my free map instead" : "I didn't finish paying", () => {
        Account.donePaying();
        toSignin();
      }, false),
    ]),
    // Signed in as one email and waiting, but the payment went to another (a typo at checkout).
    recoveryLink()
  );
}

function nextBlock(me) {
  const steps = nextSteps(me);
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
    video ? h("iframe", "video", null, { src: video, title: "A welcome from your coach", allow: "fullscreen; picture-in-picture", loading: "lazy" }) : null,
    nextBlock(me),
    h("div", "card__row", null, {}, [open]),
    error,
    h("p", "card__fine", "Changed your mind? On the one-time price you have 14 days to ask for a full refund. On the monthly plan, cancel any time from the link in your email. Or reply to any email from us.")
  );
}

async function boot() {
  const params = new URLSearchParams(location.search);
  // Signed out with no payment on its way and no welcome-email link: this isn't a welcome, it's a sign-in.
  if (params.get("demo") !== "1" && !params.get("signin") && !PAYING && !Account.session()) return toSignin();
  // The event log (server/events.py ONBOARDING): someone who paid reached this page.
  track(API, "begin.view", { source: params.get("from") || "" });
  // Walkthroughs (from demo/checkout/): the real welcome, with the demo name and the check's top finding.
  if (params.get("demo") === "1") {
    const top = (params.get("top") || "").replace(/[^a-z]/g, "").slice(0, 20);
    return welcomeView({ demo: true, name: (params.get("name") || "Sam Rivera").slice(0, 60), checks: top ? [{ top: [{ id: top }] }] : [] });
  }
  if (params.has("session_id")) {
    // Kept for this tab (recovery.js); off the address bar, so a copied link doesn't carry it.
    params.delete("session_id");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
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
