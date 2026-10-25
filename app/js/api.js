/**
 * The data seam. Static JSON for the tour. A real seat without a public
 * student file seeds identity from the notebook API.
 */

import { loadPrivateJson } from "./gate.js?v=d177a03-202610252138";
import { seedFromSnapshot } from "./persist.js?v=d177a03-202610252138";
import { fetchSnapshot, remoteEnabled } from "./persist-remote.js?v=d177a03-202610252138";
import { applySiteOverrides, applyPrivateLinks, applyCopyOverrides } from "../../js/site-overrides.js?v=d177a03-202610252138";
import { revealMemberInvite } from "../../js/member-invite.js?v=d177a03-202610252138";
import { numberCurriculumReadings } from "./reading-order.js?v=d177a03-202610252138";
import { resolveMap, loadModules, moduleRefs } from "./modules.js?v=d177a03-202610252138";

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
  }).then(numberCurriculumReadings);
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

/**
 * A student's own map, when they have one. Each student is planned against
 * their goals; the universal curriculum stays the demo, the tour, and the
 * fallback for anyone whose map has not been published yet. A resolved map
 * has the curriculum's shape, so everything downstream reads it unchanged.
 */
export function usableMap(map) {
  return map && typeof map === "object" && Array.isArray(map.nodes) && map.nodes.length ? map : null;
}

/** The modules a student's map places (modules.js). Empty for a free-form map or none. */
export function libraryFor(student) {
  const refs = moduleRefs(usableMap(student?.map));
  return refs.length ? loadModules(refs) : Promise.resolve({});
}

/**
 * The one seam where a stored map becomes the board's curriculum: module
 * instances resolve against `library` (an unknown module shows as a
 * placeholder step, never silently dropped), then readings are numbered in
 * board order, then copy edits from the console apply by node id.
 */
export function boardCurriculum({ universal, student, slug, tour = false, overrides, library = {} }) {
  const map = slug === "demo" || tour ? null : usableMap(student?.map);
  const source = map ? numberCurriculumReadings({ families: [], phases: [], weekly: [], ...resolveMap(map, library) }) : universal;
  return applyCopyOverrides(source, overrides);
}

/** Which made-up seat a demo link asks for: ?map=complete (paid) or ?map=free. */
const DEMO_MAPS = { complete: "../demo/complete-map.json", free: "../demo/free-map.json" };

/** The demo board's Complete or free map, when the link asks for it (?map=complete, ?map=free). Null otherwise. */
async function demoCompleteSeat(student) {
  const file = DEMO_MAPS[new URLSearchParams(globalThis.location?.search || "").get("map")];
  if (!file) return null;
  try {
    const res = await fetch(new URL(file, globalThis.location.href));
    if (!res.ok) return null;
    const doc = await res.json();
    return { ...student, map: doc.map, prep: doc.prep, identity: { ...(student?.identity ?? {}), name: doc.name } };
  } catch {
    return null; // the universal demo board still opens
  }
}

/** Load everything one board needs, in parallel. */
export async function loadBoard(slug, { tour = false, publicCopy = false } = {}) {
  const [curriculum, cohort, student, overrides] = await Promise.all([
    // publicCopy: a free seat without the lesson key reads the public course copy, but keeps its own map.
    loadCurriculum({ tour: tour || publicCopy }),
    loadCohort(),
    loadStudent(slug),
    // Live links and short copy edits from the console. Never blocks a board
    // for long and never fails it: config.js and the repo mirror stand in.
    applySiteOverrides(),
  ]);
  // Walkthroughs: /app/?s=demo&map=complete shows a made-up Complete seat's map (demo/complete-map.json,
  // written by ops/make-demo-map.py) instead of the residency curriculum; ?map=free shows the same seat on
  // the free plan (demo/free-map.json). Still the signed-out demo board.
  const demoSeat = slug === "demo" && !tour ? await demoCompleteSeat(student) : null;
  const seat = demoSeat ?? student;
  const library = (slug === "demo" && !demoSeat) || tour ? {} : await libraryFor(seat);
  await applyPrivateLinks();
  revealMemberInvite({ slug });
  return {
    curriculum: boardCurriculum({ universal: curriculum, student: seat, slug: demoSeat ? "demo-complete" : slug, tour, overrides, library }),
    universal: curriculum,
    cohort,
    student: seat,
    overrides,
  };
}
