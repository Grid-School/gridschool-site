/**
 * The module library: general steps (advice, tasks, readings, the same for
 * every student) that a student's map places as instances, with Aden's
 * per-student fields filled in.
 *
 *   module   data/modules/<id>@<version>.json   public, versioned, never personal
 *   instance { id, n, requires, module: "<id>@<v>", family?, phase?, title?, fill }
 *
 * `resolveMap` turns every instance into the full node shape the board has
 * always read (module content, task ids namespaced as `<instanceId>.<localId>`,
 * `fromAden` = the fill, `moduleRef`), so the renderer, progress, tallies and
 * the map rules run unchanged on the result. Free-form nodes (no `module`)
 * pass through untouched. An unknown module never disappears: it resolves to
 * a visible placeholder step that says what is missing.
 *
 * Pure apart from `loadModules`. The Python twin is site/server/modules.py:
 * keep the two in step (server/testdata/modules-cases.json runs on both).
 */

export const SLOTS = ["notes", "links", "due", "readings"];
export const INSTANCE_KEYS = ["id", "n", "requires", "module", "family", "phase", "title", "fill"];
/** Module keys copied onto the resolved node (title, family, phase and tasks are handled apart). */
export const CONTENT_KEYS = ["kind", "completion", "why", "evidence", "lesson", "modules", "signoff"];
export const MAX_NOTES = 8000;
export const MAX_LINKS = 10;
export const MAX_READINGS = 6;
export const MAX_TITLE = 120;
const REF = /^[a-z0-9-]+@[1-9][0-9]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_RE = /^https?:\/\/[^\s]+$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) => JSON.parse(JSON.stringify(value));

export const isInstance = (node) => isObject(node) && typeof node.module === "string";
export const hasInstances = (map) => Array.isArray(map?.nodes) && map.nodes.some(isInstance);

/** Every distinct module ref a map uses, in first-use order. */
export function moduleRefs(map) {
  const refs = [];
  for (const node of Array.isArray(map?.nodes) ? map.nodes : []) {
    if (isInstance(node) && !refs.includes(node.module)) refs.push(node.module);
  }
  return refs;
}

