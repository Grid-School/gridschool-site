/**
 * Invite set-password and return login. Demo never lands here.
 */

import { el, mount } from "../dom.js";
import { gmark, wordmark } from "../../../js/brand.js";
import {
  enterSeat,
  loginWithPassword,
  peekInvite,
  redeemInvite,
  requestLoginLink,
} from "../persist-auth.js";

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

  peekInvite(invite)
    .then((row) => {
      email.value = row.email || "";
      email.placeholder = row.email ? "" : "Your email";
      if (!row.email) email.readOnly = false;
    })
    .catch((error) => {
      err.textContent = error.message || "That invite is not valid or has expired.";
      err.hidden = false;
    });

  const form = el(
    "form.login-form",
    {
      style: "margin-top:8px",
      onsubmit: async (event) => {
        event.preventDefault();
        err.hidden = true;
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
          const result = await redeemInvite(invite, password.value);
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
    label("login-password", "Password"),
    password,
    label("login-confirm", "Confirm password"),
    confirm,
    err,
    el("button.b.b--solid", { type: "submit", style: "margin-top:14px" }, "Open my board")
  );

  mount(
    app,
    shell("Set your password", "Your email is already on the seat. Pick a password. That is the whole door.", form)
  );
}

function renderReturn(app, presetEmail) {
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
            err.textContent = "If that email has a seat, a new link is on the way. Check that inbox.";
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
    shell("Open your board", "Email and password. The keys stay on the school side.", form, forgot)
  );
}
