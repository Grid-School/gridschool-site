/**
 * The verdict on one posting for one student: apply, reach first, or skip, with the reasons in plain words.
 * Pure, so the rules are tested on their own (send-verdict.test.mjs). views/send.js draws it.
 *
 * The order of the rules is the order a person should think in:
 *   1. Already sent there: skip (or follow up), never a second cold send into the same memory.
 *   2. Someone they know works there: reach first. A warm name beats a cold application by an order of
 *      magnitude (Ashby: referrals are 1% of applications and 18% of hires).
 *   3. The posting is old: skip. Queues are read top down and a weeks-old req is usually filled or dead.
 *   4. Fit, from the prepared read (strong / possible / weak) or, without one, how many of the title's
 *      checklist needs the posting mentions.
 */

import { ageLabel, sentBefore } from "./search.js?v=89ee485-202610270204";

export const OLD_DAYS = 21;
export const FRESH_DAYS = 3;

const days = (iso, now) => (iso ? Math.floor((now - new Date(iso)) / 86400000) : null);

function needHits(role, needs) {
  const text = `${role.title ?? ""} ${role.description ?? ""}`.toLowerCase();
  const on = (needs ?? []).filter((n) => n.state !== "off");
  const hit = on.filter((n) => (n.terms ?? []).some((t) => t && text.includes(String(t).toLowerCase())));
  return { hit: hit.length, total: on.length };
}

export function verdict(role, { apps = [], insiders = [], fitLevel = null, needs = [], now = new Date() } = {}) {
  const reasons = [];
  const before = sentBefore(apps, { company: role.company, roleKey: role.key });
  if (before) {
    return { label: "skip", reasons: [`you sent to ${role.company} on ${before.date}${before.stage !== "sent" ? ` (${before.stage})` : ""}`], before };
  }
  const age = days(role.published_at || role.first_seen_at, now);
  if (age != null && age > OLD_DAYS) {
    return { label: "skip", reasons: [`posted ${ageLabel(role.published_at || role.first_seen_at, now)}: most likely filled`] };
  }
  const fit = needHits(role, needs);
  // Strong: three quarters of the checklist is in the posting. Possible: at least two things, or 40%.
  const level = fitLevel || (fit.total ? (fit.hit / fit.total >= 0.75 ? "strong" : fit.hit >= 2 || fit.hit / fit.total >= 0.4 ? "possible" : "weak") : null);
  if (level === "strong") reasons.push(fitLevel ? "strong fit on the prepared read" : `mentions ${fit.hit} of the ${fit.total} things your title is screened for`);
  else if (level === "possible") reasons.push(fitLevel ? "possible fit" : `mentions ${fit.hit} of ${fit.total} on your checklist`);
  else if (level === "weak") reasons.push("weak fit: little of your checklist is in the posting");
  if (age != null) reasons.push(age <= FRESH_DAYS ? `posted ${ageLabel(role.published_at || role.first_seen_at, now)}: early is good` : `posted ${ageLabel(role.published_at || role.first_seen_at, now)}`);
  if (role.min_years) reasons.push(`asks ${role.min_years}+ years`);
  if (insiders.length) {
    return { label: "reach", reasons: [`you know ${insiders[0].name} there${insiders.length > 1 ? ` and ${insiders.length - 1} more` : ""}: write first`, ...reasons], insiders };
  }
  if (level === "weak") return { label: "skip", reasons };
  return { label: "apply", reasons, fit: level, hits: fit.hit };
}

/** The week's five: apply first (fresh and strong before the rest), then reach-first, never skips. */
export function pickWeek(roles, context, count = 5) {
  const rank = { apply: 0, reach: 1, skip: 9 };
  const level = { strong: 0, possible: 1 };
  return (roles ?? [])
    .map((role) => ({ role, v: verdict(role, { ...context, insiders: context.insidersOf?.(role) ?? [] }) }))
    .filter((x) => x.v.label !== "skip")
    .sort((a, b) => rank[a.v.label] - rank[b.v.label] || (level[a.v.fit] ?? 2) - (level[b.v.fit] ?? 2) || (b.v.hits ?? 0) - (a.v.hits ?? 0))
    .slice(0, count);
}
