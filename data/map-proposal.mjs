/**
 * Suggested map changes: what a student proposes for their own map, and how
 * Aden reviews and merges it. Shared by the board (the student draws their
 * suggestion on their own map) and the console (Aden sees it as a diff, keeps
 * or drops each change, edits, and publishes).
 *
 * It works like a git branch over the map's version history (student_maps is
 * already append-only, one row per version):
 *
 *   base     the published version the student was looking at (the parent)
 *   ops      the change set, in order, each with the student's note (the commits)
 *   rebase   at review, the ops are replayed on whatever is live now; an op
 *            whose step has since gone is a conflict, shown and skipped
 *   merge    Aden keeps some ops, edits the result in the editor and publishes
 *            a new version; nothing is ever edited in place, so every earlier
 *            version can be restored
 *
 * Ops are semantic, never raw JSON, so a student can't put the map in a shape
 * the rules refuse: a new step always sits after a real step, in that step's
 * lane; a move never makes a loop; "doesn't fit" is a request, and on merge
 * the steps after it are rewired to what came before it, so nothing is left
 * stranded. server/map_proposals.py checks the same shapes before storing.
 *
 *   add     { id, after, title, note?, tasks?: [title], type?, before? }
 *                                                           a new step after `after`; with `before` (a step that
 *                                                           comes right after `after`) it goes between the two;
 *                                                           type: step (default), habit or milestone
 *   task    { id, node, title, note? }                      a new task on a step
 *   move    { id, node, after, note? }                      `node` comes after `after` instead
 *   retire  { id, node, note }                              this step no longer fits
 *   rename  { id, node, title, note? }                      a clearer name
 *   ask     { id, node?, note }                             "Aden, what should go here?"
 *   taskedit { id, node, task, title, note? }               new wording for one of a step's tasks
 *   taskdrop { id, node, task, note? }                      this task isn't needed
 *
 * A library step's tasks come from its module, so on merge a task edit or
 * removal gives that step its own copy (detach): the resolved step, with
 * Aden's notes and links kept and the same task ids, so progress survives.
 *
 * Pure: no DOM, no network. node --test covers it (map-proposal.test.mjs).
 */

import { validateMap } from "./map-rules.mjs?v=a8ec4dc-202610271940";

export const OP_KINDS = ["add", "task", "move", "retire", "rename", "ask", "taskedit", "taskdrop"];
export const MAX_OPS = 30;
export const MAX_TITLE = 120;
export const MAX_NOTE = 600;
export const MAX_TASKS = 6;
/** The kinds of step a student may add (node-types.json "who": "student"); meetings and checks are the coach's. */
export const ADD_TYPES = ["step", "habit", "milestone"];
const TYPE_WORD = { step: "step", habit: "every-week habit", milestone: "milestone" };
export const OP_ID = /^[a-z0-9]{4,16}$/;
/** Suggested steps get their own prefix, so they never collide with Aden's ids (side quests use "s."). */
export const NEW_PREFIX = "sg.";
const SIDE_BASE = 101;

/** What each op is called, in the student's words. */
export const OP_LABEL = {
  add: "New step",
  task: "New task",
  move: "Move",
  retire: "Doesn't fit anymore",
  rename: "Rename",
  ask: "Ask your coach",
  taskedit: "Edit task",
  taskdrop: "Remove task",
};

/** A short id for a new op: time plus randomness, lower-case base 36. */
export function newOpId(now = Date.now(), random = Math.random) {
  const time = now.toString(36).slice(-6);
  const rand = Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0");
  return `${time}${rand}`;
}

export const newNodeId = (op) => `${NEW_PREFIX}${op.id}`;
export const newTaskId = (op, index = 0) => (op.kind === "add" ? `${newNodeId(op)}.t${index + 1}` : `${op.node}.${op.id}`);

const isText = (value, max) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const optionalText = (value, max) => value === undefined || value === null || value === "" || (typeof value === "string" && value.length <= max);

