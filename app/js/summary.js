/**
 * Cohort-wide derivation. One function that answers "who is where" for every
 * board, built from the same model the student sees so the two can never disagree.
 */

import { loadRoster, loadStudent, loadCurriculum, loadCohort, boardCurriculum, libraryFor } from "./api.js?v=5802f60-202610100134";
import { readOverlay, mergeStudent, listEvents } from "./overlay.js?v=5802f60-202610100134";
import { hydrateFromRemote, remoteEnabled } from "./persist-remote.js?v=5802f60-202610100134";
import { listPersistSlugs } from "./persist-admin.js?v=5802f60-202610100134";
import { buildGraph, progress, nextUp, STATUS } from "./graph/model.js?v=5802f60-202610100134";
import { quotaStatus, waitingOn, buildQueue } from "./tasks.js?v=5802f60-202610100134";
import { weekNumber, studentWeek, ownSchedule, hasOwnMap } from "./time.js?v=5802f60-202610100134";
import { quietSignal } from "./last-seen.js?v=5802f60-202610100134";

export async function loadCohortBoards() {
  const [roster, curriculum, cohort, persistSlugs] = await Promise.all([
    loadRoster(),
    loadCurriculum(),
    loadCohort(),
    listPersistSlugs(),
  ]);
  const week = Math.min(Math.max(1, weekNumber(cohort.start)), cohort.weeks + 1);
  // The public demo tour is not a student; the desk lists real boards only.
  const slugs = [...new Set([...(roster.students ?? []), ...persistSlugs])].filter((slug) => slug !== "demo");

  const boards = await Promise.all(
    slugs.map(async (slug) => {
      try {
        let file = await loadStudent(slug);
        let lastSeen; // undefined: unknown; null: never opened their board
        if (remoteEnabled(slug)) {
          try {
            const snap = await hydrateFromRemote(slug);
            if (snap && "last_seen_at" in snap) lastSeen = snap.last_seen_at ?? null;
            // The 1:1 record lives on the seat and the desk edits it; the
            // loaded file is cached, so take the slot from the fresh snapshot.
            const seat = snap?.identity?.oneone;
            // An empty seat record is a cleared slot on a real seat; on a seed
            // file with no map of its own it just means "never set".
            if (seat && typeof seat === "object" && (Object.keys(seat).length || hasOwnMap(file))) file = { ...file, oneone: seat };
            if (snap?.identity?.email) file = { ...file, email: snap.identity.email };
          } catch (error) {
            if (error.code !== "BAD_TOKEN") throw error;
          }
        }
        const student = mergeStudent(file, readOverlay(slug));
        // Each student works their own map and their own clock: the desk
        // must count the same steps and weeks their board shows.
        const own = boardCurriculum({ universal: curriculum, student, slug, library: await libraryFor(student) });
        const graph = buildGraph(own, student);
        const attention = listEvents(slug, { attentionOnly: true });
        return summarize({ slug, student, graph, curriculum: own, cohort: ownSchedule(cohort, student), week: studentWeek(student, week), attention, lastSeen });
      } catch (error) {
        return { slug, error: error.message };
      }
    })
  );

  return { boards: boards.filter((board) => !board.error), broken: boards.filter((b) => b.error), curriculum, cohort, week };
}

/** Week N of this student's own program, from the day they joined (time.js). */
export { studentWeek };

function summarize({ slug, student, graph, curriculum, cohort, week, attention = [], lastSeen }) {
  const prog = progress(graph);
  const quota = quotaStatus({ curriculum, student, cohort, week });
  const waiting = waitingOn({ graph, student });
  const queue = buildQueue({ graph, curriculum, student, week });
  const next = nextUp(graph);

  return {
    slug,
    student,
    graph,
    week,
    cohort,
    curriculum,
    progress: prog,
    quota,
    waiting,
    queueLength: queue.length,
    nextNode: next,
    attention,
    stage: stageFor(graph),
    /** The single line I need in a glance: is this person moving or stalled? */
    lastSeen,
    signal: signalFor({ prog, quota, waiting, student, week, attention, lastSeen }),
  };
}

/**
 * Where a student stands, as a verb for the next live call: are they watching,
 * driving a first ticket, shipping like a teammate, rehearsing the defense, or
 * running the search. Derived from the map, never set by hand, so it can not
 * drift from the evidence. Stage meanings: ops/weekly-call-template.md.
 */
export function stageFor(graph) {
  const status = (id) => graph.byId.get(id)?.status;
  if (status("cap.defend") === STATUS.LIT) return "searching";
  if (status("cap.review") === STATUS.LIT) return "defending";
  if (status("cap.change") === STATUS.LIT) return "participating";
  if (status("cap.change") === STATUS.OPEN) return "first ticket";
  return "shadowing";
}

function signalFor({ prog, quota, waiting, student, week, attention = [], lastSeen }) {
  // Silence first: a student who is not opening the board is the thing to act on.
  const quiet = quietSignal(lastSeen);
  if (quiet) return quiet;
  const missing = [!String(student.focus ?? "").trim() && "Focus", !String(student.next ?? "").trim() && "Next"].filter(Boolean);
  if (missing.length) return { tone: "warn", text: `No ${missing.join(" or ")} this week` };
  if (waiting.reviews.length) return { tone: "wait", text: `${waiting.reviews.length} waiting on me` };
  if (attention.length) return { tone: "wait", text: `${attention.length} need a reply` };
  if (quota.active && !quota.met) return { tone: "warn", text: "Quota not met this week" };
  if (week > 2 && prog.spine.lit === 0) return { tone: "bad", text: "Nothing required lit past week 2" };
  return { tone: "ok", text: "Moving" };
}
