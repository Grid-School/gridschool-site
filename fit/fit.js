/**
 * fit/: the step before any call (server/fit_api.py). Reached from the free check's offer with ?id=<check id>,
 * or with this browser's saved check. Three screens: the intro (film 1, as text until it's filmed), the questions
 * and two taps, and the next step for the route the answers lead to. A parent payer gets the "ask your parents"
 * kit on the call screen: a note in the grad's own numbers and a link to the parent page.
 */

import { PERSIST } from "../config.js?v=fc7db25-202610310827";
import { track } from "../check/events.js?v=fc7db25-202610310827";
import { savedCheck } from "../sprint/sprint-model.mjs?v=fc7db25-202610310827";
import { FILM_URL, HOURS, INTRO, PAYERS, QUESTIONS, parentScript, payload, result } from "./fit-model.mjs?v=fc7db25-202610310827";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = (() => {
  const asked = new URLSearchParams(location.search).get("api");
  if (LOCAL) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const card = document.getElementById("card");
const local = (href) => (LOCAL ? `${href}${href.includes("?") ? "&" : "?"}api=${encodeURIComponent(API)}` : href);

const checkId = (() => {
  const asked = new URLSearchParams(location.search).get("id") || "";
  if (/^ck_[A-Za-z0-9_-]{16,40}$/.test(asked)) return asked;
  try {
    return savedCheck(localStorage.getItem("gridschool.check.v1"));
  } catch {
    return "";
  }
})();

let info = null;
let read = false;
const values = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.starter]));

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong on our side. Try again in a minute."), { status: res.status });
  return data;
}

function say(problem) {
  const text = String(problem?.message || "");
  if (problem instanceof TypeError || /fetch|network|load failed/i.test(text) || !text) return "We couldn't reach our server. Your answers are still here; try again in a moment.";
  return text;
}

/* ---------- tiny DOM ---------- */

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "value") node.value = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function show(...children) {
  card.replaceChildren(...children.flat().filter(Boolean));
  const head = card.querySelector("h1");
  if (head) {
    head.tabIndex = -1;
    head.focus({ preventScroll: true });
  }
  scrollTo({ top: 0, behavior: "auto" });
}

const eyebrow = (text) => h("p", { class: "eyebrow" }, text);
const btn = (label, onclick, { solid = true } = {}) => h("button", { class: `btn ${solid ? "btn--solid" : "btn--line"}`, type: "button", onclick }, label, solid ? h("span", { class: "arr", "aria-hidden": "true" }, " →") : null);
const link = (label, href, { solid = false, newTab = false } = {}) => h("a", { class: solid ? "btn btn--solid" : "plan__alt", href, target: newTab ? "_blank" : null, rel: newTab ? "noopener" : null }, label);

function choice(name, options, current, onPick) {
  return h("div", { class: "sp__opts", role: "radiogroup" }, options.map((option) =>
    h("label", { class: "sp__opt" },
      h("input", { type: "radio", name, value: option.value, checked: current === option.value ? true : null, onchange: () => onPick(option.value) }),
      h("span", {}, option.label))));
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied. Paste it in a text or email.";
  } catch {
    button.textContent = "Couldn't copy here. Select the text above instead.";
  }
}

/* ---------- screens ---------- */

function nobody() {
  show(
    eyebrow("Before a call"),
    h("h1", {}, "Start with the free check."),
    h("p", { class: "sp__lede" }, "This step comes after the free check. The check takes about two minutes, and you keep your map either way."),
    h("div", { class: "sp__acts" }, link("Take the free check", local("../check/"), { solid: true })),
  );
}

function intro() {
  const box = h("input", { type: "checkbox", checked: read ? true : null, onchange: (e) => { read = e.target.checked; next.disabled = !read; } });
  const next = btn("Answer three questions", () => { track(API, "fit.read", { check: checkId }); questions(); });
  next.disabled = !read;
  show(
    eyebrow("Before a call"),
    h("h1", {}, INTRO.title),
    FILM_URL ? h("div", { class: "fit__film" }, h("iframe", { src: FILM_URL, title: INTRO.title, allow: "fullscreen", loading: "lazy" })) : null,
    INTRO.paras.map((p) => h("p", { class: "sp__lede fit__para" }, p)),
    h("p", { class: "sp__h" }, "What it asks of you"),
    h("ul", { class: "sp__list" }, INTRO.asks.map((a) => h("li", {}, a))),
    h("div", { class: "sp__box sp__box--rule" }, INTRO.notFor),
    h("label", { class: "sp__check" }, box, h("span", {}, "I read this, and it sounds like me.")),
    h("div", { class: "sp__acts" }, next),
  );
}

