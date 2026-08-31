/**
 * The application record. Kept in the browser at founding so the funnel is
 * walkable end to end, and formatted into a block that can be emailed or pasted
 * into whatever intake tool gets connected later.
 *
 * When Tally or a real endpoint exists, `submit()` is the only function to change.
 */

import { LINKS, PERSIST, isPlaceholder } from "../config.js";

const KEY = "gridschool.application.v1";
const PAID_KEY = "gridschool.enrollment.v1";

export function saveApplication(data) {
  const record = { ...data, at: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(record));
  return record;
}

export function getApplication() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function saveEnrollment(plan) {
  const record = { plan, at: new Date().toISOString(), demo: true };
  localStorage.setItem(PAID_KEY, JSON.stringify(record));
  return record;
}

export function getEnrollment() {
  try {
    return JSON.parse(localStorage.getItem(PAID_KEY) || "null");
  } catch {
    return null;
  }
}

const LABELS = {
  name: "Name",
  email: "Email",
  work: "Work that runs",
  linkedin: "LinkedIn",
  years: "Experience",
  shipped: "What they shipped",
  applications: "Applications, last 30 days",
  blocking: "What they think is blocking them",
  plan: "Money",
  commit: "Can commit 10 to 15 hours a week and Mondays",
  found: "How they found me",
};

export function formatApplication(data) {
  const lines = ["GRIDSCHOOL APPLICATION", `Received ${new Date(data.at ?? Date.now()).toLocaleString()}`, ""];
  for (const [key, label] of Object.entries(LABELS)) {
    const value = data[key];
    if (value === undefined || value === "" || value === null) continue;
    lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
}

export function mailtoHref(data) {
  const subject = `GridSchool application: ${data.name ?? "unknown"}`;
  return `mailto:${LINKS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formatApplication(data))}`;
}

/**
 * Hand the application off. Returns where the visitor should go next.
 * Real intake wins when it is connected; otherwise the record stays local and
 * the next page shows the block to email, which is honest and still works.
 */
export function submit(data) {
  const record = saveApplication(data);
  if (!isPlaceholder(LINKS.application)) {
    return { mode: "external", url: LINKS.application, record };
  }
  return { mode: "local", url: "../applied/", record };
}

/**
 * Best-effort desk ingest. Failures stay local. Never mints a seat.
 * Tally later replaces this POST, not the enroll click.
 */
export async function ingestLead(record) {
  const endpoint = PERSIST?.endpoint;
  if (!endpoint || isPlaceholder(endpoint)) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    await fetch(`${String(endpoint).replace(/\/$/, "")}/leads/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: ctrl.signal,
    });
  } catch {
    /* mailto / local record still stand */
  } finally {
    clearTimeout(timer);
  }
}

/** Paint a "connected / not connected" marker next to an integration. */
export function wiredBadge(key, { onLabel = "connected", offLabel = "not connected yet" } = {}) {
  const span = document.createElement("span");
  const connected = !isPlaceholder(LINKS[key]);
  span.className = connected ? "wired wired--on" : "wired";
  span.textContent = connected ? onLabel : offLabel;
  return span;
}
