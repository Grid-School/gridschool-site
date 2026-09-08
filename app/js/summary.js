/**
 * Cohort-wide derivation. One function that answers "who is where" for every
 * board, built from the same model the student sees so the two can never disagree.
 */

import { loadRoster, loadStudent, loadCurriculum, loadCohort } from "./api.js";
import { readOverlay, mergeStudent, listEvents } from "./overlay.js";
import { hydrateFromRemote, remoteEnabled } from "./persist-remote.js";
import { listPersistSlugs } from "./persist-admin.js";
import { buildGraph, progress, nextUp, STATUS } from "./graph/model.js";
import { quotaStatus, waitingOn, buildQueue } from "./tasks.js";
import { weekNumber } from "./time.js";

export async function loadCohortBoards() {
  const [roster, curriculum, cohort, persistSlugs] = await Promise.all([
    loadRoster(),
    loadCurriculum(),
    loadCohort(),
    listPersistSlugs(),
  ]);
  const week = Math.min(Math.max(1, weekNumber(cohort.start)), cohort.weeks + 1);
  const slugs = [...new Set([...(roster.students ?? []), ...persistSlugs])];

  const boards = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const file = await loadStudent(slug);
        if (remoteEnabled(slug)) {
          try {
            await hydrateFromRemote(slug);
          } catch (error) {
            if (error.code !== "BAD_TOKEN") throw error;
          }
        }
        const student = mergeStudent(file, readOverlay(slug));
        const graph = buildGraph(curriculum, student);
        const attention = listEvents(slug, { attentionOnly: true });
        return summarize({ slug, student, graph, curriculum, cohort, week, attention });
      } catch (error) {
        return { slug, error: error.message };
      }
    })
  );

  return { boards: boards.filter((board) => !board.error), broken: boards.filter((b) => b.error), curriculum, cohort, week };
}

function summarize({ slug, student, graph, curriculum, cohort, week, attention = [] }) {
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
    signal: signalFor({ prog, quota, waiting, student, week, attention }),
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

function signalFor({ prog, quota, waiting, student, week, attention = [] }) {
  if (!student.focus || !student.next) return { tone: "warn", text: "No Focus or Next set" };
  if (waiting.reviews.length) return { tone: "wait", text: `${waiting.reviews.length} waiting on me` };
  if (attention.length) return { tone: "wait", text: `${attention.length} need a reply` };
  if (quota.active && !quota.met) return { tone: "warn", text: "Quota not met this week" };
  if (week > 2 && prog.spine.lit === 0) return { tone: "bad", text: "Nothing required lit past week 2" };
  return { tone: "ok", text: "Moving" };
}

export function litMatrix(boards, curriculum) {
  const nodes = curriculum.nodes.filter((node) => node.kind !== "future").sort((a, b) => a.n - b.n);
  return {
    nodes,
    rows: boards.map((board) => ({
      slug: board.slug,
      name: board.student.name,
      cells: nodes.map((node) => board.graph.byId.get(node.id)?.status ?? STATUS.LOCKED),
    })),
  };
}