function questions() {
  const error = h("p", { class: "sp__error", role: "alert" });
  const field = (q) => {
    const attrs = { id: `fit-${q.id}`, value: values[q.id], oninput: (e) => { values[q.id] = e.target.value; } };
    const input = q.short ? h("input", { type: "text", ...attrs }) : h("textarea", { rows: 3, ...attrs });
    return h("div", { class: "sp__q" },
      h("label", { class: "sp__label", for: `fit-${q.id}` }, q.label),
      input,
      h("p", { class: "sp__help fit__example" }, q.example));
  };
  const submit = btn("See my next step", async () => {
    const out = payload(values, { read, watched: FILM_URL ? 0 : 100 });
    if (out.problem) return (error.textContent = out.problem);
    submit.disabled = true;
    error.textContent = "";
    try {
      const next = await call(`/fit/${checkId}`, out.body);
      track(API, "fit.answered", { check: checkId, props: { route: next.route } });
      done(next);
    } catch (problem) {
      submit.disabled = false;
      error.textContent = say(problem);
    }
  });
  show(
    eyebrow("Three questions, in your own words"),
    h("h1", {}, "Tell me a little about you."),
    h("p", { class: "sp__lede" }, "A sentence or two each is enough. Write it the way you'd say it. I read every one."),
    QUESTIONS.map(field),
    h("fieldset", { class: "sp__q" }, h("legend", {}, "How many hours a week can you give this?"), choice("hours", HOURS, values.hours, (v) => { values.hours = v; })),
    h("fieldset", { class: "sp__q" }, h("legend", {}, "If you saw a plan you believed would get you into the industry, how would it be paid for?"),
      h("p", { class: "sp__help" }, "No wrong answer. It decides which next step fits, and nothing is charged here."),
      choice("payer", PAYERS, values.payer, (v) => { values.payer = v; })),
    error,
    h("div", { class: "sp__acts" }, submit, h("button", { class: "sp__back", type: "button", onclick: intro }, "Back")),
  );
}

function parentKit(next) {
  const note = parentScript(info?.facts, next.parentLink);
  const copyBtn = h("button", { class: "btn btn--line", type: "button", onclick: () => copy(note, copyBtn) }, "Copy the note");
  return [
    h("p", { class: "sp__h" }, "Bring your parent in"),
    h("p", { class: "sp__help" }, "Send this yourself, in your own words if you like. The link opens a short page written for parents. The call starts with you, and the decision is yours."),
    h("div", { class: "sp__box fit__note" }, note),
    h("div", { class: "sp__acts" }, copyBtn, link("See the parent page", next.parentLink, { newTab: true })),
  ];
}

function done(next) {
  const words = result(next, info?.first || "");
  const acts = [];
  if (next.route === "call" && next.booking) acts.push(link("Pick a time", next.booking, { solid: true, newTab: true }));
  if (next.route === "sprint") acts.push(link("Apply for the free sprint", local("../sprint/apply/?from=fit"), { solid: true }));
  if (next.route === "self") acts.push(link("See the self-serve plan", local(`../check/?id=${checkId}`), { solid: true }));
  if (next.route === "free" || next.route === "sprint") acts.push(link("Open my free map", local(`../check/?id=${checkId}`)));
  show(
    h("span", { class: `sp__badge${next.route === "call" ? "" : next.route === "free" ? " sp__badge--no" : " sp__badge--wait"}` }, words.badge),
    h("h1", {}, words.title),
    h("p", { class: "sp__lede" }, words.lede),
    acts.length ? h("div", { class: "sp__acts" }, acts) : null,
    next.route === "call" && next.parentLink ? parentKit(next) : null,
  );
}

async function start() {
  if (!checkId) return nobody();
  try {
    info = await call(`/fit/${checkId}`);
  } catch (problem) {
    if (problem.status === 404) return nobody();
    show(eyebrow("Before a call"), h("h1", {}, "One moment."), h("p", { class: "sp__lede" }, say(problem)));
    return;
  }
  track(API, "fit.view", { check: checkId });
  if (info.fit) return done(info.fit);
  intro();
}

start();
