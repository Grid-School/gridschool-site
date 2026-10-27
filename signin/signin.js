/**
 * gridschool.org/signin: the one way back in, free or paid, from any computer.
 *
 * 1. Email, then a 6-digit code (or the link in the same email, ?signin=, or Google where it works).
 *    The session is the same one the check and begin/ use (check/account.js); nothing here talks to
 *    the API except through it and the two board hand-offs below.
 * 2. Then wherever the account belongs (route.mjs, from GET /account/me):
 *    a Complete map opens through POST /account/seat; a free map (or a saved check that makes one)
 *    through POST /account/free-seat; a payment still landing waits on begin/; a Residency board goes
 *    to the password sign-in on app/; nothing yet says so and offers the free check.
 * The server counts the sign-in itself (account.signin, events.py) with from "signin".
 */

import { PERSIST } from "../config.js?v=33b0498-202610272054";
import * as Account from "../check/account.js?v=33b0498-202610272054";
import { enterSeat } from "../app/js/persist-auth.js?v=33b0498-202610272054";
import { routeFor, sitePath } from "./route.mjs?v=33b0498-202610272054";

// Localhost never talks to production: ?api= when given, else the page's own origin.
const API = (() => {
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const asked = new URLSearchParams(location.search).get("api");
  if (local) return (asked || location.origin).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const FROM = "signin";
const card = document.getElementById("card");
const go = (path, params) => location.assign(sitePath(path, location, API, params));

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
const textlink = (label, onClick) => {
  const node = h("button", "textlink", label, { type: "button" });
  node.addEventListener("click", onClick);
  return node;
};

/** Residency students keep their password sign-in on the board itself. */
function passwordDoor() {
  return h("p", "card__fine signin__alt", null, {}, [
    h("a", "", "Residency students: sign in with your password", { href: sitePath("../app/", location, API) }),
  ]);
}

function emailView(message = "", preset = "") {
  const form = h("form", "save", null, { novalidate: "" });
  const email = h("input", "", null, { type: "email", name: "email", autocomplete: "email", placeholder: "Your email", "aria-label": "Email", value: preset });
  const error = h("p", "card__error", message, { role: "alert" });
  const send = h("button", "btn btn--solid", "Send my code", { type: "submit" });
  const googleSlot = h("div", "google-slot");
  form.append(h("div", "save__row", null, {}, [email, send]), error, googleSlot);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const value = email.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) return (error.textContent = "That email doesn't look right.");
    send.disabled = true;
    try {
      const { sent } = await Account.sendCode(API, value, "signin");
      if (!sent) throw new Error("We couldn't send a code just now. Try again in a few minutes, or write to support@gridschool.org.");
      codeView(value);
    } catch (problem) {
      error.textContent = say(problem);
      send.disabled = false;
    }
  });
  Account.mountGoogle(googleSlot, async (credential) => {
    error.textContent = "";
    try {
      await Account.google(API, credential, FROM);
      route();
    } catch (problem) {
      error.textContent = say(problem);
    }
  });
  show(
    h("p", "eyebrow", "Sign in"),
    h("h1", "card__title", "Open your map."),
    h("p", "card__lead", "Use the email from your free check or your purchase. We'll send you a 6-digit code; no password."),
    form,
    h("p", "card__fine", null, {}, ["New here? ", h("a", "", "Take the free check", { href: sitePath("../check/", location, API) }), ". It's free, and it builds your map."]),
    passwordDoor()
  );
  email.focus();
  // Back to fix a typo: the old email is selected, so typing replaces it and the arrow keys edit it.
  if (preset) email.select();
}