/** Shape errors for one op (no map needed). The server runs the same checks. */
export function opShapeErrors(op) {
  if (!op || typeof op !== "object" || Array.isArray(op)) return ["each change must be an object"];
  const errors = [];
  if (!OP_KINDS.includes(op.kind)) return [`kind must be one of ${OP_KINDS.join(", ")}`];
  if (typeof op.id !== "string" || !OP_ID.test(op.id)) errors.push("id must be 4-16 lower-case letters or digits");
  const at = `${op.kind} ${op.id ?? "?"}`;
  const needsNode = ["task", "move", "retire", "rename", "taskedit", "taskdrop"].includes(op.kind);
  if (needsNode && !isText(op.node, 80)) errors.push(`${at}: node is missing`);
  if (op.kind === "ask" && !optionalText(op.node, 80)) errors.push(`${at}: node must be a step id`);
  if (["add", "move"].includes(op.kind) && !isText(op.after, 80)) errors.push(`${at}: after is missing`);
  if (["taskedit", "taskdrop"].includes(op.kind) && !isText(op.task, 120)) errors.push(`${at}: task is missing`);
  if (["add", "task", "rename", "taskedit"].includes(op.kind) && !isText(op.title, MAX_TITLE)) errors.push(`${at}: title must be 1-${MAX_TITLE} characters`);
  if (["retire", "ask"].includes(op.kind) ? !isText(op.note, MAX_NOTE) : !optionalText(op.note, MAX_NOTE)) {
    errors.push(`${at}: note ${["retire", "ask"].includes(op.kind) ? "is needed and " : ""}must be at most ${MAX_NOTE} characters`);
  }
  if (op.kind === "add" && op.type !== undefined && !ADD_TYPES.includes(op.type)) errors.push(`${at}: type must be one of ${ADD_TYPES.join(", ")}`);
  if (op.kind === "add" && !optionalText(op.before, 80)) errors.push(`${at}: before must be a step id`);
  if (op.kind === "add" && op.before && op.before === op.after) errors.push(`${at}: a step can't go between a step and itself`);
  if (op.kind === "add" && op.tasks !== undefined) {
    if (!Array.isArray(op.tasks) || op.tasks.length > MAX_TASKS || !op.tasks.every((t) => isText(t, MAX_TITLE))) {
      errors.push(`${at}: tasks must be up to ${MAX_TASKS} short titles`);
    }
  }
  if (op.kind === "move" && op.node === op.after) errors.push(`${at}: a step can't come after itself`);
  return errors;
}

/** Shape errors for a whole change set. */
export function opsShapeErrors(ops) {
  if (!Array.isArray(ops)) return ["changes must be a list"];
  if (!ops.length) return ["there are no changes"];
  if (ops.length > MAX_OPS) return [`at most ${MAX_OPS} changes at a time`];
  const errors = ops.flatMap(opShapeErrors);
  const ids = ops.map((op) => op?.id);
  if (new Set(ids).size !== ids.length) errors.push("two changes share an id");
  return errors;
}

/* ---------- applying ---------- */

const clone = (value) => (typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

function trackOf(node, families, lookup) {
  const info = lookup?.(node.id) ?? node;
  if (node.track ?? info.track) return node.track ?? info.track;
  const family = node.family ?? info.family;
  return (families ?? []).find((item) => item.id === family)?.track ?? "spine";
}

/** Prerequisite ids of a node, a group id standing for every member. */
function requiresOf(node, groups) {
  return (node.requires ?? []).flatMap((req) => groups.get(req) ?? [req]);
}

function groupMembers(map) {
  const groups = new Map((map.groups ?? []).map((group) => [group.id, []]));
  for (const node of map.nodes) if (node.group && groups.has(node.group)) groups.get(node.group).push(node.id);
  return groups;
}

/** Does `from` wait on `target`, directly or further back? */
function dependsOn(map, from, target) {
  const groups = groupMembers(map);
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const seen = new Set();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop();
    if (id === target) return true;
    if (seen.has(id) || !byId.has(id)) continue;
    seen.add(id);
    stack.push(...requiresOf(byId.get(id), groups));
  }
  return false;
}

