/**
 * Day one, rendered from config so it never lies about what is connected. Each
 * step either hands the student a working link or says plainly that the link is
 * coming, rather than showing a dead button.
 */

import { link, LINKS } from "../config.js";
import { getEnrollment, getApplication } from "../js/lead.js";

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
    body: `Your Path, your queue, your calendar, and your reviews in one place. Two fields matter every week: <b>Focus</b> and <b>Next</b>. I set them each Monday after reviews come back. A light turns on only when a URL exists.`,
    action: { label: "Open my board", href: `../app/?s=${encodeURIComponent(slug)}`, variant: "cta" },
  },
  {
    title: "Join the room",
    body: `Discord. <code>#ship</code> requires a URL from the last seven days. <code>#asks</code> is where reviews get requested. Introduce yourself with a link, not a bio.`,
    action: { label: "Join Discord", linkKey: "discord" },
  },
  {
    title: "Book your weekly 1:1",
    body: `One slot, same time every week, 45 minutes. The Monday cohort call is 75 minutes. Both are non-optional, and both show up on your calendar once booked.`,
    action: { label: "Pick my slot", linkKey: "oneOnOne" },
  },
  {
    title: "Accept the tool pack",
    body: `The prompts, the harness stub, and the Cursor rules I actually use. This is a bonus, not the product. The product is the review.`,
    action: { label: "Accept the invite", linkKey: "toolPack" },
  },
  {
    title: "Install the Coach and run one session tonight",
    body: `Paste the Coach prompt into whichever AI you already pay for, then run one drill. It ends by writing a <code>FOR ADEN</code> block. Save it. It goes into your first review.`,
    action: { label: "Open the Coach", href: `../app/?s=${encodeURIComponent(slug)}#/coach`, variant: "solid" },
  },
  {
    title: "Ship tonight: make Northline run",
    body: `Clone <code>companies/gridschool-phase0/studio</code>. Run the two commands in the README. You should see T-1842 on Support. That is the lie. Post the status output in <code>#ship</code>, then attach it to It runs.`,
    action: { label: "Go to It runs", href: `../app/?s=${encodeURIComponent(slug)}#/map/pf.runs`, variant: "solid" },
  },
];

const list = document.getElementById("steps");

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
