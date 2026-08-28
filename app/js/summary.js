/**
 * Cohort-wide derivation. One function that answers "who is where" for every
 * board, built from the same model the student sees so the two can never disagree.
 */

import { loadRoster, loadStudent, loadCurriculum, loadCohort } from "./api.js";
import { readOverlay, mergeStudent } from "./overlay.js";
import { buildGraph, progress, nextUp, STATUS } from "./graph/model.js";
import { quotaStatus, waitingOn, buildQueue } from "./tasks.js";
import { weekNumber } from "./time.js";

export async function loadCohortBoards() {
  const [roster, curriculum, cohort] = await Promise.all([loadRoster(), loadCurriculum(), loadCohort()]);
  const week = Math.min(Math.max(1, weekNumber(cohort.start)), cohort.weeks + 1);

  const boards = await Promise.all(
    roster.students.map(async (slug) => {
      try {
        const file = await loadStudent(slug);
        const student = mergeStudent(file, readOverlay(slug));
        const graph = buildGraph(curriculum, student);
        return summarize({ slug, student, graph, curriculum, cohort, week });
      } catch (error) {
        return { slug, error: error.message };
      }
    })
  );

  return { boards: boards.filter((board) => !board.error), broken: boards.filter((b) => b.error), curriculum, cohort, week };
}

function summarize({ slug, student, graph, curriculum, cohort, week }) {
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
    /** The single line I need in a glance: is this person moving or stalled? */
    signal: signalFor({ prog, quota, waiting, student, week }),
  };
}

function signalFor({ prog, quota, waiting, student, week }) {
  if (!student.focus || !student.next) return { tone: "warn", text: "No Focus or Next set" };
  if (waiting.reviews.length) return { tone: "wait", text: `${waiting.reviews.length} waiting on me` };
  if (quota.active && !quota.met) return { tone: "warn", text: "Quota not met this week" };
  if (week > 2 && prog.lit === 0) return { tone: "bad", text: "Nothing lit past week 2" };
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
