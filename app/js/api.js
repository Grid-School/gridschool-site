/**
 * The data seam. Static JSON for the tour. A real seat without a public
 * student file seeds identity from the notebook API.
 */

import { loadPrivateJson } from "./gate.js";
import { seedFromSnapshot } from "./persist.js";
import { fetchSnapshot, remoteEnabled } from "./persist-remote.js";

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

/**
 * Local/dev reads data/students/<slug>.json. On the public tour that file is
 * stripped for private seats. The notebook API is then the seed: identity
 * from Postgres, live writes from hydrate. Demo never takes this path.
 */
export async function loadStudent(slug) {
  const path = `students/${slug}.json`;
  try {
    return await getJson(path);
  } catch (error) {
    cache.delete(path);
    if (slug === "demo" || !remoteEnabled(slug)) throw error;
    const snap = await fetchSnapshot(slug);
    if (!snap?.slug) throw error;
    const seed = seedFromSnapshot(snap);
    cache.set(path, Promise.resolve(seed));
    return seed;
  }
}
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
