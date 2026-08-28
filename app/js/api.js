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

/** Plaintext in local development; decrypted through the gate on the live site. */
export const loadCurriculum = () => {
  if (cache.has("curriculum.json")) return cache.get("curriculum.json");
  const promise = fetch(BASE + "curriculum.json", { cache: "no-store" }).then((res) => {
    if (res.ok) return res.json();
    return loadPrivateJson(BASE + "curriculum.enc.json");
  });
  cache.set("curriculum.json", promise);
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
export async function loadBoard(slug) {
  const [curriculum, cohort, student] = await Promise.all([
    loadCurriculum(),
    loadCohort(),
    loadStudent(slug),
  ]);
  return { curriculum, cohort, student };
}