/**
 * `n` is the walking order: after every prerequisite, unique. Main steps are
 * numbered 1..k in dependency order (stable by the old order); side quests
 * from 101. Mirrors admin/map-draft.js renumber.
 */
export function renumber(map, lookup = null) {
  const families = map.families ?? [];
  const groups = groupMembers(map);
  const nodes = map.nodes.map((node) => ({ ...node }));
  const order = (group) => {
    const index = new Map(group.map((node, i) => [node, i]));
    const pending = [...group].sort((a, b) => {
      const an = Number.isFinite(a.n) ? a.n : Infinity;
      const bn = Number.isFinite(b.n) ? b.n : Infinity;
      return an === bn ? index.get(a) - index.get(b) : an - bn;
    });
    const ids = new Set(group.map((node) => node.id));
    const placed = new Set();
    const out = [];
    while (pending.length) {
      const at = pending.findIndex((node) => requiresOf(node, groups).filter((req) => ids.has(req)).every((req) => placed.has(req)));
      if (at < 0) {
        out.push(...pending.splice(0));
        break;
      }
      const [node] = pending.splice(at, 1);
      placed.add(node.id);
      out.push(node);
    }
    return out;
  };
  order(nodes.filter((node) => trackOf(node, families, lookup) !== "side")).forEach((node, i) => (node.n = i + 1));
  order(nodes.filter((node) => trackOf(node, families, lookup) === "side")).forEach((node, i) => (node.n = SIDE_BASE + i));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return { ...map, nodes: map.nodes.map((node) => byId.get(node.id)) };
}

function mark(node, op) {
  node.suggested = [...(node.suggested ?? []), { kind: op.kind, id: op.id }];
}

/**
 * Apply one op to a map (a fresh copy is passed in). Returns a conflict
 * sentence when the op can't apply to this map, else null.
 *
 * preview: what the student and Aden look at. Changed steps carry
 *   `suggested: [{kind, id}]`; a "doesn't fit" step stays, marked.
 * merge: the map Aden edits and publishes. No marks; a retired step is taken
 *   out and the steps after it wait on what it waited on; a task on a library
 *   step (its tasks come from the module) goes into the step's notes.
 */
