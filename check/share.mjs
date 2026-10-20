/**
 * Where a visitor came from, and what the check says first because of it.
 * Pure functions, no DOM, so node --test covers them (share.test.mjs).
 *
 * sources.json holds every word: `lines` (exact ?from= values and campaign
 * keys), `prefixes` (a rule for a whole family, such as share:<ref>) and
 * `filter` (the one small line under an ad's first line).
 */

export const SHARE_PREFIX = "share:";
export const SHARE_BASE = "https://gridschool.org/check/";

/** Where they came from: ?from=, or an ad's utm tags as source:campaign. Cleaned like the server's events.clean_source. */
export function arrivedFrom(search) {
  const params = new URLSearchParams(search);
  const raw = params.get("from") || [params.get("utm_source"), params.get("utm_campaign")].filter(Boolean).join(":");
  return cleanSource(raw);
}

export const cleanSource = (value) => String(value || "").replace(/[^\w:.-]/g, "").slice(0, 60);

/**
 * The key in sources.lines this visitor matches: the whole `from`, or the campaign part of
 * `facebook:meta-silence` (utm_source + utm_campaign), so a Meta ad lands on its own line either way.
 */
export function lineKey(from, lines = {}) {
  if (!from) return "";
  if (Object.hasOwn(lines, from)) return from;
  const campaign = from.slice(from.indexOf(":") + 1);
  return from.includes(":") && Object.hasOwn(lines, campaign) ? campaign : "";
}

/** The first line on question 1 for this visitor, or "". Exact lines win over prefix rules. */
export function sourceLine(from, sources = {}) {
  const key = lineKey(from, sources.lines || {});
  if (key) return sources.lines[key];
  for (const [prefix, line] of Object.entries(sources.prefixes || {})) {
    if (from && from.startsWith(prefix) && from.length > prefix.length) return line;
  }
  return "";
}

/** Paid ads only (meta-… or ad-…, directly or as the utm campaign): they get the filter line. */
export function isAd(from) {
  const campaign = from && from.includes(":") ? from.slice(from.indexOf(":") + 1) : "";
  return [from || "", campaign].some((key) => /^(meta|ad)-/.test(key));
}

export function filterLine(from, sources = {}) {
  return isAd(from) && typeof sources.filter === "string" ? sources.filter.trim() : "";
}

/**
 * A short, public id for a saved check: the first 10 hex characters of SHA-256 of its id.
 * The check id itself opens the map, so it never goes in a shared link; the server can
 * recompute this (events.share_ref) to join a share back to the check that made it.
 */
export async function refFromCheck(checkId, subtle = globalThis.crypto?.subtle) {
  if (!checkId || !subtle) return "";
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(checkId));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 10);
}

/** A random 10-character ref for someone who hasn't saved, from [0-9a-z]. */
export function randomRef(random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  let out = "";
  while (out.length < 10) out += "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(random() * 36)];
  return out;
}

export const shareUrl = (ref) => `${SHARE_BASE}?from=${SHARE_PREFIX}${ref}`;
