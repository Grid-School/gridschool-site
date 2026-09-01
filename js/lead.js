/**
 * The application record. Saved locally so applied/ can show their copy.
 * The real handoff is POST /leads/apply. Mailto is only a fallback if that fails.
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
  search: "Where the search is",
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
  return `mailto:${LINKS.applyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(formatApplication(data))}`;
}

/**
 * Hand the application off. Persist ingest is the door. Tally later can replace
 * the POST, not the enroll click.
 */
export function submit(data) {
  const record = saveApplication(data);
  if (!isPlaceholder(LINKS.application)) {
    return { mode: "external", url: LINKS.application, record };
  }
  return { mode: "local", url: "../applied/", record };
}

/**
 * Desk ingest. Never mints a seat. Returns true when the lab stored the lead.
 */
export async function ingestLead(record) {
  const endpoint = PERSIST?.endpoint;
  if (!endpoint || isPlaceholder(endpoint)) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${String(endpoint).replace(/\/$/, "")}/leads/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
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