function applyOne(map, op, mode, lookup) {
  const byId = new Map(map.nodes.map((node) => [node.id, node]));
  const gone = (id) => `“${id}” is no longer on the map`;
  const preview = mode === "preview";

  if (op.kind === "add") {
    const after = byId.get(op.after);
    if (!after) return gone(op.after);
    const id = newNodeId(op);
    if (byId.has(id)) return "this step is already on the map";
    const next = op.before ? byId.get(op.before) : null;
    if (op.before && !next) return gone(op.before);
    if (next && !(next.requires ?? []).includes(after.id)) return `“${op.before}” doesn't come right after “${op.after}”`;
    const type = ADD_TYPES.includes(op.type) ? op.type : "step";
    // A library step stored as an instance may take its lane from its module: read the resolved step.
    const info = { ...(lookup?.(after.id) ?? {}), ...after };
    const node = {
      id,
      n: (after.n ?? 0) + 0.5,
      title: op.title.trim(),
      family: after.family ?? info.family,
      requires: [after.id],
      kind: "core",
      type,
      ...(type === "habit" ? {} : { completion: "tasks" }),
      tasks: (op.tasks ?? []).map((title, index) => ({ id: newTaskId(op, index), title: title.trim(), kind: "ship" })),
    };
    // Between two steps: the one after now waits on the new step instead.
    if (next) next.requires = next.requires.map((req) => (req === after.id ? id : req));
    if (after.phase ?? info.phase) node.phase = after.phase ?? info.phase;
    if (after.track) node.track = after.track;
    if (preview) mark(node, op);
    // Placed right after its step, so the list and the route read in order.
    map.nodes.splice(map.nodes.indexOf(after) + 1, 0, node);
    return null;
  }

  const node = op.node ? byId.get(op.node) : null;
  if (op.node && !node) return gone(op.node);

  if (op.kind === "task") {
    const task = { id: newTaskId(op), title: op.title.trim(), kind: "ship" };
    if (!preview && typeof node.module === "string") {
      // A library step's tasks come from its module: the idea goes into this step's notes instead.
      const notes = String(node.fill?.notes ?? "").trim();
      node.fill = { ...(node.fill ?? {}), notes: `${notes ? `${notes}\n` : ""}- ${task.title}` };
      return null;
    }
    if ((node.tasks ?? []).some((item) => item.id === task.id)) return "this task is already on the step";
    node.tasks = [...(node.tasks ?? []), preview ? { ...task, suggested: true } : task];
    if (preview) mark(node, op);
    return null;
  }

  if (op.kind === "move") {
    const after = byId.get(op.after);
    if (!after) return gone(op.after);
    if (dependsOn(map, after.id, node.id)) return `“${after.title}” already comes after “${node.title}”, so this would make a loop`;
    node.requires = [after.id];
    if (preview) mark(node, op);
    return null;
  }

  if (op.kind === "rename") {
    node.title = op.title.trim();
    if (preview) mark(node, op);
    return null;
  }

  if (op.kind === "retire") {
    if (preview) {
      mark(node, op);
      return null;
    }
    const replacement = node.requires ?? [];
    const groups = groupMembers(map);
    map.nodes.splice(map.nodes.indexOf(node), 1);
    for (const other of map.nodes) {
      if (!(other.requires ?? []).includes(node.id)) continue;
      other.requires = [...new Set(other.requires.flatMap((req) => (req === node.id ? replacement : [req])))].filter((req) => req !== other.id);
    }
    // A group left with one step is no group: that step stands alone, and anything that waited on the group waits on it.
    if (node.group && groups.has(node.group)) {
      const left = groups.get(node.group).filter((id) => id !== node.id);
      if (left.length < 2) {
        map.groups = (map.groups ?? []).filter((group) => group.id !== node.group);
        for (const other of map.nodes) {
          if (other.group === node.group) delete other.group;
          if ((other.requires ?? []).includes(node.group)) other.requires = other.requires.flatMap((req) => (req === node.group ? left : [req]));
        }
      }
    }
    return null;
  }

  if (op.kind === "ask") {
    if (preview && node) mark(node, op);
    return null;
  }

  if (op.kind === "taskedit" || op.kind === "taskdrop") {
    let target = node;
    if (typeof node.module === "string") {
      if (preview) return "a library step can't be changed here";
      // A library step's tasks live in its module: give the step its own copy first.
      const resolved = lookup?.(node.id);
      if (!resolved?.tasks) return `“${node.id}” couldn't be read from the library`;
      target = detach(node, resolved);
      map.nodes.splice(map.nodes.indexOf(node), 1, target);
    }
    const index = (target.tasks ?? []).findIndex((task) => task.id === op.task);
    if (index < 0) return "that task is no longer on the step";
    const tasks = [...target.tasks];
    if (op.kind === "taskedit") tasks[index] = { ...tasks[index], title: op.title.trim(), ...(preview ? { suggested: true } : {}) };
    else tasks.splice(index, 1);
    target.tasks = tasks;
    if (preview) mark(target, op);
    return null;
  }
  return "unknown change";
}

/**
 * A stored library step as a step of its own: the resolved content (tasks,
 * advice, Aden's notes as the board shows them) with the stored placement
 * (requires, title, group, due...) on top, so changes made earlier in this
 * merge still stand.
 */
function detach(inst, resolved) {
  const { moduleRef, moduleError, ...content } = clone(resolved);
  // Only where the step sits and what it's called come from the stored step (modules.js INSTANCE_KEYS).
  const PLACEMENT = ["id", "n", "requires", "family", "phase", "title", "type", "group", "due", "track"];
  const placement = Object.fromEntries(Object.entries(inst).filter(([key, value]) => PLACEMENT.includes(key) && value !== undefined && value !== null));
  return { ...content, ...placement };
}

