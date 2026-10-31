/**
 * sprint/numbers/: what the free sprint's members did, published by hand at weeks 3 and 6 (server/sprint_api.py
 * publish). Counts across everyone, a reply rate only once there are enough sends, and the portal baseline beside it.
 */

import { PERSIST } from "../../config.js?v=f96b76b-202610312232";

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = (() => {
  const asked = new URLSearchParams(location.search).get("api");
  if (LOCAL) return (asked || PERSIST.endpoint).replace(/\/$/, "");
  return PERSIST.endpoint;
})();
const body = document.getElementById("numbers");

const el = (tag, cls, text) => Object.assign(document.createElement(tag), cls ? { className: cls } : {}, text !== undefined ? { textContent: text } : {});
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function snapshot(s) {
  const n = s.numbers || {};
  const card = el("article", "sp__box");
  card.append(el("p", "sp__h", s.label));
  const list = el("ul", "sp__list");
  for (const [label, value] of [["People in the sprint", n.members], ["Sends", n.sends], ["Replies", n.replies], ["Screens", n.screens], ["Interviews", n.interviews]]) {
    list.append(el("li", "", `${label}: ${value ?? 0}`));
  }
  list.append(el("li", "", n.replyRate == null ? "Reply rate: not shown until there are at least 30 sends." : `Reply rate: ${n.replyRate}% (${n.replies} of ${n.sends} sends)`));
  card.append(list, el("p", "sp__help", `Published ${day(s.published_at)}. Counts across everyone in the sprint; never a name, a message or a company.`));
  return card;
}

async function start() {
  try {
    const res = await fetch(`${API}/sprint/numbers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const published = data.published || [];
    body.replaceChildren(
      ...(published.length ? published.map(snapshot) : [el("p", "sp__lede", "The first numbers are published at week 3, on November 25. Nothing is shown until then.")]),
      el("p", "sp__help", data.baseline || ""),
    );
  } catch {
    body.replaceChildren(el("p", "sp__lede", "The numbers didn't load. Try again in a moment."));
  }
}

start();
