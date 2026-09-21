#!/usr/bin/env node
/**
 * Walk the required spine as a clean student. At every step the next node is
 * open, its ancestors are finished, and the number of open spine nodes stays
 * bounded.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGraph, STATUS, isSpine, nextUp, ancestorsOf } from "../app/js/graph/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const cur = JSON.parse(readFileSync(join(here, "curriculum.json"), "utf8"));
const MAX_OPEN_SPINE = 6;

function light(student, node) {
  if (node.completion === "tasks") {
    student.tasks = student.tasks ?? {};
    for (const task of node.tasks ?? []) {
      const answers = {};
      for (const field of task.fields ?? []) {
        if (field.required) answers[field.id] = "walk-path answer";
      }
      student.tasks[task.id] = { state: "done", answers };
    }
    return;
  }
  student.evidence = student.evidence ?? {};
  student.evidence[node.id] = { url: `https://example.test/${node.id}` };
  if (node.signoff) {
    student.reviews = student.reviews ?? [];
    student.reviews.unshift({
      id: `walk-${node.id}`,
      nodeId: node.id,
      state: "returned",
      outcome: "accepted",
      link: student.evidence[node.id].url,
    });
  }
}

const student = { evidence: {}, tasks: {}, reviews: [] };
const seen = [];
const familyTrack = new Map((cur.families ?? []).map((family) => [family.id, family.track]));
const required = cur.nodes.filter((node) => (node.track ?? familyTrack.get(node.family)) === "spine" && node.kind !== "future");

while (seen.length < required.length) {
  const graph = buildGraph(cur, student);
  const openSpine = graph.nodes.filter((node) => node.status === STATUS.OPEN && isSpine(node) && node.kind !== "future");
  if (openSpine.length > MAX_OPEN_SPINE) {
    throw new Error(`too many open spine nodes (${openSpine.length}): ${openSpine.map((n) => n.id).join(", ")}`);
  }
  const next = nextUp(graph);
  if (!next || !isSpine(next)) {
    throw new Error(`required path stalled after ${seen.join(" -> ") || "(start)"}; next=${next?.id ?? "none"}`);
  }
  const blocked = [...ancestorsOf(graph, next.id)].filter((id) => graph.byId.get(id)?.status !== STATUS.LIT);
  if (blocked.length) {
    throw new Error(`${next.id} is next but ancestors are dark: ${blocked.join(", ")}`);
  }
  light(student, next);
  seen.push(next.id);
}

const leftover = required.map((node) => node.id).filter((id) => !seen.includes(id));
if (leftover.length) {
  throw new Error(`required nodes never reached: ${leftover.join(", ")}`);
}

console.log(`required path walk passed (${seen.length} spine nodes)`);
console.log(seen.join(" -> "));
