/**
 * A Complete or free map as one route (graph/rez draws it). Pure.
 *
 * A Complete map's steps carry no `requires`, so nothing joins them; the route
 * joins them by `n`, the order complete_map.py builds them in (today's step,
 * the free sample on a free seat, what we prepare, the questions, the week-one
 * check-in). The server numbers them; this file only follows the numbers, so
 * the two never disagree. Two landmarks bracket it, and they are not steps:
 *
 * - "Scan done", lit, first: they arrive one step in (the free check);
 * - "Interviews", last: where the route leads, like the check map's "An offer".
 *
 * On a free map only:
 * - question steps past the next two fold into one node, "N more short steps",
 *   until it's opened in place;
 * - the free sample is followed by "4 more waiting on the full plan";
 * - the done-for-you step that matches their top finding is their biggest win;
 * - "See the full plan" previews the done-for-you steps as the paid plan shows
 *   them, trackers moving. A preview, never progress.
 *
 * Landmarks and folds are drawn nodes with ids starting "_": the board's own
 * graph (progress, next, the step pages) never holds them.
 */

import { isCompleteMap, isFreeMap, shortDay, COURSE_HINT } from "../prep.js?v=9300f22-202610261745";

export const SHOWN_QUESTIONS = 2;
export const WIN_LABEL = "Your biggest win";
export const DFY_HINT = "We do this for you";

const isQuestion = (node) => node.phase === "learn" || /^q\./.test(node.id);

/** The done-for-you step their top finding points at: the first one built (complete_map orders by finding). */
export function biggestWin(graph) {
  const done = (graph?.nodes ?? []).filter((node) => Array.isArray(node.stages) && node.stages.length);
  return done.sort((a, b) => a.n - b.n)[0]?.id ?? null;
}

/** What a done-for-you step shows in the full-plan preview: stages moving, never all done. */
export function previewHint(node, index) {
  // Never a stage that says we found a person: that research isn't built, so the preview never shows it.
  const stages = (node?.stages ?? []).filter((stage) => !/hiring manager/i.test(stage.label));
  if (!stages.length) return null;
  const at = [Math.min(1, stages.length - 1), stages.length - 2, 0][index % 3];
  return stages[Math.max(0, at)].label;
}

export function routeGraph(graph, { foldOpen = false, fullPlan = false } = {}) {
  if (!isCompleteMap(graph)) return graph;
  const free = isFreeMap(graph);
  const ordered = [...graph.nodes].sort((a, b) => a.n - b.n);
  const out = [];
  const families = graph.families ?? [];
  const familyOr = (wanted) => (families.some((f) => f.id === wanted) ? wanted : families[0]?.id ?? ordered[0]?.family);
  const winId = free ? biggestWin(graph) : null;
  const first = ordered[0];

  out.push({
    id: "_scan", n: (first?.n ?? 1) - 1, title: "Scan done", landmark: "scan", status: "lit", track: "spine",
    family: first?.family ?? familyOr("pipeline"), phase: first?.phase ?? "now", sideNumber: "✓",
    hint: graph.started ? shortDay(graph.started) : null, tasks: [],
  });

  // Questions: the next two stay, the rest wait in one node on a free map.
  const open = ordered.filter((node) => isQuestion(node) && node.status !== "lit");
  const folded = free && !foldOpen && open.length > SHOWN_QUESTIONS ? new Set(open.slice(SHOWN_QUESTIONS).map((node) => node.id)) : new Set();
  // The course past the free modules: one node on a free map, every step once they ask to see the full plan.
  const lockedCourse = free && !fullPlan ? ordered.filter((node) => node.course && node.paidOnly) : [];
  const courseFold = new Set(lockedCourse.map((node) => node.id));
  let dfyIndex = 0;
  for (const node of ordered) {
    if (folded.has(node.id) || courseFold.has(node.id)) continue;
    let shown = node;
    if (free && node.course) {
      shown = { ...node, preview: fullPlan, hint: COURSE_HINT };
    } else if (free && node.paidOnly) {
      const win = node.id === winId;
      shown = fullPlan
        ? { ...node, preview: true, win, hint: previewHint(node, dfyIndex) }
        : { ...node, win, hint: node.status === "lit" ? node.hint : DFY_HINT };
      dfyIndex += 1;
    }
    out.push(shown);
    if (free && node.id === "f.sample" && node.waiting) {
      out.push({
        id: "_waiting", n: node.n + 0.5, title: `${node.waiting} more waiting on the full plan`, landmark: "waiting",
        status: "open", track: "spine", family: node.family, phase: node.phase, sideNumber: `+${node.waiting}`,
        paidOnly: true, preparing: true, preview: fullPlan, hint: fullPlan ? "Finding roles" : DFY_HINT, tasks: [],
      });
    }
    if (lockedCourse.length && node.id === ordered.filter((item) => item.phase === "course" && !courseFold.has(item.id)).at(-1)?.id) {
      out.push({
        id: "_course", n: node.n + 0.5, title: `${lockedCourse.length} more course steps in the full plan`, landmark: "waiting",
        status: "open", track: "spine", family: node.family, phase: node.phase, sideNumber: `+${lockedCourse.length}`,
        paidOnly: true, course: true, preparing: true, preview: false, hint: COURSE_HINT, tasks: [],
      });
    }
    if (folded.size && node.id === open[SHOWN_QUESTIONS - 1]?.id) {
      out.push({
        id: "_more", n: node.n + 0.5, title: `${folded.size} more short steps`, landmark: "more", status: "open",
        track: "spine", family: node.family, phase: node.phase, sideNumber: `+${folded.size}`, hint: "Tap to show them", preparing: true, tasks: [],
      });
    }
  }
  const last = ordered.at(-1);
  out.push({
    id: "_goal", n: (last?.n ?? 0) + 1, title: "Interviews", landmark: "goal", status: "future", track: "spine",
    family: last?.family ?? familyOr("pipeline"), phase: last?.phase ?? "week", sideNumber: " ", tasks: [],
  });
  const ids = new Set(out.map((node) => node.id));
  return {
    ...graph,
    route: true,
    nodes: out,
    byId: new Map(out.map((node) => [node.id, node])),
    edges: (graph.edges ?? []).filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
  };
}

/** The landmark ids a click must not open as a step. */
export const isLandmark = (id) => typeof id === "string" && id.startsWith("_");

