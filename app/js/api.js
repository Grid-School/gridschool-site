/**
 * The data seam. Today every read is a static JSON file. When a real backend
 * exists, only the four fetch calls in this file change.
 */

const BASE = "../data/";
const cache = new Map();

async function getJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(BASE + path, { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return res.json();
  });
  cache.set(path, promise);
  return promise;
}

import { loadPrivateJson } from "./gate.js";

/**
 * Plaintext in local development; decrypted through the gate on the live site.
 * The demo tour reads the public copy instead: the same map with the lesson
 * text stripped, so a visitor can walk the whole platform without the key.
 */
export const loadCurriculum = ({ tour = false } = {}) => {
  // Distinct from the getJson key for the public file, or the tour promise
  // would find itself in the cache and wait on itself forever.
  const cacheKey = tour ? "curriculum:tour" : "curriculum.json";
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const promise = fetch(BASE + "curriculum.json", { cache: "no-store" }).then((res) => {
    if (res.ok) return res.json();
    if (tour) return getJson("curriculum.public.json");
    return loadPrivateJson(BASE + "curriculum.enc.json");
  });
  cache.set(cacheKey, promise);
  return promise;
};
export const loadCohort = () => getJson("cohort.json");
export const loadRoster = () => getJson("roster.json");
export const loadStudent = (slug) => getJson(`students/${slug}.json`);
export const loadCoach = () => getJson("coach.json");
export const loadLibrary = () => getJson("library.json");

/** The Coach system prompt. Markdown, not JSON, and read by two surfaces. */
export async function loadCoachPrompt(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url, { cache: "no-store" })
    .then((res) => (res.ok ? res.text() : ""))
    .then((text) => text.trim())
    .catch(() => "");
  cache.set(url, promise);
  return promise;
}

export function isValidSlug(slug) {
  return typeof slug === "string" && /^[a-z0-9-]{1,40}$/.test(slug);
}

/** Load everything one board needs, in parallel. */
export async function loadBoard(slug, { tour = false } = {}) {
  const [curriculum, cohort, student] = await Promise.all([
    loadCurriculum({ tour }),
    loadCohort(),
    loadStudent(slug),
  ]);
  return { curriculum, cohort, student };
}