export function isValidDate(text) {
  if (typeof text !== "string" || !DATE.test(text)) return false;
  const [y, m, d] = text.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const isHttpUrl = (url) => typeof url === "string" && URL_RE.test(url);

/** Why this fill cannot be stored on an instance of `module`. Empty means it can. */
export function fillErrors(fill, module) {
  if (fill === undefined || fill === null) return [];
  if (!isObject(fill)) return ["fill must be an object"];
  const slots = Array.isArray(module?.slots) ? module.slots : [];
  const errors = [];
  for (const key of Object.keys(fill)) {
    if (!SLOTS.includes(key)) errors.push(`fill.${key} is not a fill field (notes, links, due, readings)`);
    else if (!slots.includes(key)) errors.push(`fill.${key}: module ${module?.id} has no ${key} slot`);
  }
  if ("notes" in fill && slots.includes("notes")) {
    if (typeof fill.notes !== "string") errors.push("fill.notes must be a string");
    else if (fill.notes.length > MAX_NOTES) errors.push(`fill.notes is ${fill.notes.length} characters; the limit is ${MAX_NOTES}`);
  }
  if ("links" in fill && slots.includes("links")) {
    if (!Array.isArray(fill.links)) errors.push("fill.links must be a list");
    else {
      if (fill.links.length > MAX_LINKS) errors.push(`fill.links has ${fill.links.length} links; the limit is ${MAX_LINKS}`);
      fill.links.forEach((link, index) => {
        if (!isObject(link)) return errors.push(`fill.links[${index}] must be an object with label and url`);
        if (typeof link.label !== "string" || !link.label.trim() || link.label.length > MAX_TITLE) {
          errors.push(`fill.links[${index}] needs a label of 1-${MAX_TITLE} characters`);
        }
        if (!isHttpUrl(link.url)) errors.push(`fill.links[${index}].url must be an http(s) URL`);
      });
    }
  }
  if ("due" in fill && slots.includes("due") && !isValidDate(fill.due)) {
    errors.push("fill.due must be a date like 2026-10-10");
  }
  if ("readings" in fill && slots.includes("readings")) {
    if (!Array.isArray(fill.readings) || !fill.readings.length) errors.push("fill.readings must be a non-empty list");
    else {
      if (fill.readings.length > MAX_READINGS) errors.push(`fill.readings has ${fill.readings.length} readings; the limit is ${MAX_READINGS}`);
      fill.readings.forEach((reading, index) => {
        const ok =
          isObject(reading) &&
          typeof reading.id === "string" &&
          reading.id &&
          typeof reading.title === "string" &&
          reading.title.trim() &&
          typeof reading.href === "string" &&
          reading.href.startsWith("./read/?m=");
        if (!ok) errors.push(`fill.readings[${index}] needs id, title and an href starting ./read/?m=`);
      });
    }
  }
  return errors;
}

/** Why the instances in this map cannot be stored. Free-form nodes are the map rules' job. */
export function instanceErrors(map, library = {}) {
  const errors = [];
  for (const node of Array.isArray(map?.nodes) ? map.nodes : []) {
    if (!isObject(node) || !("module" in node)) continue;
    const nid = typeof node.id === "string" ? node.id : "?";
    if (typeof node.module !== "string" || !REF.test(node.module)) {
      errors.push(`node ${nid}: module must look like id@version (e.g. posting-kit@1)`);
      continue;
    }
    for (const key of Object.keys(node)) {
      if (!INSTANCE_KEYS.includes(key)) errors.push(`node ${nid}: ${key} is not allowed on a module step (the library owns it)`);
    }
    if ("title" in node && (typeof node.title !== "string" || !node.title.trim() || node.title.length > MAX_TITLE)) {
      errors.push(`node ${nid}: title must be 1-${MAX_TITLE} characters`);
    }
    const module = library[node.module];
    if (!module) {
      errors.push(`node ${nid}: module ${node.module} is not in the library`);
      continue;
    }
    for (const error of fillErrors(node.fill, module)) errors.push(`node ${nid}: ${error}`);
  }
  return errors;
}

function fromAden(fill, slots) {
  const source = isObject(fill) ? fill : {};
  return {
    notes: slots.includes("notes") && typeof source.notes === "string" && source.notes.trim() ? source.notes : null,
    links: slots.includes("links") && Array.isArray(source.links) ? clone(source.links) : [],
    due: slots.includes("due") && typeof source.due === "string" && source.due ? source.due : null,
  };
}

function missingNode(inst, map) {
  const ref = inst.module;
  const node = {
    id: inst.id,
    n: inst.n,
    requires: Array.isArray(inst.requires) ? [...inst.requires] : [],
    title: typeof inst.title === "string" && inst.title ? inst.title : `Missing module ${ref}`,
    family: inst.family ?? map?.families?.[0]?.id ?? "side",
    kind: "core",
    completion: "tasks",
    why: `This step uses module ${ref}, which is not in the library. Tell Aden: the map needs fixing.`,
    evidence: "",
    tasks: [],
    moduleRef: ref,
    moduleError: `module ${ref} is not in the library`,
    fromAden: { notes: null, links: [], due: null },
  };
  if (inst.phase !== undefined) node.phase = inst.phase;
  return node;
}

/** One instance → one full node. Free-form nodes come back as they are. */
export function resolveNode(inst, library = {}, map = null) {
  if (!isInstance(inst)) return inst;
  const module = library[inst.module];
  if (!module) return missingNode(inst, map);
  const slots = Array.isArray(module.slots) ? module.slots : [];
  const fill = isObject(inst.fill) ? inst.fill : {};
  const node = {
    id: inst.id,
    n: inst.n,
    requires: Array.isArray(inst.requires) ? [...inst.requires] : [],
    title: typeof inst.title === "string" && inst.title ? inst.title : module.title,
    family: inst.family ?? module.lane,
  };
  const phase = inst.phase ?? module.phase;
  if (phase !== undefined) node.phase = phase;
  for (const key of CONTENT_KEYS) if (module[key] !== undefined) node[key] = clone(module[key]);
  node.kind ??= "core";
  node.completion ??= "tasks";
  if (slots.includes("readings") && Array.isArray(fill.readings) && fill.readings.length) node.modules = clone(fill.readings);
  node.tasks = (module.tasks ?? []).map((task) => ({ ...clone(task), id: `${inst.id}.${task.id}` }));
  node.moduleRef = inst.module;
  node.fromAden = fromAden(fill, slots);
  return node;
}

/** The map the board reads. Returns the same object when there is nothing to resolve. */
export function resolveMap(map, library = {}) {
  if (!hasInstances(map)) return map;
  return { ...map, nodes: map.nodes.map((node) => resolveNode(node, library, map)) };
}

const libraryCache = new Map();

/**
 * Fetch the modules a map needs. A module that fails to load is left out, so
 * the step resolves to its "missing module" placeholder instead of vanishing.
 */
export async function loadModules(refs, { fetcher = globalThis.fetch, base = new URL("../../data/modules/", import.meta.url) } = {}) {
  const library = {};
  await Promise.all(
    [...new Set(refs ?? [])].filter((ref) => REF.test(ref)).map(async (ref) => {
      if (!libraryCache.has(ref)) {
        const promise = Promise.resolve()
          .then(() => fetcher(new URL(`${ref}.json`, base), { cache: "no-store" }))
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);
        libraryCache.set(ref, promise);
      }
      const module = await libraryCache.get(ref);
      if (module) library[ref] = module;
      else libraryCache.delete(ref); // retry on the next load
    })
  );
  return library;
}

/** Load what this map needs and resolve it. */
export async function resolveWithLibrary(map, options) {
  if (!hasInstances(map)) return map;
  return resolveMap(map, await loadModules(moduleRefs(map), options));
}
