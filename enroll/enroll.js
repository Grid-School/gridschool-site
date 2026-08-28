/**
 * Checkout. Plans are described here once and rendered from data, so a price
 * change happens in config.js and nowhere else. When a Stripe link exists the
 * button goes to Stripe; until then it walks the demo path to day one.
 */

import { link, PRICING } from "../config.js";
import { saveEnrollment } from "../js/lead.js";

const PLANS = [
  {
    id: "founding",
    tag: "Most take this",
    best: true,
    price: "Founding",
    sub: "once, for the eight weeks. Amount on the payment link.",
    linkKey: "foundingCheckout",
    cta: "Take the spot",
    includes: [
      "Weekly 1:1, 45 minutes, same slot every week",
      "Monday cohort call with the other four",
      "Up to three written reviews a week on real work",
      "One brownfield mission, failure log, live defense",
      "Your board: eight nodes, a queue, and a calendar",
      "The studio repo, and the prompt and harness pack",
    ],
  },
  {
    id: "deposit",
    tag: "Same lab",
    price: "Split",
    sub: "deposit now, remainder after week 1. Amount on the payment link.",
    linkKey: "depositCheckout",
    cta: "Pay the deposit",
    includes: [
      "Everything in the single payment",
      "Deposit today. Remainder after week 1.",
      "Week 2 exit still applies to what you have not used",
    ],
  },
];

const plans = document.getElementById("plans");

document.getElementById("spots").textContent = `Founding · ${PRICING.spots} spots · ${PRICING.weeks} weeks`;

for (const plan of PLANS) {
  plans.append(planCard(plan));
}

function planCard(plan) {
  const card = document.createElement("div");
  card.className = `plan${plan.best ? " plan--best" : ""}`;

  const href = link(plan.linkKey);
  const list = plan.includes.map((line) => `<li>${line}</li>`).join("");

  card.innerHTML = `
    <span class="plan__tag">${plan.tag}</span>
    <div class="plan__price">${plan.price}<small>${plan.sub}</small></div>
    <ul>${list}</ul>`;

  const button = document.createElement("a");
  button.className = plan.best ? "btn btn--cta" : "btn btn--solid";
  button.textContent = plan.cta;

  if (href) {
    button.href = href;
    button.target = "_blank";
    button.rel = "noopener";
  } else {
    button.href = "../start/?demo=1";
    button.addEventListener("click", () => saveEnrollment(plan.id));
    const note = document.createElement("span");
    note.className = "wired";
    note.textContent = "placeholder checkout";
    card.append(note);
  }

  card.append(button);
  return card;
}
