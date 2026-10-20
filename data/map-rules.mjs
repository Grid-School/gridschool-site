/**
 * The rules every map must meet, the universal demo map and each student's
 * own map alike. A JS port of `validateMap` in site/server/maps.py (the gate
 * a map passes before it is stored): keep the two in step. These are the
 * failures the board cannot recover from at runtime: a family or prerequisite
 * that does not exist, a cycle (nothing would ever open), an `n` order that
 * disagrees with `requires` (the floor walks in `n` order), a required node
 * that waits on a side quest, and task ids that collide (task state is keyed
 * by id, so two tasks would share one checkbox).
 *
 * Pure. Returns every error so a map is fixed in one pass.
 */

import { NODE_TYPES } from "./node-types.mjs?v=5529d91-202610200519";

export const TRACKS = new Set(["spine", "depth", "side"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const NODE_KINDS = new Set(["core", "future"]);
export const COUNT_PERIODS = new Set(["day", "week"]);
export const REQUIRED_TOP = ["version", "title", "families", "phases", "nodes", "weekly"];
export const REQUIRED_NODE = ["id", "n", "title", "family", "requires", "tasks", "kind"];
export const MAX_MAP_BYTES = 2_000_000;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const isInt = (value) => Number.isInteger(value);

export function validateMap(doc) {
  if (!isObject(doc)) return ["map must be a JSON object"];
  const errors = [];
  const size = JSON.stringify(doc).length;
  if (size > MAX_MAP_BYTES) errors.push(`map is ${size} bytes; the limit is ${MAX_MAP_BYTES}`);

  for (const key of REQUIRED_TOP) if (!(key in doc)) errors.push(`missing top-level key: ${key}`);
  if ("version" in doc && typeof doc.version !== "string") errors.push("version must be a string");
  if ("title" in doc && typeof doc.title !== "string") errors.push("title must be a string");
  if ("law" in doc && typeof doc.law !== "string") errors.push("law must be a string");
  for (const key of ["families", "phases", "nodes", "weekly"]) {
    if (key in doc && !Array.isArray(doc[key])) errors.push(`${key} must be a list`);
  }

  const families = Array.isArray(doc.families) ? doc.families : [];
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];

  const familyTrack = new Map();
  families.forEach((family, index) => {
    if (!isObject(family) || typeof family.id !== "string" || !family.id) {
      errors.push(`families[${index}] needs a string id`);
      return;
    }
    const fid = family.id;
    if (familyTrack.has(fid)) errors.push(`duplicate family id: ${fid}`);
    if (!TRACKS.has(family.track)) errors.push(`family ${fid}: track must be one of spine, depth, side`);
    if ("lane" in family && !isNumber(family.lane)) errors.push(`family ${fid}: lane must be a number`);
    familyTrack.set(fid, family.track);
  });

  const byId = new Map();
  nodes.forEach((node, index) => {
    if (!isObject(node) || typeof node.id !== "string" || !node.id) {
      errors.push(`nodes[${index}] needs a string id`);
      return;
    }
    const nid = node.id;
    if (byId.has(nid)) {
      errors.push(`duplicate node id: ${nid}`);
      return;
    }
    byId.set(nid, node);
    for (const key of REQUIRED_NODE) if (!(key in node)) errors.push(`node ${nid}: missing ${key}`);
    if ("n" in node && !isNumber(node.n)) errors.push(`node ${nid}: n must be a number`);
    if ("title" in node && typeof node.title !== "string") errors.push(`node ${nid}: title must be a string`);
    if ("kind" in node && !NODE_KINDS.has(node.kind)) errors.push(`node ${nid}: kind must be core or future`);
    if ("family" in node && !familyTrack.has(node.family)) errors.push(`node ${nid}: family ${JSON.stringify(node.family)} does not exist`);
    if ("track" in node && !TRACKS.has(node.track)) errors.push(`node ${nid}: track must be one of spine, depth, side`);
    if ("requires" in node && !(Array.isArray(node.requires) && node.requires.every((r) => typeof r === "string"))) {
      errors.push(`node ${nid}: requires must be a list of node ids`);
    }
    if ("tasks" in node && !Array.isArray(node.tasks)) errors.push(`node ${nid}: tasks must be a list`);
  });

  const { groups, errors: groupErrors } = groupsOf(doc, byId);
  errors.push(...groupErrors);
  /** Prerequisite node ids; a group id stands for every node in the group. */
  const requiresOf = (node) =>
    (Array.isArray(node.requires) ? node.requires.filter((r) => typeof r === "string") : []).flatMap((r) => (groups.has(r) ? groups.get(r).members : [r]));
  const trackOf = (node) => (TRACKS.has(node.track) ? node.track : familyTrack.get(node.family));

  const seenN = new Map();
  for (const [nid, node] of byId) {
    const n = node.n;
    if (isNumber(n)) {
      if (seenN.has(n)) errors.push(`node ${nid}: n ${n} is already used by ${seenN.get(n)}`);
      else seenN.set(n, nid);
    }
    for (const req of requiresOf(node)) {
      const prereq = byId.get(req);
      if (!prereq) {
        errors.push(`node ${nid}: requires ${JSON.stringify(req)}, which does not exist`);
        continue;
      }
      if (req === nid) continue; // reported as a cycle below
      if (isNumber(n) && isNumber(prereq.n) && !(n > prereq.n)) {
        errors.push(`node ${nid}: n ${n} must be greater than prerequisite ${req} (n ${prereq.n})`);
      }
      const track = trackOf(node);
      if ((track === "spine" || track === "depth") && trackOf(prereq) === "side") {
        errors.push(`node ${nid}: a ${track} node cannot require side quest ${req}`);
      }
    }
  }

  errors.push(...typeErrors(byId, groups, requiresOf, trackOf));
  errors.push(...cycleErrors(byId, requiresOf));
  errors.push(...taskErrors(byId, Array.isArray(doc.weekly) ? doc.weekly : []));
  return errors;
}

/** Parallel groups: nodes that share a place on the road, done in any order. A port of maps.py `_groups`. */
export function groupsOf(doc, byId) {
  const modes = NODE_TYPES.groupModes ?? {};
  const errors = [];
  const groups = new Map();
  const raw = doc.groups ?? [];
  if (!Array.isArray(raw)) return { groups, errors: ["groups must be a list"] };
  raw.forEach((group, index) => {
    if (!isObject(group) || typeof group.id !== "string" || !group.id) return errors.push(`groups[${index}] needs a string id`);
    const gid = group.id;
    if (groups.has(gid) || byId.has(gid)) return errors.push(`group ${gid}: id is already used`);
    if (!((group.mode ?? "all") in modes)) errors.push(`group ${gid}: mode must be one of ${Object.keys(modes).join(", ")}`);
    groups.set(gid, { ...group, members: [] });
  });
  for (const [nid, node] of byId) {
    if (node.group === undefined || node.group === null) continue;
    if (!groups.has(node.group)) errors.push(`node ${nid}: group ${JSON.stringify(node.group)} does not exist`);
    else groups.get(node.group).members.push(nid);
  }
  for (const [gid, group] of groups) {
    const count = group.members.length;
    if (count < 2) errors.push(`group ${gid}: a group needs at least 2 nodes (has ${count})`);
    if (group.mode === "pick" && !(isInt(group.pick) && group.pick >= 1 && group.pick <= Math.max(count, 1))) {
      errors.push(`group ${gid}: pick must be a whole number from 1 to ${count}`);
    }
  }
  return { groups, errors };
}

/** The node-type rules (data/node-types.json). A port of maps.py `_type_errors`. */
/** Optional `basis`: why we think this step matters, and how sure we are (GridSchool Complete maps). Same as maps.py. */
function basisErrors(nid, node) {
  if (!("basis" in node)) return [];
  const basis = node.basis;
  const confidences = Object.keys(NODE_TYPES.confidences ?? {});
  if (!basis || typeof basis !== "object" || Array.isArray(basis) || !("confidence" in basis)) return [`node ${nid}: basis must be an object with a confidence`];
  const errors = [];
  if (!confidences.includes(basis.confidence)) errors.push(`node ${nid}: basis.confidence must be one of ${confidences.join(", ")}`);
  const because = basis.because ?? [];
  if (!(Array.isArray(because) && because.every((line) => typeof line === "string"))) errors.push(`node ${nid}: basis.because must be a list of sentences`);
  return errors;
}

/** Optional `stages`: the prepared-work tracker on a Complete step, in order. Same as maps.py `_stage_errors`. */
function stageErrors(nid, node) {
  if (!("stages" in node)) return [];
  const stages = node.stages;
  const ok = (s) => isObject(s) && typeof s.id === "string" && s.id && typeof s.label === "string" && s.label;
  if (!(Array.isArray(stages) && stages.length && stages.every(ok))) return [`node ${nid}: stages must be a list of {id, label}`];
  const seen = new Set();
  const errors = [];
  for (const stage of stages) {
    if (seen.has(stage.id)) errors.push(`node ${nid}: stage ${stage.id} is used twice`);
    seen.add(stage.id);
  }
  return errors;
}

function typeErrors(byId, groups, requiresOf, trackOf) {
  const types = NODE_TYPES.types;
  const errors = [];
  const typeOf = (node) => node.type ?? "step";
  for (const [nid, node] of byId) {
    const kind = typeOf(node);
    const spec = types[kind];
    if (!spec) {
      errors.push(`node ${nid}: type ${JSON.stringify(kind)} is not one of ${Object.keys(types).join(", ")}`);
      continue;
    }
    if (spec.needsField && !node[spec.needsField]) errors.push(`node ${nid}: a ${kind} node needs ${spec.needsField}`);
    if (spec.onRoad === false && trackOf(node) !== "side") errors.push(`node ${nid}: a ${kind} node sits off the road (track: side)`);
    if ("due" in node && !(typeof node.due === "string" && DATE.test(node.due))) errors.push(`node ${nid}: due must be a date like 2026-10-16`);
    if ("opens" in node && !(typeof node.opens === "string" && DATE.test(node.opens))) errors.push(`node ${nid}: opens must be a date like 2026-10-16`);
    errors.push(...stageErrors(nid, node));
    errors.push(...basisErrors(nid, node));
    for (const req of requiresOf(node)) {
      const prereq = byId.get(req);
      if (prereq && types[typeOf(prereq)]?.gates === false) errors.push(`node ${nid}: nothing can wait on ${req}, a ${typeOf(prereq)} node`);
    }
    const before = spec.mustFollowOneOf;
    if (before) {
      const seen = new Set();
      const stack = [...requiresOf(node)];
      let found = false;
      while (stack.length && !found) {
        const current = stack.pop();
        if (seen.has(current) || !byId.has(current)) continue;
        seen.add(current);
        found = before.includes(typeOf(byId.get(current)));
        stack.push(...requiresOf(byId.get(current)));
      }
      if (!found) errors.push(`node ${nid}: a ${kind} node must come after a ${before.join(" or ")} node`);
    }
  }
  for (const [gid, group] of groups) {
    const tracks = new Set(group.members.filter((m) => byId.has(m)).map((m) => trackOf(byId.get(m))));
    if (tracks.size > 1) errors.push(`group ${gid}: its nodes must share a track`);
  }
  return errors;
}

function cycleErrors(byId, requiresOf) {
  const state = new Map();
  const errors = [];
  const visit = (id, path) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "active") {
      errors.push(`requires has a cycle: ${[...path.slice(path.indexOf(id)), id].join(" -> ")}`);
      return;
    }
    state.set(id, "active");
    for (const req of requiresOf(byId.get(id))) if (byId.has(req)) visit(req, [...path, id]);
    state.set(id, "done");
  };
  for (const id of byId.keys()) visit(id, []);
  return errors;
}

function taskErrors(byId, weekly) {
  const errors = [];
  const seen = new Map();
  const check = (task, where) => {
    if (!isObject(task) || typeof task.id !== "string" || !task.id) {
      errors.push(`${where}: every task needs a string id`);
      return;
    }
    const tid = task.id;
    if (seen.has(tid)) errors.push(`task id ${tid} is used twice (${seen.get(tid)} and ${where})`);
    else seen.set(tid, where);
    if (tid.includes("#")) errors.push(`task ${tid}: ids cannot contain '#' (it separates the habit period)`);
    if (task.kind === "count") {
      if (!isInt(task.target) || task.target < 1) errors.push(`task ${tid}: a count task needs an integer target of at least 1`);
      if (!COUNT_PERIODS.has(task.per)) errors.push(`task ${tid}: a count task needs per: day or week`);
    }
  };
  for (const [nid, node] of byId) {
    if (Array.isArray(node.tasks)) for (const task of node.tasks) check(task, `node ${nid}`);
  }
  for (const task of weekly) check(task, "weekly");
  return errors;
}