/**
 * Replay a change set on a map. Never throws and never edits `map`.
 * Returns { map, results: [{ op, ok, conflict }] }; the map is renumbered.
 * `lookup(id)`: the resolved step, when `map` is the stored map (library
 * steps as instances), so a new step lands in the right lane.
 */
export function applyOps(map, ops, { mode = "preview", lookup = null } = {}) {
  const out = clone(map);
  out.nodes = out.nodes ?? [];
  const results = [];
  for (const op of ops ?? []) {
    const shape = opShapeErrors(op);
    if (shape.length) {
      results.push({ op, ok: false, conflict: shape[0] });
      continue;
    }
    const conflict = applyOne(out, op, mode, lookup);
    results.push({ op, ok: !conflict, conflict });
  }
  return { map: renumber(out, lookup), results };
}

/**
 * Every op with the map rules' complaints it would add, one op at a time, so
 * a refused change names itself ("a step can't wait on a weekly habit"), and
 * only errors the map didn't already have count.
 */
export function checkOps(map, ops) {
  const withTop = (doc) => ({ version: "1", title: "map", phases: [], weekly: [], ...doc });
  const before = new Set(validateMap(withTop(map)));
  const applied = [];
  return (ops ?? []).map((op) => {
    const result = applyOps(map, [...applied, op]);
    const last = result.results.at(-1);
    if (!last.ok) return { op, ok: false, errors: [last.conflict] };
    const errors = validateMap(withTop(result.map)).filter((error) => !before.has(error));
    if (!errors.length) applied.push(op);
    return { op, ok: !errors.length, errors };
  });
}

/* ---------- reading a change set ---------- */

/** One sentence per op, for the student's list and Aden's review. */
export function describeOp(op, titleOf = (id) => id, taskTitleOf = () => null) {
  const t = (id) => `“${titleOf(id)}”`;
  const taskOf = (node, task) => {
    const title = taskTitleOf(node, task);
    return title ? `the task “${title}”` : "a task";
  };
  switch (op.kind) {
    case "add":
      return `New ${TYPE_WORD[op.type] ?? "step"} ${op.before ? `between ${t(op.after)} and ${t(op.before)}` : `after ${t(op.after)}`}: “${op.title}”${op.tasks?.length ? ` (${op.tasks.length} task${op.tasks.length === 1 ? "" : "s"})` : ""}`;
    case "task":
      return `New task on ${t(op.node)}: “${op.title}”`;
    case "move":
      return `${t(op.node)} comes after ${t(op.after)}`;
    case "retire":
      return `${t(op.node)} doesn't fit anymore`;
    case "rename":
      return `Rename ${t(op.node)} to “${op.title}”`;
    case "ask":
      return op.node ? `Ask your coach about ${t(op.node)}` : "Ask your coach";
    case "taskedit":
      return `On ${t(op.node)}, change ${taskOf(op.node, op.task)} to “${op.title}”`;
    case "taskdrop":
      return `On ${t(op.node)}, remove ${taskOf(op.node, op.task)}`;
    default:
      return "A change";
  }
}

/** The ids each op touches, so a change on the map can be found in the list and back. */
export function opTargets(op) {
  if (op.kind === "add") return [newNodeId(op), op.after, ...(op.before ? [op.before] : [])];
  if (op.kind === "move") return [op.node, op.after];
  return op.node ? [op.node] : [];
}

/** Ops after removing one, dropping any later op that depended on a step it added. */
export function withoutOp(ops, id) {
  const drop = new Set([id]);
  const removedNodes = new Set();
  const out = [];
  for (const op of ops ?? []) {
    if (drop.has(op.id)) {
      if (op.kind === "add") removedNodes.add(newNodeId(op));
      continue;
    }
    if (opTargets(op).some((target) => removedNodes.has(target))) {
      drop.add(op.id);
      if (op.kind === "add") removedNodes.add(newNodeId(op));
      continue;
    }
    out.push(op);
  }
  return out;
}
