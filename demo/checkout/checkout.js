/**
 * Demo checkout for walkthroughs (reached from the free check with ?demo=1). It looks like the
 * order step and says plainly that it's a demo: no card fields, nothing charged, nothing saved
 * on a server. "Pay" goes to the welcome page in demo mode with the name and the check's top
 * finding, and from there to the made-up Complete map. The real checkout is Stripe.
 */

import { offerOf } from "./offer.js?v=ac1f443-202610240735";

const params = new URLSearchParams(location.search);
const card = document.getElementById("card");
const top = (params.get("top") || "").replace(/[^a-z]/g, "").slice(0, 20);
let plan = params.get("plan") === "monthly" ? "monthly" : "full";

function h(tag, className, text, attrs = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) if (child) node.append(child);
  return node;
}

async function render() {
  const offer = await offerOf();
  const price = offer.price;
  const prepared = offer.prepared[top] || "We find fresh roles that fit you, the person hiring at each, and a short note to each one in your voice.";
  let savedName = "";
  try {
    savedName = localStorage.getItem("gridschool.demo.name") || "";
  } catch {
    /* fine without */
  }
  const name = h("input", "", null, { id: "demo-name", type: "text", autocomplete: "off", placeholder: "Sam Rivera", value: savedName, "aria-label": "Name for the welcome page" });
  const total = h("b", "");
  const payLabel = h("span", "");
  const choice = (key, title, sub) => {
    const node = h("button", `plan-choice${plan === key ? " is-picked" : ""}`, null, { type: "button", "aria-pressed": String(plan === key) }, [h("b", "", title), h("small", "", sub)]);
    node.addEventListener("click", () => {
      plan = key;
      for (const other of node.parentElement.children) {
        other.classList.toggle("is-picked", other === node);
        other.setAttribute("aria-pressed", String(other === node));
      }
      paint();
    });
    return node;
  };
  const paint = () => {
    total.textContent = plan === "full" ? `$${price.full}` : `$${price.instalment} today`;
    payLabel.textContent = plan === "full" ? `Pay $${price.full}` : `Pay $${price.instalment}`;
  };
  const pay = h("button", "btn btn--solid paybtn", null, { type: "button" }, [payLabel, h("span", "arr", "(demo) →", { "aria-hidden": "true" })]);
  pay.addEventListener("click", () => {
    pay.disabled = true;
    payLabel.textContent = "Confirming payment…";
    const who = name.value.trim() || "Sam Rivera";
    try {
      localStorage.setItem("gridschool.demo.name", who);
    } catch {
      /* fine without */
    }
    const next = new URL("../../begin/", location.href);
    next.searchParams.set("demo", "1");
    next.searchParams.set("name", who);
    if (top) next.searchParams.set("top", top);
    setTimeout(() => (location.href = next.toString()), 1100);
  });
  card.replaceChildren(
    h("p", "demo-ribbon", null, {}, [h("b", "", "Demo checkout. "), document.createTextNode("This is a walkthrough: no card is needed and nothing is charged. The live checkout runs on Stripe.")]),
    h("p", "eyebrow", "Your order"),
    h("h1", "card__title", "GridSchool Complete"),
    h("p", "card__lead", `Your map and the first week's work. ${prepared}`),
    h("div", "plans", null, {}, [
      choice("full", `$${price.full} once`, `${price.months} months`),
      choice("monthly", `$${price.instalment} a month`, `${price.instalments} payments`),
    ]),
    h("div", "order", null, {}, [
      h("div", "order__line", null, {}, [h("span", "", "Aden reviews your map"), h("b", "", "within 24 hours")]),
      h("div", "order__line", null, {}, [h("span", "", "Refund"), h("b", "", `${price.refundDays} days, no questions`)]),
      h("div", "order__line order__total", null, {}, [h("span", "", "Due today"), total]),
    ]),
    h("label", "name-row", null, { for: "demo-name" }, [h("span", "", "Name for the welcome page (demo)"), name]),
    pay,
    h("p", "card__fine", "Charged as GRIDSCHOOL COMPLETE on a real order. Changed your mind? 14 days to ask for a full refund.")
  );
  paint();
}

render();
