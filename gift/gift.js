/**
 * gift/: the parent's page, and the three links a gift's emails carry.
 *
 *   ?claim=<token>  the person receiving it: accept (and choose the weekly note) or decline
 *   ?stop=<token>   either person: stop the weekly note
 *   ?sent=1         the giver, back from checkout (the gift Payment Links' success URL)
 *   ?unsub=<token>  a parent lead: no more "Email me this" follow-ups
 *
 * The pitch also has "Email me this" (gift_leads_api.py). The server side is site/server/gifts_api.py.
 * Words for each outcome: gift-words.mjs.
 */

import { PERSIST, link } from "../config.js?v=7288040-202610310409";
import { track, visitorId } from "../check/events.js?v=7288040-202610310409";
import { DONE, LEAD, claimTitle, shareLabel, giftSource, leadBody, leadProblem, scheduledWords } from "./gift-words.mjs?v=7288040-202610310409";

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
  if (gift.status === "claimed") return done("already", { href: "../signin/", label: "Sign in to my map" });
  if (["declined", "refunded", "cancelled"].includes(gift.status)) return done("closed", { href: "../check/?from=gift", label: "Take the free check" });
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
      done("already", { href: "../signin/", label: "Sign in to my map" });
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

async function unsubscribe(token) {
  try {
    await post("unsubscribe", { token });
    done("unsubscribed");
  } catch (error) {
    done("stopFailed");
    $("done-title").textContent = "That link didn't unsubscribe you.";
    $("done-body").textContent = error.message;
  }
}

/** "Email me this": the link now, two short notes this week. Texts only with the box ticked. */
function lead() {
  const form = $("lead");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = { email: $("lead-email").value, phone: $("lead-phone").value, sms: $("lead-sms").checked, company: $("lead-company").value };
    const problem = leadProblem(fields);
    $("lead-note").textContent = problem;
    if (problem) return;
    $("lead-send").disabled = true;
    try {
      await post("lead", leadBody({ ...fields, visitor: visitorId(), from: params.get("from") }));
      $("lead-note").textContent = LEAD.sent;
      form.reset();
    } catch (error) {
      $("lead-note").textContent = error.message;
    } finally {
      $("lead-send").disabled = false;
    }
  });
}

const token = (params.get("claim") || params.get("stop") || params.get("unsub") || "").replace(/[^\w-]/g, "").slice(0, 80);
if (params.get("claim")) claim(token);
else if (params.get("stop")) stop(token);
else if (params.get("unsub")) unsubscribe(token);
else if (params.get("sent") === "1") {
  done("sent");
  let later = null;
  try {
    later = scheduledWords(sessionStorage.getItem("gridschool.gift.sendOn"));
    sessionStorage.removeItem("gridschool.gift.sendOn");
  } catch {
    /* no day kept: the plain thank-you stands */
  }
  if (later) {
    $("done-title").textContent = later.title;
    $("done-body").textContent = later.body;
  }
}
else {
  only("pitch");
  lead();
  track(PERSIST.endpoint, "gift.view", { source: giftSource(params.get("from")) });
}
