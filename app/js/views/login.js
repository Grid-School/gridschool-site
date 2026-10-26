/**
 * Invite set-password and return login. Demo never lands here.
 */

import { el, mount } from "../dom.js?v=200c41d-202610261730";
import { gmark, wordmark } from "../../../js/brand.js?v=200c41d-202610261730";
import {
  enterSeat,
  loginWithPassword,
  peekInvite,
  redeemInvite,
  requestLoginLink,
} from "../persist-auth.js?v=200c41d-202610261730";

const FIELD =
  "width:100%;font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:11px 13px;";

function input(attrs) {
  return el("input", { style: FIELD, ...attrs });
}

function label(forId, text) {
  return el(
    "label",
    { for: forId, style: "display:block;font-size:14px;margin:12px 0 6px;color:var(--text)" },
    text
  );
}

function foot() {
  return el(
    "p.picker__foot",
    {},
    "Not a student yet? ",
    el("a", { href: "./?s=demo" }, "Walk the demo board"),
    " or ",
    el("a", { href: "../#offer" }, "see what you get"),
    "."
  );
}

function shell(title, lead, ...children) {
  return el(
    "div.gate",
    {},
    el(
      "div.picker",
      {},
      el("div.picker__brand", {}, gmark({ className: "picker__logo" }), wordmark()),
      el("h1", {}, title),
      el("p.muted", {}, lead),
      ...children,
      foot()
    )
  );
}

/**
 * GridSchool Complete has no passwords: buyers sign in with an emailed code on
 * begin/. Offered first so nobody who joined through the free check is asked
 * for a password we told them they would never need. Residency keeps the form.
 */
function codeDoor() {
  const api = new URLSearchParams(location.search).get("api");
  const href = `../begin/${api ? `?api=${encodeURIComponent(api)}` : ""}`;
  return el(
    "a.picker__row",
    { href, style: "display:block;margin:22px 0 6px;text-decoration:none" },
    el("b", {}, "Joined through the free check? Sign in with a code"),
    el("span", {}, "We email you a 6-digit code. No password.")
  );
}

function goBoard(slug) {
  const url = new URL(location.href);
  url.searchParams.delete("invite");
  url.searchParams.set("s", slug);
  url.hash = "";
  location.assign(`${url.pathname}${url.search}`);
}

export function renderLogin(app, { invite = "", email = "" } = {}) {
  if (invite) {
    renderRedeem(app, invite);
    return;
  }
  renderReturn(app, email);
}

function renderRedeem(app, invite) {
  const email = input({
    id: "login-email",
    type: "email",
    autocomplete: "username",
    readOnly: true,
    placeholder: "Loading your email…",
  });
  const password = input({
    id: "login-password",
    type: "password",
    autocomplete: "new-password",
    placeholder: "At least 8 characters",
  });
  const confirm = input({
    id: "login-confirm",
    type: "password",
    autocomplete: "new-password",
    placeholder: "Same password again",
  });
  const err = el("p.login__err", { hidden: true }, "");
  /* A seat enrolled without an email takes the one typed here; it's how they sign in from then on. */
  let needsEmail = false;
  const emailHint = el("p.login__hint", { hidden: true, style: "margin:4px 0 0;font-size:13px;color:var(--muted)" },
    "This is the email you'll sign in with from now on.");

  peekInvite(invite)
    .then((row) => {
      email.value = row.email || "";
      needsEmail = !row.email;
      email.placeholder = needsEmail ? "you@example.com" : "";
      email.readOnly = !needsEmail;
      emailHint.hidden = !needsEmail;
      if (needsEmail) email.focus();
    })
    .catch((error) => {
      // A used or expired link is not a dead end: it becomes the normal sign-in,
      // which says why. Students often keep the first link as their board link.
      const used = /not found|not valid/i.test(error.message || "");
      renderReturn(app, "", used ? "This link was already used to set your password. Sign in with your email and that password." : "That link has expired. Sign in with your email and password, or get a new link below.");
    });

  const form = el(
    "form.login-form",
    {
      style: "margin-top:8px",
      onsubmit: async (event) => {
        event.preventDefault();
        err.hidden = true;
        if (needsEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
          err.textContent = "Enter the email you'll sign in with.";
          err.hidden = false;
          email.focus();
          return;
        }
        if (password.value.length < 8) {
          err.textContent = "Password must be at least 8 characters.";
          err.hidden = false;
          password.focus();
          return;
        }
        if (password.value !== confirm.value) {
          err.textContent = "Those two passwords do not match.";
          err.hidden = false;
          confirm.focus();
          return;
        }
        try {
          const result = await redeemInvite(invite, password.value, needsEmail ? email.value.trim() : "");
          await enterSeat(result);
          goBoard(result.slug);
        } catch (error) {
          err.textContent = error.message || "Could not open the board.";
          err.hidden = false;
        }
      },
    },
    label("login-email", "Email"),
    email,
    emailHint,
    label("login-password", "Password"),
    password,
    label("login-confirm", "Confirm password"),
    confirm,
    err,
    el("button.b.b--solid", { type: "submit", style: "margin-top:14px" }, "Open my board")
  );

  mount(
    app,
    shell("Set your password", "Pick a password. You'll sign in with your email and this password from now on.", form)
  );
}

function renderReturn(app, presetEmail, notice = "") {
  const email = input({
    id: "login-email",
    type: "email",
    autocomplete: "username",
    placeholder: "you@example.com",
    value: presetEmail,
  });
  const password = input({
    id: "login-password",
    type: "password",
    autocomplete: "current-password",
    placeholder: "Your password",
  });
  const err = el("p.login__err", { hidden: true }, "");

  const form = el(
    "form.login-form",
    {
      style: "margin-top:8px",
      onsubmit: async (event) => {
        event.preventDefault();
        err.hidden = true;
        try {
          const result = await loginWithPassword(email.value.trim(), password.value);
          await enterSeat(result);
          goBoard(result.slug);
        } catch (error) {
          err.textContent = error.message || "Email or password is wrong.";
          err.hidden = false;
        }
      },
    },
    el("p.muted", { style: "margin-top:22px;font-size:13px" }, "Residency students: email and password."),
    label("login-email", "Email"),
    email,
    label("login-password", "Password"),
    password,
    err,
    el("button.b.b--solid", { type: "submit", style: "margin-top:14px" }, "Open my board")
  );

  const forgot = el(
    "p.picker__foot",
    { style: "margin-top:16px" },
    el(
      "button.b.b--quiet",
      {
        type: "button",
        onclick: async () => {
          err.hidden = true;
          const value = email.value.trim();
          if (!value) {
            err.textContent = "Enter the email on your seat first.";
            err.hidden = false;
            email.focus();
            return;
          }
          try {
            await requestLoginLink(value);
            err.style.color = "var(--muted)";
            err.textContent = "If that email is on an account, a new link is on the way. Nothing after 5 minutes? Check spam, then ask your coach for a new link.";
            err.hidden = false;
          } catch (error) {
            err.style.color = "";
            err.textContent = error.message || "Could not send a login link.";
            err.hidden = false;
          }
        },
      },
      "Email me a login link"
    )
  );

  mount(
    app,
    shell("Open your board", notice || "Two ways in, depending on how you joined.", codeDoor(), form, forgot)
  );
}