function codeView(email) {
  const form = h("form", "save", null, { novalidate: "" });
  const code = h("input", "code-input", null, { name: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, placeholder: "6-digit code", "aria-label": "6-digit code" });
  const error = h("p", "card__error", "", { role: "alert" });
  const confirm = h("button", "btn btn--solid", "Confirm", { type: "submit" });
  form.append(h("div", "save__row", null, {}, [code, confirm]), error);
  code.addEventListener("input", () => {
    code.value = code.value.replace(/\D/g, "").slice(0, 6);
    if (code.value.length === 6) form.requestSubmit();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (!/^\d{6}$/.test(code.value)) return (error.textContent = "Enter the 6-digit code from the email.");
    confirm.disabled = true;
    try {
      await Account.verifyCode(API, email, code.value, FROM);
      route();
    } catch (problem) {
      error.textContent = say(problem);
      confirm.disabled = false;
    }
  });
  show(
    h("p", "eyebrow", "Check your email"),
    h("h1", "card__title", `We sent a code to ${email}.`),
    h("p", "card__help", "It works for 15 minutes. The email also has a link if you'd rather tap. Nothing after a minute? Check spam."),
    form,
    h("div", "card__row", null, {}, [
      textlink("Send a new code", async () => {
        error.textContent = "";
        try {
          const { sent } = await Account.sendCode(API, email, "signin");
          error.textContent = sent ? "A new code is on its way." : "We couldn't send a code just now.";
        } catch (problem) {
          error.textContent = say(problem);
        }
      }),
      textlink("Use a different email", () => emailView("", email)),
    ])
  );
  code.focus();
}

function opening() {
  show(h("p", "eyebrow", "Signed in"), h("h1", "card__title", "Opening your map…"), h("div", "steps-wait", null, {}, [h("div", "dots", null, { "aria-hidden": "true" }), h("span", "", "One moment.")]));
}

/** A board hand-off: POST it with the account session, store the board's own session, open the board. */
async function openBoard(path, body = {}) {
  opening();
  const token = Account.session()?.token || "";
  const res = await fetch(`${API}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401) return emailView("Your sign-in expired. Sign in again and your map opens.");
  if (res.status === 404 && path === "/account/free-seat") return noneView(Account.session()?.email || "");
  if (!res.ok) throw new Error(out.error || "Your map didn't open. Try again in a moment.");
  const slug = await enterSeat(out);
  go("../app/", { s: slug });
}

function noneView(email) {
  show(
    h("p", "eyebrow", "Signed in"),
    h("h1", "card__title", "We don't have a map for that email yet."),
    h("p", "card__lead", email ? `Nothing is saved under ${email}. Your map starts with the free check, or you may have used a different email.` : "Your map starts with the free check, or you may have used a different email."),
    h("div", "card__row", null, {}, [
      button("Take the free check", () => go("../check/")),
      button("Check the spelling", async () => {
        await Account.signOut(API);
        emailView("", email);
      }, false),
    ]),
    passwordDoor()
  );
}

function passwordView() {
  show(
    h("p", "eyebrow", "Signed in"),
    h("h1", "card__title", "Your board signs in with your password."),
    h("p", "card__lead", "Residency boards open with your email and the password you set. Forgot it? The same page emails you a new link."),
    h("div", "card__row", null, {}, [button("Sign in with my password", () => go("../app/"))])
  );
}

function failedView(problem, retry) {
  show(
    h("p", "eyebrow", "Signed in"),
    h("h1", "card__title", "Your map didn't open."),
    h("p", "card__error", say(problem), { role: "alert" }),
    h("div", "card__row", null, {}, [
      button("Try again", retry),
      textlink("Sign in with a different email", async () => {
        await Account.signOut(API);
        emailView();
      }),
    ])
  );
}

async function route() {
  opening();
  const me = await Account.me(API);
  const next = routeFor(me, { paying: Account.paying() });
  try {
    if (next === "signin") return emailView();
    if (next === "paid") return await openBoard("/account/seat");
    if (next === "free") return await openBoard("/account/free-seat", { check: me.checks?.[0]?.id || "" });
    if (next === "wait") return go("../begin/");
    if (next === "password") return passwordView();
    return noneView(me.email);
  } catch (problem) {
    failedView(problem, route);
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const link = params.get("signin");
  if (link) {
    params.delete("signin");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`);
    await Account.verifyLink(API, link, FROM).catch(() => null);
  }
  if (!Account.session()) return emailView(link ? "That sign-in link has expired or was used. Ask for a code instead." : "");
  route();
}

boot();
