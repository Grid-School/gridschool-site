/**
 * Who a step's video is for: "free" or "paid". The one rule, read by the board
 * (app/js/views/step.js) and mirrored by the server (server/video_access.py),
 * which keeps a paid video's address off a free seat's page. Both are checked
 * against the same cases (data/video-access-cases.json).
 *
 * Only a free seat is affected. Complete and residency seats see every video
 * exactly as before.
 *
 * 1. A video that says `access: "free"` or `access: "paid"` is that.
 * 2. Otherwise, a step we do for them (it has a `stages` tracker) is paid.
 * 3. The steps a free seat can use are free: today's step (t.*), the question
 *    chunks (a `chunk`), the week-one check-in (w.*).
 * 4. Campaigns, and anything in the interview lane or the "land" phase
 *    (mock interviews, company prep, the story bank, warm asks) are paid.
 * 5. A course step (phase "course", server/complete_map.py COURSE) is free only
 *    for the FREE_MODULES; the rest of the course is the paid plan's.
 * 6. Everything else (foundation and starter steps) is free.
 */

export const ACCESS = new Set(["free", "paid"]);
/** The course modules a free seat gets whole, film included (server/complete_map.py FREE_MODULES). */
export const FREE_MODULES = Object.freeze(["profile-images", "profile-rewrite"]);

/** "profile-images" from a node's module ref ("profile-images@1"), resolved or not. */
export function moduleId(node) {
  return String(node?.moduleRef ?? node?.module ?? "").split("@")[0];
}

export function isCourseStep(node) {
  return node?.phase === "course" && Boolean(moduleId(node));
}

export function videoAccess(video, node) {
  if (ACCESS.has(video?.access)) return video.access;
  const n = node ?? {};
  if (isCourseStep(n)) return FREE_MODULES.includes(moduleId(n)) ? "free" : "paid";
  if (Array.isArray(n.stages) && n.stages.length) return "paid";
  const id = String(n.id ?? "");
  if (id.startsWith("t.") || id.startsWith("w.") || n.chunk) return "free";
  if (n.type === "campaign") return "paid";
  if (n.phase === "land" || n.family === "interview") return "paid";
  return "free";
}

/** A video with somewhere to play: an uploaded path or a YouTube id. */
export function isFilmed(video) {
  return Boolean(video && (video.path || video.youtube || video.filmed === true));
}
