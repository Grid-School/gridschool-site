/**
 * Day one. What do I do tonight.
 * Three doors: the board, Discord, the 1:1. Week-1 work lives on the board.
 */

import { link, LINKS } from "../config.js";
import { getEnrollment, getApplication } from "../js/lead.js";
import { applySiteOverrides } from "../js/site-overrides.js";

const params = new URLSearchParams(location.search);
const slug = params.get("s") || "demo";
const enrollment = getEnrollment();
const application = getApplication();

if (application?.name) {
  document.querySelector(".fhead h1").textContent = `${application.name.split(" ")[0]}, you’re in.`;
}

const demoNote = document.getElementById("demonote");
if (params.get("demo") === "1" || !enrollment || enrollment.demo) {
  demoNote.innerHTML = `
    <div class="demonote">
      <b>DEMO ENROLLMENT</b>
      <p>No real payment was taken. This is the page a paying student lands on, wired to a demo board so the whole first day can be walked before anyone is charged.</p>
    </div>`;
}

const STEPS = [
  {
    title: "Open your board",
    now: true,
    body: `Today answers what to do next. The map shows the complete path. Each step states how to finish: answer in GridSchool, save one link, or receive an accepted review. Future steps stay unavailable until they open.`,
    action: { label: "Open my board", href: `../app/?s=${encodeURIComponent(slug)}`, variant: "cta" },
  },
  {
    title: "Join Discord",
    body: `The Discord invite is on the Welcome step of your board after you sign in. It is not on this page. <code>#asks</code> is where you introduce yourself and request reviews. <code>#ship</code> needs a URL from the last seven days.`,
    action: { label: "Open my board to join", href: `../app/?s=${encodeURIComponent(slug)}` },
  },
  {
    title: "Book your weekly 1:1",
    body: `One slot, same time every week, 45 minutes. The Monday cohort call is 75 minutes. Both are on your calendar once booked.`,
    action: { label: "Pick my slot", linkKey: "oneOnOne" },
  },
];

const list = document.getElementById("steps");

/* Day one renders after the live public overrides land. Discord stays off
   this page; the invite is granted only on a paid board after sign-in. */
await applySiteOverrides().catch(() => {});

STEPS.forEach((step, index) => {
  const li = document.createElement("li");
  li.className = `step${step.now ? " step--now" : ""}`;

  const number = document.createElement("b");
  number.className = "step__n";
  number.textContent = String(index + 1);

  const body = document.createElement("div");
  body.innerHTML = `<h3>${step.title}</h3><p>${step.body}</p>`;
  body.append(actionFor(step.action));

  li.append(number, body);
  list.append(li);
});

function actionFor(action) {
  const wrap = document.createElement("div");
  wrap.className = "step__act";

  const href = action.href ?? link(action.linkKey);
  const anchor = document.createElement("a");
  anchor.className = `btn btn--${action.variant ?? "ghost"}`;
  anchor.textContent = action.label;

  if (href) {
    anchor.href = href;
    if (action.linkKey) {
      anchor.target = "_blank";
      anchor.rel = "noopener";
    }
    wrap.append(anchor);
    if (action.linkKey) {
      wrap.append(badge("connected", true));
    }
  } else {
    anchor.href = `mailto:${LINKS.email}`;
    anchor.textContent = "Email me for this";
    wrap.append(anchor, badge("link not connected yet", false));
  }

  return wrap;
}

function badge(text, on) {
  const span = document.createElement("span");
  span.className = on ? "wired wired--on" : "wired";
  span.textContent = text;
  return span;
}
