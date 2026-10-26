/**
 * gift/: the parent's page, and the three links a gift's emails carry.
 *
 *   ?claim=<token>  the person receiving it: accept (and choose the weekly note) or decline
 *   ?stop=<token>   either person: stop the weekly note
 *   ?sent=1         the giver, back from checkout (the gift Payment Links' success URL)
 *
 * The server side is site/server/gifts_api.py. Words for each outcome: gift-words.mjs.
 */

import { PERSIST, link } from "../config.js?v=939d963-202610261500";
import { DONE, claimTitle, shareLabel, giftSource } from "./gift-words.mjs?v=939d963-202610261500";

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// Opened from an ad (?from=meta:P-TABLE-01): checkout hears gift:meta:P-TABLE-01, so a gift joins back to its ad.
for (const anchor of document.querySelectorAll('a[href*="checkout/"]')) {
  const url = new URL(anchor.getAttribute("href"), location.href);
  url.searchParams.set("from", giftSource(params.get("from")));
  anchor.href = url.toString();
}

async function post(path, body) {
  const res = await fetch(`${PERSIST.endpoint}/gift/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Reply to the email this came in and we'll sort it out.");
  return data;
}

function only(id) {
  $("pitch").hidden = id !== "pitch";
  $("claim").hidden = id !== "claim";
  $("done").hidden = id !== "done";
  for (const node of document.querySelectorAll("[data-pitch-only]")) node.hidden = id !== "pitch";
}

function done(key, { href = null, label = null } = {}) {
  const words = DONE[key];
  $("done-eyebrow").textContent = words.eyebrow;
  $("done-title").textContent = words.title;
  $("done-body").textContent = words.body;
  $("done-cta").hidden = !href;
  if (href) {
    $("done-link").href = href;
    $("done-link").firstChild.textContent = `${label || words.cta} `;
  }
  only("done");
}

async function claim(token) {
  only("claim");
  let gift;
  try {
    gift = await post("peek", { token });
  } catch (error) {
    $("claim-title").textContent = "This gift link didn't open.";
    $("claim-what").textContent = error.message;
    $("share").closest("label").hidden = true;
    $("accept").closest("p").hidden = true;
    return;
  }
  if (gift.status === "claimed") return done("already", { href: "../begin/", label: "Sign in to my map" });
  if (gift.status === "declined" || gift.status === "refunded") return done("closed", { href: "../check/?from=gift", label: "Take the free check" });
  $("claim-title").textContent = claimTitle(gift);
  $("share-label").textContent = shareLabel(gift);
  const busy = (on) => ["accept", "decline"].forEach((id) => ($(id).disabled = on));
  $("accept").addEventListener("click", async () => {
    busy(true);
    $("claim-error").textContent = "";
    try {
      const out = await post("accept", { token, share: $("share").checked });
      if (out.signin) return void (location.href = out.signin);
      if (out.plan === "residency") return done("residency", link("kickoffCall") ? { href: link("kickoffCall") } : {});
      done("already", { href: "../begin/", label: "Sign in to my map" });
    } catch (error) {
      $("claim-error").textContent = error.message;
      busy(false);
    }
  });
  $("decline").addEventListener("click", async () => {
    if (!confirm("Decline the gift? They'll be refunded in full.")) return;
    busy(true);
    try {
      await post("decline", { token });
      done("declined", { href: "../check/?from=gift-declined", label: "Take the free check anyway" });
    } catch (error) {
      $("claim-error").textContent = error.message;
      busy(false);
    }
  });
}

async function stop(token) {
  try {
    await post("stop", { token });
    done("stopped");
  } catch (error) {
    done("stopFailed");
    $("done-body").textContent = error.message;
  }
}

const token = (params.get("claim") || params.get("stop") || "").replace(/[^\w-]/g, "").slice(0, 80);
if (params.get("claim")) claim(token);
else if (params.get("stop")) stop(token);
else if (params.get("sent") === "1") done("sent");
else only("pitch");
