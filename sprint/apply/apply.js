/**
 * sprint/apply/: the sprint step, the agreement, and the instant answer (server/sprint_api.py).
 *
 * Reached from the free check (?sprint=1, once the map is saved) or by anyone signed in with a free map.
 * Never asks twice: POST /sprint/me says what we already know and which questions are left, and only those
 * show. Then the agreement in plain words, the typed full name, and the decision on the spot. Who is asking:
 * the signed-in account, else the board's own token, else the saved check's id (this browser's check).
 */

import { PERSIST } from "../../config.js?v=c7fe5aa-202610310430";
import * as Account from "../../check/account.js?v=c7fe5aa-202610310430";
import { track, visitorId } from "../../check/events.js?v=c7fe5aa-202610310430";
import { enterSeat } from "../../app/js/persist-auth.js?v=c7fe5aa-202610310430";
import { currentSession } from "../../app/js/session.js?v=c7fe5aa-202610310430";
import { checkHref, dayText, fullName, identity, resultHead, savedCheck, sourceFrom, stepAnswers, stepProblem } from "../sprint-model.mjs?v=c7fe5aa-202610310430";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = (() => {
  const asked = new URLSearchParams(location.search).get("api");
  if (LOCAL) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const from = sourceFrom(location.search);
const card = document.getElementById("card");

let status = null;
let me = null;
let catalog = null;
let values = {};
let commitment = null;

function check() {
  try {
    return savedCheck(localStorage.getItem("gridschool.check.v1"));
  } catch {
    return "";
  }
}

function who() {
  const board = currentSession()?.persistToken || "";
  return identity({ account: Account.session(), board: Account.session() ? "" : board, check: check() });
}

async function call(path, body) {
  const id = who();
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: id.headers,
    ...(body === undefined ? {} : { body: JSON.stringify({ ...body, check: id.check, from, visitor: visitorId() }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || "Something went wrong on our side. Try again in a minute.");
    error.status = res.status;
    error.data = data;
    throw error;
  }
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
    else if (key === "text") node.textContent = value;
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
const btn = (label, onclick, { solid = true, type = "button" } = {}) => h("button", { class: `btn ${solid ? "btn--solid" : "btn--line"}`, type, onclick }, label, solid ? h("span", { class: "arr", "aria-hidden": "true" }, " →") : null);
const link = (label, href, { solid = false } = {}) => h("a", { class: solid ? "btn btn--solid" : "plan__alt", href }, label);

function choice(name, options, current, onPick) {
  return h("div", { class: "sp__opts", role: "radiogroup" }, options.map((option) =>
    h("label", { class: "sp__opt" },
      h("input", { type: "radio", name, value: option.value, checked: current === option.value ? true : null, onchange: () => onPick(option.value) }),
      h("span", {}, option.label))));
}

function question(id) {
  return (catalog?.questions || []).find((q) => q.id === id);
}

function boardHref(slug, node = "") {
  const url = new URL("../../app/", location.href);
  url.searchParams.set("s", slug);
  url.searchParams.set("from", "sprint");
  if (LOCAL) url.searchParams.set("api", API);
  return url.toString() + (node ? `#/map/${node}` : "");
}

async function openMap(session, node = "") {
  if (!session?.persistToken) {
    location.href = `../../signin/${LOCAL ? `?api=${encodeURIComponent(API)}` : ""}`;
    return;
  }
  const slug = await enterSeat(session);
  location.href = boardHref(slug, node);
}

/* ---------- screens ---------- */

function nobody() {
  show(
    eyebrow("The free sprint"),
    h("h1", {}, "Start with the free check."),
    h("p", { class: "sp__lede" }, "The sprint application is the free check plus one short step. The check takes two minutes, and you keep your map either way."),
    h("div", { class: "sp__acts" }, link("Take the free check", checkHref(from, "../../check/") + (LOCAL ? `&api=${encodeURIComponent(API)}` : ""), { solid: true }), link("I have a map: sign in", `../../signin/${LOCAL ? `?api=${encodeURIComponent(API)}` : ""}`)),
  );
}

function closed() {
  show(
    eyebrow("The free sprint"),
    h("h1", {}, "Applications open soon."),
    h("p", { class: "sp__lede" }, "Your map and your answers are saved. Come back to this page when the sprint opens and it will only ask what's left."),
    h("div", { class: "sp__acts" }, link("Back to the sprint", "../")),
  );
}

function problemScreen(message) {
  show(eyebrow("The free sprint"), h("h1", {}, "That didn't work."), h("p", { class: "sp__lede" }, message), h("div", { class: "sp__acts" }, btn("Try again", () => start())));
}

function stepScreen(note = "") {
  const asked = me.ask || [];
  values = { title: values.title ?? me.title, adjacent: values.adjacent ?? "", clinic: values.clinic ?? "", payer: values.payer ?? "", ...values };
  const error = h("p", { class: "sp__error", role: "alert" }, note);
  const parts = [];
  const known = me.known || {};
  const knownBits = [
    known.role && `Going after: ${me.title}`,
    known.auth === "no" && "No sponsorship needed",
    known.built && "You've built something",
    known.linkedin && "LinkedIn on file",
  ].filter(Boolean);
  if (knownBits.length) parts.push(h("p", { class: "sp__known" }, h("b", {}, "From your check and your map: "), knownBits.join(" · "), ". We won't ask those again."));

  // The target title, pre-filled from the check's role, and one optional adjacent door.
  parts.push(h("div", { class: "sp__q" },
    h("label", { class: "sp__label", for: "title" }, "The title you're going after"),
    h("p", { class: "sp__help" }, "Overnight, we search for roles under this title. Change it if it's not quite right."),
    h("input", { type: "text", id: "title", value: values.title || "", maxlength: "80", oninput: (e) => (values.title = e.target.value) })));
  parts.push(h("div", { class: "sp__q" },
    h("label", { class: "sp__label", for: "adjacent" }, "One more door, if you like (optional)"),
    h("p", { class: "sp__help" }, "Junior roles in these are still hiring. We'll prepare a few of these too."),
    h("select", { id: "adjacent", onchange: (e) => (values.adjacent = e.target.value) },
      h("option", { value: "" }, "No, just my title"),
      (status.adjacent || []).map((title) => h("option", { value: title, selected: values.adjacent === title ? true : null }, title)))));

  if (asked.includes("auth")) {
    const q = question("auth");
    parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, q?.prompt || "Do you need visa sponsorship to work in the US?"), choice("auth", q?.options || [], values.auth, (v) => (values.auth = v))));
  }
  if (asked.includes("hours")) {
    const q = question("hours");
    parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, q?.prompt || "How many hours a week can you give the search?"), choice("hours", q?.options || [], values.hours, (v) => {
      values.hours = v;
      if (v === "5to10" && !asked.includes("hours8")) {
        me.ask = [...asked.slice(0, asked.indexOf("hours") + 1), "hours8", ...asked.slice(asked.indexOf("hours") + 1)];
        stepScreen();
      }
    })));
  }
  if (asked.includes("hours8") || (asked.includes("hours") && values.hours === "5to10")) {
    parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, "Can you give at least 8 hours a week for the six weeks?"),
      choice("hours8", [{ value: "yes", label: "Yes, I can make 8 hours work" }, { value: "no", label: "Not right now" }], values.hours8, (v) => (values.hours8 = v))));
  }
  if (asked.includes("school")) {
    parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, "Where are you with school?"), choice("school", status.school || [], values.school, (v) => (values.school = v))));
  }
  if (asked.includes("built")) {
    parts.push(h("div", { class: "sp__q" },
      h("label", { class: "sp__label", for: "shipped" }, "Name something you've built that someone can open"),
      h("p", { class: "sp__help" }, "One line each. Work, side and school projects all count."),
      h("textarea", { id: "shipped", rows: "3", maxlength: "1500", oninput: (e) => (values.shipped = e.target.value) }, values.shipped || ""),
      h("div", { class: "sp__row", style: "margin-top:8px" }, h("input", { type: "url", id: "link", placeholder: "A link: GitHub, a demo or a write-up (optional)", value: values.link || "", oninput: (e) => (values.link = e.target.value) })),
      h("label", { class: "sp__check" }, h("input", { type: "checkbox", checked: values.nothing ? true : null, onchange: (e) => (values.nothing = e.target.checked) }), h("span", {}, "I haven't built anything someone can open yet."))));
  }
  if (asked.includes("linkedin")) {
    parts.push(h("div", { class: "sp__q" },
      h("label", { class: "sp__label", for: "linkedin" }, "Your LinkedIn link"),
      h("p", { class: "sp__help" }, "So the notes we write match your profile. Skip it if you don't have one yet."),
      h("input", { type: "url", id: "linkedin", placeholder: "https://www.linkedin.com/in/…", value: values.linkedin || "", oninput: (e) => (values.linkedin = e.target.value) })));
  }
  parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, "Which clinic suits you?"),
    h("p", { class: "sp__help" }, "Clinics are where you bring what's stuck. Pick the one you'd usually join."),
    choice("clinic", (status.clinics || []).map((c) => ({ value: c.id, label: c.label })), values.clinic, (v) => (values.clinic = v))));
  parts.push(h("fieldset", { class: "sp__q" }, h("legend", {}, "If you keep going after the sprint, who would pay? (optional)"),
    choice("payer", status.payer || [], values.payer, (v) => (values.payer = v))));

  const submit = btn("Continue", async () => {
    error.textContent = "";
    const problem = stepProblem(me.ask || [], values);
    if (problem) {
      error.textContent = problem;
      return;
    }
    submit.disabled = true;
    try {
      const out = await call("/sprint/step", requestBody());
      if (out.decision === "commit") {
        commitment = out.commitment;
        return commitScreen();
      }
      return resultScreen(out);
    } catch (problem) {
      submit.disabled = false;
      if (problem.data?.missing) {
        me.ask = problem.data.missing;
        return stepScreen(say(problem));
      }
      error.textContent = say(problem);
    }
  });
  show(
    eyebrow("The free sprint · step 2 of 3"),
    h("h1", {}, /^[\p{L}'-]{2,}$/u.test(String(me.name || "").split(" ")[0]) ? `Almost there, ${me.name.split(" ")[0]}.` : "Almost there."),
    h("p", { class: "sp__lede" }, "A few things for the sprint. We only ask what your check didn't already tell us."),
    parts,
    h("div", { class: "sp__acts" }, submit),
    error,
  );
}

function requestBody(extra = {}) {
  return {
    step: stepAnswers(me.ask || [], values),
    titles: { main: values.title, adjacent: values.adjacent },
    clinic: values.clinic,
    payer: values.payer,
    ...extra,
  };
}

function commitScreen(note = "") {
  const c = commitment || status.commitment;
  const error = h("p", { class: "sp__error", role: "alert" }, note);
  const name = h("input", { type: "text", id: "fullname", autocomplete: "name", maxlength: "120", placeholder: "Your full name" });
  const quote = h("input", { type: "checkbox", id: "quote" });
  const agree = btn("I agree, set up my seat", async () => {
    error.textContent = "";
    if (!fullName(name.value)) {
      error.textContent = "Type your full name, first and last, to agree.";
      return;
    }
    agree.disabled = true;
    try {
      const out = await call("/sprint/commit", requestBody({ name: name.value.trim(), agree: true, quote: quote.checked, version: c.version }));
      resultScreen(out);
    } catch (problem) {
      agree.disabled = false;
      if (problem.status === 409 && problem.data?.commitment) {
        commitment = problem.data.commitment;
        return commitScreen(say(problem));
      }
      error.textContent = say(problem);
    }
  });
  show(
    eyebrow("The free sprint · step 3 of 3, the agreement"),
    h("h1", {}, "What we each give."),
    h("p", { class: "sp__lede" }, `Six weeks, ${dayText(status.starts)} to ${dayText(status.ends)}. Free. Read it once, then type your name.`),
    h("p", { class: "sp__h" }, "We give"),
    h("ul", { class: "sp__list" }, (c.give || []).map((line) => h("li", {}, line))),
    h("p", { class: "sp__h" }, "You give"),
    h("ul", { class: "sp__list" }, (c.ask || []).map((line) => h("li", {}, line))),
    h("p", { class: "sp__box sp__box--rule" }, h("b", {}, "The 7-day rule. "), c.quiet),
    h("p", { class: "sp__box" }, h("b", {}, "Your data. "), c.data),
    h("label", { class: "sp__check" }, quote, h("span", {}, c.quote, " Optional.")),
    h("div", { class: "sp__q", style: "margin-top:24px" }, h("label", { class: "sp__label", for: "fullname" }, c.sign || "Type your full name to agree."), name),
    h("div", { class: "sp__acts" }, agree, h("button", { class: "sp__back", type: "button", onclick: () => stepScreen() }, "Back")),
    error,
  );
}

function resultScreen(out) {
  const head = resultHead(out);
  const parts = [h("p", {}, h("span", { class: `sp__badge${head.tone ? ` sp__badge--${head.tone}` : ""}` }, head.badge)), h("h1", {}, head.title)];
  if (out.decision === "member") {
    parts.push(
      h("p", { class: "sp__lede" }, "Your seat is set up. Here's what happens next."),
      h("ul", { class: "sp__next" },
        h("li", {}, h("b", {}, "Tonight"), "We read fresh roles against your record and prepare the best few: the person to message at each and the note."),
        h("li", {}, h("b", {}, "Tomorrow, around 7am"), "They're in your inbox and on Jobs in the app. You send them yourself and log each one."),
        h("li", {}, h("b", {}, "Your first session, about an hour"), "Make one real thing, and write your plan: \"I'll send my first 3 notes on ___ at ___.\" It's the first step on your map."),
      ),
      h("div", { class: "sp__acts" },
        btn("Open my map", () => openMap(out.session, "s.sprint")),
        out.calendar ? link("Add to my calendar", out.calendar) : null,
        out.community ? link("Join the community", out.community) : null),
      h("p", { class: "sales-fine" }, out.emailed === false ? "Your welcome email didn't go out, so keep this page open. Your coach has been told." : "A welcome email with these links is on its way."),
    );
  } else if (out.decision === "waitlist") {
    parts.push(
      h("p", { class: "sp__lede" }, out.reason || "All the seats are taken right now."),
      h("p", { class: "sp__lede" }, "When a seat opens, it goes to the next person on the list automatically, and you'll get an email that day. Your free map is ready now."),
      h("div", { class: "sp__acts" }, btn("Open my free map", () => openMap(out.session))),
    );
  } else if (out.decision === "declined") {
    parts.push(
      h("p", { class: "sp__lede" }, out.reason),
      h("p", { class: "sp__lede" }, "Your free map is yours to keep, and it walks you through the next step on your own. You can also do the full program at your own pace with GridSchool Complete. If something changes, reply to any email from us and your coach will take another look."),
      h("div", { class: "sp__acts" }, btn("Open my free map", () => openMap(out.session)), link("See GridSchool Complete", "../../checkout/?plan=complete&from=sprint")),
    );
  }
  show(parts);
}

function statusScreen(app) {
  const known = { ...app, decision: app.status };
  if (app.status === "member") {
    const head = resultHead({ decision: "member", starts: app.starts });
    return show(
      h("p", {}, h("span", { class: "sp__badge" }, "You're in")),
      h("h1", {}, head.title),
      h("p", { class: "sp__lede" }, `Your sprint runs to ${dayText(app.ends, { weekday: true })}. Your roles arrive each morning.`),
      h("div", { class: "sp__acts" }, link("Open my map", `../../signin/${LOCAL ? `?api=${encodeURIComponent(API)}` : ""}`, { solid: true }), app.calendar ? link("Add to my calendar", app.calendar) : null, app.community ? link("Join the community", app.community) : null),
    );
  }
  if (app.status === "waitlist") return resultScreen({ ...known, decision: "waitlist", reason: app.reason || "All the seats are taken right now." });
  if (app.status === "declined") return resultScreen({ ...known, decision: "declined" });
  if (app.status === "released") {
    return show(
      h("p", {}, h("span", { class: "sp__badge sp__badge--no" }, "Seat released")),
      h("h1", {}, "Your seat went to the next person."),
      h("p", { class: "sp__lede" }, "It was quiet for 7 days, so it went to the waitlist. Nothing you did is lost: your map and every checked task are still yours. When you have the time again, rejoin the waitlist."),
      h("div", { class: "sp__acts" }, btn("Rejoin the waitlist", () => stepScreen()), link("Sign in to your map", "../../signin/")),
    );
  }
  return show(eyebrow("The free sprint"), h("h1", {}, "The sprint has ended for you."), h("p", { class: "sp__lede" }, "Your map and everything on it are still yours."), h("div", { class: "sp__acts" }, link("Sign in to your map", "../../signin/", { solid: true })));
}

async function start() {
  try {
    status = await fetch(`${API}/sprint/status`).then((res) => res.json());
  } catch {
    return problemScreen("We couldn't reach our server. Try again in a moment.");
  }
  if (!status?.on) return closed();
  const id = who();
  if (!id.check && !id.headers.authorization) return nobody();
  catalog = await fetch("../../data/intake/questions.json").then((res) => res.json()).catch(() => null);
  try {
    me = await call("/sprint/me", {});
  } catch (problem) {
    if (problem.status === 401 || problem.status === 404) return nobody();
    return problemScreen(say(problem));
  }
  track(API, "sprint.step", { source: from, check: id.check });
  const app = me.application;
  if (app && ["member", "waitlist", "declined", "ended", "released"].includes(app.status)) return statusScreen(app);
  stepScreen();
}

start();
