/**
 * How people use the app, recorded first-party (server/activity.py, schema 037): which screen they're on,
 * every click, change and submit, the warnings and errors they hit, and when they leave. Never what anyone
 * types: a control is named by its data-track, aria-label, id or visible label, never by its value, and
 * nothing inside [data-private] is named at all.
 *
 * Two signals are worked out here, where the timing is exact:
 *   - a burst: the same control pressed again within 1.5 s is one row with n (3 or more reads as confusion);
 *   - a dead click: a control that changed nothing on the page within a second (no new screen, no change to
 *     the page, not a link that opens elsewhere).
 * Batched every few seconds; the last batch goes with the page as it closes. Measuring never breaks the page.
 */

import { visitorId } from "../../check/events.js?v=7288040-202610310409";

const SESSION_KEY = "gridschool.session.tab.v1";
const FLUSH_MS = 5000;
const BURST_MS = 1500;
const DEAD_MS = 1000;
const INTERACTIVE = "button, a[href], [role=button], [role=tab], input, select, textarea, summary, label, [data-track]";

let api = "";
let token = () => "";
let queue = [];
let timer = null;
let burst = null;
let mutations = 0;
let route = "";
let started = false;

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

const currentRoute = () => location.hash.replace(/^#\/?/, "").split("?")[0].slice(0, 120);
const clip = (text, n = 80) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** A stable, human name for a control, from what we wrote, never from what they typed. */
export function nameOf(node) {
  if (!node || node.closest?.("[data-private]")) return "(private)";
  const track = node.closest?.("[data-track]")?.getAttribute("data-track");
  if (track) return clip(track, 100);
  const tag = node.tagName?.toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) {
    const label = node.getAttribute("aria-label") || (node.id && document.querySelector(`label[for="${CSS.escape(node.id)}"]`)?.textContent) || node.closest("label")?.textContent || node.getAttribute("placeholder") || node.name || node.id;
    return `${tag}:${clip(label, 70) || "unnamed"}`;
  }
  const label = node.getAttribute?.("aria-label") || clip(node.textContent, 60) || node.id || node.getAttribute?.("title");
  return `${tag || "node"}:${clip(label, 70) || "unnamed"}`;
}

function push(kind, target, props = {}, at = route) {
  queue.push({ kind, target, route: at, t: Date.now(), props });
  if (queue.length >= 40) flush();
}

function flush(beacon = false) {
  endBurst();
  if (!queue.length || !api) return;
  const body = JSON.stringify({ visitor: visitorId(), session: sessionId(), events: queue.splice(0, 60) });
  try {
    if (beacon && navigator.sendBeacon) {
      // No headers on a beacon: the server joins it to the seat by the session id signed in earlier.
      navigator.sendBeacon(`${api}/activity`, new Blob([body], { type: "application/json" }));
      return;
    }
    const t = token();
    fetch(`${api}/activity`, { method: "POST", keepalive: true, headers: { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body }).catch(() => {});
  } catch {
    /* measuring is never worth an error */
  }
}

function endBurst() {
  if (!burst) return;
  const b = burst;
  burst = null;
  clearTimeout(b.timer);
  push("click", b.target, { n: b.n, ...(b.dead ? { dead: true } : {}) }, b.route); // the screen it was clicked on, not the one it led to
}

function onClick(event) {
  const node = event.target?.closest?.(INTERACTIVE);
  if (!node) return;
  const target = nameOf(node);
  const now = Date.now();
  if (burst && burst.target === target && now - burst.last < BURST_MS) {
    burst.n += 1;
    burst.last = now;
    clearTimeout(burst.timer);
    burst.timer = setTimeout(endBurst, BURST_MS);
    return;
  }
  endBurst();
  const tag = node.tagName.toLowerCase();
  const opensElsewhere = tag === "a" && (node.target === "_blank" || /^(mailto|tel):/.test(node.getAttribute("href") || ""));
  const entry = ["input", "textarea", "select", "label"].includes(tag) || node.isContentEditable;
  burst = { target, n: 1, last: now, dead: false, route, timer: setTimeout(endBurst, BURST_MS) };
  if (!opensElsewhere && !entry && !node.disabled) {
    const before = mutations;
    const where = location.hash;
    const mine = burst;
    setTimeout(() => {
      if (mutations === before && location.hash === where && mine === burst) mine.dead = true;
      else if (mutations === before && location.hash === where) push("click", target, { dead: true, n: 1 });
    }, DEAD_MS);
  }
}

function onView() {
  const next = currentRoute();
  if (next === route && started) return;
  route = next;
  push("view", route || "home", started ? {} : { first: true });
  started = true;
}

/**
 * Start recording. apiBase: the persist endpoint; getToken: the student's token (the server takes the seat
 * from it, never from the body). Safe to call once; a placeholder endpoint records nothing.
 */
export function startTelemetry(apiBase, getToken) {
  if (api || !apiBase || typeof window === "undefined") return;
  api = String(apiBase).replace(/\/$/, "");
  token = getToken || token;
  onView();
  new MutationObserver((list) => { mutations += list.length; }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-busy", "hidden", "open"] });
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", (e) => { const n = e.target?.closest?.("input, select, textarea"); if (n && n.type !== "password") push("change", nameOf(n)); }, true);
  document.addEventListener("submit", (e) => push("submit", nameOf(e.target)), true);
  window.addEventListener("hashchange", onView);
  window.addEventListener("gs:toast", (e) => push("toast", clip(e.detail?.message, 120), { tone: e.detail?.tone || "ok" }));
  window.addEventListener("error", (e) => push("error", clip(`${(e.filename || "").split("/").pop()}:${e.lineno || 0}`, 80), { msg: clip(e.message, 150) }));
  window.addEventListener("unhandledrejection", (e) => push("error", "promise", { msg: clip(e.reason?.message || e.reason, 150) }));
  window.addEventListener("pagehide", () => { push("leave", route || "home"); flush(true); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
  timer = setInterval(() => flush(false), FLUSH_MS);
}
