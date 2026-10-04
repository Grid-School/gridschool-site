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

export const TRACKS = new Set(["spine", "depth", "side"]);
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

  const requiresOf = (node) => (Array.isArray(node.requires) ? node.requires.filter((r) => typeof r === "string") : []);
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

  errors.push(...cycleErrors(byId, requiresOf));
  errors.push(...taskErrors(byId, Array.isArray(doc.weekly) ? doc.weekly : []));
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
