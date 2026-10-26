/**
 * The Route: the same board as the floor (scene3d), drawn flat on the road the
 * landing draws (js/rez/road.js). Depth is sequence left to right, height is
 * family, one curve per edge. A student picks Floor or Route on the map; this
 * file keeps scene3d's interface exactly (renderScene, paint, nodeEls, frame,
 * approach, retreat, fit, zoomBy, didDrag, resize, destroy), so map.js does
 * not care which one it holds.
 *
 * Things made for the student (engine.js: a role prepared for them, a campaign
 * drafted, someone they know at a hiring company) appear as ordinary nodes
 * beside "you are here", in their lanes, each tied to you by a line and tagged
 * with what it is ("Prepared for you"). The one next move is the only white
 * ring. Nothing else is added: no queues, no counts, only nodes and lines.
 *
 * Light means done. Behind you the road is green and settled, the stretch
 * into the step you are on is cyan, and ahead it is a dim line. When a step
 * lights, current runs once from it to the new Next, which pops in, and the
 * view glides to it. Nothing idles. Reduced motion jumps.
 */

import { el, clear } from "../../dom.js?v=a3b9988-202610262033";
import { traceSet, stepNumber } from "../model.js?v=a3b9988-202610262033";
import { STANDING, standingOf, inSequence } from "../standing.js?v=a3b9988-202610262033";
import { typeOf, specOf } from "../model.js?v=a3b9988-202610262033";
import { isTypedMap } from "../../engine.js?v=a3b9988-202610262033";
import { isCompleteMap, isFreeMap } from "../../prep.js?v=a3b9988-202610262033";
import { WIN_LABEL } from "../route.js?v=a3b9988-202610262033";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-16" → "Due Oct 16". */
const dueText = (iso) => {
  const [, m, d] = String(iso).split("-").map(Number);
  return m && d ? `Due ${MONTHS[m - 1]} ${d}` : "";
};
import {
  svgEl,
  drawGrid,
  layoutRoad,
  roadSegments,
  phaseBands,
  wrapLabel,
  runCurrent,
  rezIn,
  prefersReducedMotion,
} from "../../../../js/rez/road.js?v=a3b9988-202610262033";

/*
 * One grid under everything, in the board's own units (as on the landing):
 * a cell is half a lane, steps stand every third column, so lanes are grid
 * lines and every step sits on a crossing at any zoom.
 */
const CELL = 50;
const SPACING = 3 * CELL;
const LANE_GAP = 2 * CELL;
/** Typed maps can hold nodes in neighbouring lanes in one column: a full label and YOU ARE HERE fit between. */
const TYPED_LANE_GAP = 3 * CELL;
/** The first lane sits below the band labels, so YOU ARE HERE and the pin never run into "START HERE" and its pace. */
const TOP = 4 * CELL;
const LEFT = 4 * CELL;
const RIGHT = 4 * CELL;
const SIDE_GAP = 3 * CELL;
/** A Complete or free route: a little more air between steps, so labels never touch. */
const ROUTE_SPACING = 3.6 * CELL;
/** Typed maps lay out by dependency: one column per step of depth, this far apart. */
const FLOW_SPACING = 3.6 * CELL;
/** A Complete map's group longer than this splits into columns side by side. */
const FLOW_MAX_STACK = 6;
/** Ready nodes stand this far right of you, in their lanes. */
const READY_DX = 1.5 * CELL;
const NODE_R = 15;
/** The next-move pin: its stem starts above "YOU ARE HERE", its dot sits this high over the step. */
const PIN_FOOT = -NODE_R - 30;
const PIN_HEAD = -NODE_R - 52;
/** No two labels closer than this; a label in the way moves by NUDGE until it's clear. */
const LABEL_PAD = 4;
const NUDGE = 6;
const MAX_NUDGE = 8 * CELL;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.6;
/** The canvas never loses the map entirely: at least this much of it stays on screen. */
const KEEP_PX = 160;
const APPROACH_MS = 220;
const DRAG_SLOP = 5;

/**
 * The road (untyped maps): one stop per step in walking order, each joined to
 * the next. Returns stops (arrays of nodes), placed points and the pairs the
 * road draws.
 */
function roadLayout(road, laneOf, laneY, spacing = SPACING) {
  const stops = road.map((node) => [node]);
  const placed = road.map((node, index) => ({ id: node.id, phase: node.phase, lane: laneOf.get(node.family) ?? 0, x: LEFT + index * spacing, y: laneY(laneOf.get(node.family) ?? 0) }));
  const pairs = road.slice(1).map((node, index) => [road[index].id, node.id]);
  return { stops, placed, pairs };
}

/**
 * Typed maps (node types, parallel groups) lay out by what each step waits on:
 * a step's column is the longest chain of requirements before it, so steps
 * that can be done together stand in one column, and every line is a real
 * requirement. A group id in requires stands for its members. Every node sits
 * on its own lane's line: when a column holds more than one node in a lane,
 * they stand side by side along that line and the column widens, instead of
 * stacking down into the lanes below. Each column takes the phase of its first
 * step, so bands don't overlap.
 */
function flowLayout(road, laneOf, laneY, { inOrder = false } = {}) {
  const ids = new Set(road.map((node) => node.id));
  const members = new Map();
  for (const node of road) if (node.group) members.set(node.group, [...(members.get(node.group) ?? []), node.id]);
  const reqs = (node) => (node.requires ?? []).flatMap((req) => members.get(req) ?? [req]).filter((id) => ids.has(id));
  const byId = new Map(road.map((node) => [node.id, node]));
  const depth = new Map();
  const depthOf = (node, seen = new Set()) => {
    if (depth.has(node.id)) return depth.get(node.id);
    if (seen.has(node.id)) return 0;
    seen.add(node.id);
    const d = Math.max(-1, ...reqs(node).map((id) => depthOf(byId.get(id), seen))) + 1;
    depth.set(node.id, d);
    return d;
  };
  road.forEach((node) => depthOf(node));
  const columns = [];
  for (const node of road) (columns[depth.get(node.id)] ??= []).push(node);
  const laneIndex = (node) => laneOf.get(node.family) ?? 0;
  const byLane = (a, b) => laneIndex(a) - laneIndex(b) || a.n - b.n;
  const stops = [];
  for (const column of columns.filter(Boolean)) {
    if (inOrder) stops.push(...orderedStops(column, byLane));
    else stops.push(column.sort(byLane));
  }
  const placed = [];
  // The first column sits one step right of the start point, which every root hangs from.
  let x = LEFT + FLOW_SPACING;
  for (const column of stops) {
    const phase = [...column].sort((a, b) => a.n - b.n)[0].phase;
    const used = new Map();
    for (const node of column) {
      const lane = laneIndex(node);
      const slot = used.get(lane) ?? 0;
      used.set(lane, slot + 1);
      placed.push({ id: node.id, phase, lane, x: x + slot * FLOW_SPACING, y: laneY(lane) });
    }
    x += Math.max(1, ...used.values()) * FLOW_SPACING;
  }
  const pairs = road.flatMap((node) => reqs(node).map((from) => [from, node.id]));
  const roots = road.filter((node) => !reqs(node).length).map((node) => node.id);
  return { stops, placed, pairs, roots };
}

/**
 * The line between two placed steps. On a typed map, a line between two steps on the same lane
 * would lie on the lane line, hidden, and run through every step between them as if it joined
 * them, so it arcs over them instead.
 */
function linePath(a, b, typed) {
  if (!typed || Math.abs(a.y - b.y) > 1) return roadSegments([a, b])[0];
  const lift = Math.min(0.55 * TYPED_LANE_GAP, 22 + 0.12 * Math.abs(b.x - a.x));
  const dx = (b.x - a.x) * 0.3;
  const y = a.y - lift;
  return { d: `M ${a.x} ${a.y} C ${a.x + dx} ${y} ${b.x - dx} ${y} ${b.x} ${b.y}` };
}

/**
 * A Complete map reads left to right in the order it was built (complete_map.py):
 * what we're preparing, then today's ten minutes, then the questions, then the
 * week-one check-in. Each group stands in its own column, and so does each
 * step outside a group, in `n` order.
 */
function orderedStops(column, byLane) {
  const parts = [];
  const groupPart = new Map();
  for (const node of [...column].sort((a, b) => a.n - b.n)) {
    if (!node.group) {
      parts.push([node]);
      continue;
    }
    if (!groupPart.has(node.group)) parts.push(groupPart.set(node.group, []).get(node.group));
    groupPart.get(node.group).push(node);
  }
  return parts.flatMap((part) => {
    const out = [];
    for (let i = 0; i < part.length; i += FLOW_MAX_STACK) out.push(part.slice(i, i + FLOW_MAX_STACK).sort(byLane));
    return out;
  });
}

export async function createRezScene(container) {
  const reducedMotion = prefersReducedMotion();
  // A real canvas: the SVG fills the host, everything is drawn inside one
  // viewport group, and pan and zoom are that group's transform. No scroll box,
  // so there are no edges to hit: drag anywhere, two-finger scroll pans,
  // pinch or ctrl+wheel zooms toward the pointer, double-click zooms in there.
  const svg = svgEl("svg", { class: "rez-board", role: "group", "aria-label": "Your route", width: "100%", height: "100%" });
  const view = svgEl("g", { class: "rz-view" }, svg);
  const host = el("div.rez-host", {}, svg);
  clear(container);
  container.append(host);

  const state = {
    graph: null,
    plan: null,
    nodeEls: new Map(),
    segFor: new Map(),
    tieFor: new Map(),
    zoom: 1,
    tx: 0,
    ty: 0,
    nextId: undefined,
    cancelCurrent: () => {},
    cancelGlide: () => {},
    arrived: false,
    ready: null,
    onTool: null,
    movers: [],
  };

  function applyView() {
    view.setAttribute("transform", `translate(${state.tx.toFixed(1)} ${state.ty.toFixed(1)}) scale(${state.zoom.toFixed(4)})`);
  }

  /** Keep some of the map on screen however far you drag. */
  function clampPan() {
    const p = state.plan;
    if (!p) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const minX = KEEP_PX - p.width * state.zoom;
    const maxX = w - KEEP_PX;
    const minY = KEEP_PX - p.height * state.zoom;
    const maxY = h - KEEP_PX;
    state.tx = Math.min(maxX, Math.max(minX, state.tx));
    state.ty = Math.min(maxY, Math.max(minY, state.ty));
  }

  /** Zoom to `next`, keeping the board point under (px, py) on screen where it was. */
  function zoomAt(next, px, py) {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const bx = (px - state.tx) / state.zoom;
    const by = (py - state.ty) / state.zoom;
    state.zoom = zoom;
    state.tx = px - bx * zoom;
    state.ty = py - by * zoom;
    clampPan();
    applyView();
  }

  const local = (event) => {
    const box = host.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  /* ---------- pointers: drag to pan, two fingers to pinch ---------- */
  const pointers = new Map();
  let drag = null;
  let dragged = false;
  let pinch = null;

  const onDown = (event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    state.cancelGlide();
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) {
      drag = { ...local(event), tx: state.tx, ty: state.ty };
      dragged = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom };
      drag = null;
      dragged = true;
    }
  };
  const onMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, local(event));
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.zoom * (dist / Math.max(1, pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    if (!drag) return;
    const at = local(event);
    const dx = at.x - drag.x;
    const dy = at.y - drag.y;
    if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!dragged) host.setPointerCapture?.(event.pointerId);
    dragged = true;
    host.classList.add("is-dragging");
    state.tx = drag.tx + dx;
    state.ty = drag.ty + dy;
    clampPan();
    applyView();
  };
  const onUp = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      drag = null;
      host.classList.remove("is-dragging");
    }
  };
  // A click that ended a drag is swallowed before it reaches a node.
  const onClickCapture = (event) => {
    if (!dragged) return;
    event.stopPropagation();
    event.preventDefault();
    dragged = false;
  };
  // Trackpads: two-finger scroll pans; pinch arrives as ctrl+wheel and zooms. A mouse wheel with ctrl zooms too.
  const onWheel = (event) => {
    event.preventDefault();
    state.cancelGlide();
    const at = local(event);
    if (event.ctrlKey || event.metaKey) {
      // Trackpad pinches send small deltas; a mouse notch sends ~100. Clamp so one notch is a step, not a jump.
      const d = Math.max(-50, Math.min(50, event.deltaY * (event.deltaMode === 1 ? 16 : 1)));
      zoomAt(state.zoom * Math.exp(-d * 0.01), at.x, at.y);
      return;
    }
    const scale = event.deltaMode === 1 ? 16 : 1;
    state.tx -= event.deltaX * scale;
    state.ty -= event.deltaY * scale;
    clampPan();
    applyView();
  };
  const onDouble = (event) => {
    if (event.target.closest?.(".rz-node, .rz-tool")) return;
    const at = local(event);
    glideTo({ zoom: Math.min(MAX_ZOOM, state.zoom * 1.6), px: at.x, py: at.y });
  };
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  host.addEventListener("click", onClickCapture, true);
  host.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("dblclick", onDouble);

  /** Animate zoom around a screen point, or a pan to a target translation. */
  function glideTo({ zoom = state.zoom, px = host.clientWidth / 2, py = host.clientHeight / 2, tx = null, ty = null, ms = 320 }) {
    state.cancelGlide();
    const from = { zoom: state.zoom, tx: state.tx, ty: state.ty };
    let to;
    if (tx !== null) to = { zoom, tx, ty };
    else {
      const bx = (px - state.tx) / state.zoom;
      const by = (py - state.ty) / state.zoom;
      to = { zoom, tx: px - bx * zoom, ty: py - by * zoom };
    }
    if (reducedMotion) {
      Object.assign(state, to);
      clampPan();
      applyView();
      return;
    }
    const start = performance.now();
    let frame = 0;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const k = ease(t);
      state.zoom = from.zoom + (to.zoom - from.zoom) * k;
      state.tx = from.tx + (to.tx - from.tx) * k;
      state.ty = from.ty + (to.ty - from.ty) * k;
      applyView();
      if (t < 1) frame = requestAnimationFrame(step);
      else clampPan();
    };
    frame = requestAnimationFrame(step);
    state.cancelGlide = () => cancelAnimationFrame(frame);
  }

  /* ---------- layout ---------- */

  function plan(graph) {
    const side = inSequence(graph.nodes.filter((node) => node.track === "side"));
    const road = inSequence(graph.nodes.filter((node) => node.track !== "side"));
    // Lanes follow each family's own `lane`, as on the floor; families that share
    // a lane share a row, and the row is labelled with all of them.
    const used = (graph.families ?? []).filter((family) => road.some((node) => node.family === family.id));
    // Highest lane on top: career maps put interview last and highest, so the
    // route climbs toward the offer instead of reading as a decline.
    const laneValues = [...new Set(used.map((family) => family.lane ?? 0))].sort((a, b) => b - a);
    const rowOfLane = new Map(laneValues.map((lane, index) => [lane, index]));
    const laneOf = new Map(used.map((family) => [family.id, rowOfLane.get(family.lane ?? 0)]));
    const lanes = Math.max(1, laneValues.length);
    const laneTop = TOP;
    const typed = isTypedMap(graph);
    // A Complete or free map is one route (graph/route.js): every step in `n` order, joined start to
    // finish, with its own start ("Scan done"). Other typed maps get the wider lanes and a start point.
    const gap = !graph.route && typed ? TYPED_LANE_GAP : LANE_GAP;
    const laneY = (lane) => laneTop + lane * gap;
    const { stops, placed, pairs, roots = [] } = graph.route
      ? roadLayout(road, laneOf, laneY, ROUTE_SPACING)
      : typed
        ? flowLayout(road, laneOf, laneY, { inOrder: isCompleteMap(graph) })
        : roadLayout(road, laneOf, laneY);
    // Typed maps: one start point on the left, on the middle lane, so no step floats on its own.
    const start = typed && !graph.route && roots.length ? { x: LEFT, y: laneY(Math.floor((lanes - 1) / 2)) } : null;
    const at = new Map(placed.map((point) => [point.id, point]));
    const roadBottom = Math.max(laneY(lanes - 1), ...placed.map((point) => point.y));
    const sideY = roadBottom + SIDE_GAP;
    side.forEach((node, index) => at.set(node.id, { id: node.id, x: LEFT + index * SPACING, y: sideY, side: true }));
    const lastX = Math.max(LEFT, ...[...at.values()].map((point) => point.x));
    return {
      at,
      typed,
      start,
      roots,
      order: stops.map((stop) => stop[0].id),
      stops: stops.map((stop) => stop.map((node) => node.id)),
      pairs,
      side: side.map((node) => node.id),
      rows: laneValues.map((lane, index) => ({
        y: laneY(index),
        label: used.filter((family) => (family.lane ?? 0) === lane).map((family) => family.label ?? family.id).join(" · "),
      })),
      bands: phaseBands(placed, graph.phases ?? [], 40),
      sideY: side.length ? sideY : null,
      laneYOf: (family) => {
        const lane = laneOf.get(family);
        return lane === undefined ? null : laneY(lane);
      },
      width: lastX + RIGHT,
      height: (side.length ? sideY : roadBottom) + 2 * CELL,
    };
  }

  function sizeSvg() {
    applyView();
  }

  function rebuild(graph) {
    state.cancelCurrent();
    state.plan = plan(graph);
    state.nodeEls.clear();
    state.segFor.clear();
    state.tieFor.clear();
    view.replaceChildren();
    const { plan: p } = state;
    svg.classList.toggle("is-route", Boolean(graph.route));
    const freeMap = isFreeMap(graph);

    const back = svgEl("g", { class: "rz-back" }, view);
    // The grid runs far past the map in every direction: the canvas has no edge to find.
    drawGrid(back, { id: "route-grid", cell: CELL, x: -200 * CELL, y: -200 * CELL, width: p.width + 400 * CELL, height: p.height + 400 * CELL });
    let labelEnd = -Infinity;
    let drop = 0;
    for (const band of p.bands) {
      svgEl("rect", { class: "rz-band", x: band.x0, y: 24, width: band.x1 - band.x0, height: p.height - 48, rx: 10 }, back);
      // A narrow band's label would run into the next one: that label drops a line.
      drop = band.x0 + 14 < labelEnd + 16 && !drop ? 34 : 0;
      const label = svgEl("text", { class: "rz-band__label", x: band.x0 + 14, y: 46 + drop }, back);
      label.textContent = band.label ?? band.id;
      // Pace reads up to its colon: "Phase 1 · weeks 1–3", not the whole sentence.
      const pace = band.pace ? svgEl("text", { class: "rz-band__pace", x: band.x0 + 14, y: 62 + drop }, back) : null;
      if (pace) pace.textContent = band.pace.split(":")[0];
      const width = Math.max(label.getComputedTextLength?.() ?? 0, pace?.getComputedTextLength?.() ?? 0);
      labelEnd = band.x0 + 14 + (width || (band.label ?? band.id).length * 9);
    }
    for (const row of p.rows) {
      svgEl("line", { class: "rz-lane", x1: 24, x2: p.width - 24, y1: row.y, y2: row.y }, back);
      svgEl("text", { class: "rz-lane__label", x: 24, y: row.y - 8 }, back).textContent = row.label.toUpperCase();
    }
    if (p.sideY !== null) {
      svgEl("text", { class: "rz-lane__label", x: 24, y: p.sideY - 40 }, back).textContent = "SIDE QUESTS";
    }
    const segment = (a, b) => linePath(a, b, p.typed);
    const ties = svgEl("g", { class: "rz-ties" }, view);
    const roadPairs = p.pairs;
    const consecutive = new Set(roadPairs.map(([from, to]) => `${from}->${to}`));
    for (const edge of graph.edges ?? []) {
      const key = `${edge.from}->${edge.to}`;
      const a = p.at.get(edge.from);
      const b = p.at.get(edge.to);
      if (!a || !b || consecutive.has(key) || a.side || b.side) continue;
      state.tieFor.set(key, svgEl("path", { class: "rz-tie", d: segment(a, b).d }, ties));
    }

    if (p.start) {
      // The start point: a quiet line to every step that waits on nothing. Not a requirement,
      // so it's drawn like a tie and stays out of the road's done and live colours.
      for (const id of p.roots) {
        const at = p.at.get(id);
        if (at) svgEl("path", { class: "rz-start__line", d: linePath(p.start, at, true).d }, ties);
      }
      const mark = svgEl("g", { class: "rz-start", transform: `translate(${p.start.x} ${p.start.y})` }, view);
      svgEl("circle", { class: "rz-start__dot", r: 6 }, mark);
      svgEl("text", { class: "rz-start__label", x: 0, y: 26 }, mark).textContent = "START";
    }
    const road = svgEl("g", { class: "rz-road" }, view);
    for (const [from, to] of roadPairs) {
      // The ends ride on the line, so editing (views/suggest.js) can drop a new step between them.
      state.segFor.set(`${from}->${to}`, svgEl("path", { class: "rz-seg", d: segment(p.at.get(from), p.at.get(to)).d, "data-from": from, "data-to": to }, road));
    }

    const nodes = svgEl("g", { class: "rz-nodes" }, view);
    for (const id of [...p.stops.flat(), ...p.side]) {
      const node = graph.byId?.get(id) ?? graph.nodes.find((item) => item.id === id);
      const at = p.at.get(id);
      const g = svgEl("g", { class: "rz-node", transform: `translate(${at.x} ${at.y})`, tabindex: 0, role: "button", "data-id": id }, nodes);
      const body = svgEl("g", { class: "rz-node__body" }, g);
      svgEl("circle", { class: "rz-halo", r: NODE_R + 9 }, body);
      // A step we do for them wears a second ring: someone else's hands are on it too.
      if (node.paidOnly || (freeMap && node.stages?.length)) svgEl("circle", { class: "rz-ring2", r: NODE_R + 5 }, body);
      if (node.landmark === "goal") svgEl("circle", { class: "rz-ring2 rz-goal", r: NODE_R + 6 }, body);
      svgEl("circle", { class: "rz-ring", r: NODE_R }, body);
      svgEl("text", { class: "rz-num" }, body).textContent = stepNumber(node);
      if (node.paidOnly && !node.landmark) {
        // The "we do this" mark: a C for coach on the ring.
        const badge = svgEl("g", { class: "rz-dfy", transform: `translate(${NODE_R * 0.95} ${-NODE_R * 0.95})` }, body);
        svgEl("circle", { r: 8 }, badge);
        svgEl("text", { y: 0.5 }, badge).textContent = "C";
      }
      // The type tag and a due date ride under the title, in the same text, so
      // they move with it when labels make room for each other.
      const base = NODE_R + 22;
      const lx = 0;
      const title = svgEl("text", { class: "rz-title", x: lx, y: base, "data-base": base }, g);
      wrapLabel(node.title, 19, 3).forEach((line, index) => {
        svgEl("tspan", { x: lx, dy: index ? 15 : 0 }, title).textContent = line;
      });
      // A Complete step's hint (prep.js): where our work for them stands, or the day it opens.
      // A free map: a step with a film says so, with its length.
      const film = freeMap && node.video?.mins ? `▶ ${node.video.mins} min` : null;
      // A step the student suggested (views/suggest.js) says so, like anything else made for them.
      const idea = node.suggested?.some((mark) => mark.kind === "add") ? "Your idea" : null;
      const meta = [idea, specOf(node).tag && typeOf(node) !== "step" ? specOf(node).tag : null, node.due ? dueText(node.due) : null, node.hint ?? null].filter(Boolean).join(" · ");
      if (meta) svgEl("tspan", { class: `rz-meta${node.due ? " is-due" : ""}${node.hint && !node.due ? " is-hint" : ""}`, x: lx, dy: 15 }, title).textContent = meta;
      if (film) svgEl("tspan", { class: "rz-meta rz-film", x: lx, dy: 15 }, title).textContent = film;
      svgEl("text", { class: "rz-here", y: -NODE_R - 16 }, g).textContent = "YOU ARE HERE";
      if (node.win) svgEl("text", { class: "rz-win", y: -NODE_R - 16 }, g).textContent = WIN_LABEL.toUpperCase();
      state.nodeEls.set(id, g);
    }
    sizeSvg();
  }

  /* ---------- what's ready for you, as nodes beside you ---------- */

  function drawReady(options) {
    view.querySelector(".rz-ready")?.remove();
    state.movers = [];
    for (const g of state.nodeEls.values()) g.classList.remove("is-here-only");
    const p = state.plan;
    const ready = options.ready ?? state.ready;
    if (!p || !ready) return;
    state.ready = ready;
    state.onTool = options.onTool ?? state.onTool;
    const hereId = options.nextId ?? state.nextId;
    const here = p.at.get(hereId) ?? p.at.get(p.order[0]);
    if (!here) return;
    const items = ready.items ?? [];
    if (!items.length) return;
    // One white ring, ever: when the next move is one of these, the step you're on is "you are here".
    if (items.some((item) => item.isNext)) state.nodeEls.get(hereId)?.classList.add("is-here-only");
    const group = svgEl("g", { class: "rz-ready" });
    view.insertBefore(group, view.querySelector(".rz-nodes"));
    const x = here.x + READY_DX;
    const used = new Map();
    const movers = [];
    items.forEach((item) => {
      const label = `${item.isNext ? "Do this next: " : ""}${item.title}${item.tag ? `, ${item.tag}` : ""}`;
      const open = (event) => {
        event.stopPropagation();
        state.onTool?.(item.tool);
      };
      let g;
      if (item.isNext) {
        // The next move is a pin standing on the step you're on, not another
        // stop on the road: a short stem up from "you are here" to a small
        // white dot, the move stacked above it.
        g = svgEl("g", { class: "rz-ready__node rz-pin is-next", transform: `translate(${here.x} ${here.y})`, tabindex: 0, role: "button", "aria-label": label }, group);
        const stem = svgEl("line", { class: "rz-pin__stem", x1: 0, x2: 0, y1: PIN_FOOT }, g);
        const head = svgEl("g", { class: "rz-pin__head" }, g);
        svgEl("circle", { class: "rz-pin__halo", r: 9 }, head);
        svgEl("circle", { class: "rz-pin__dot", r: 5 }, head);
        let y = -14;
        if (item.tag) {
          const w = 12 + item.tag.length * 6.3;
          svgEl("rect", { class: "rz-ready__tag", x: -w / 2, y: y - 17, width: w, height: 17, rx: 8.5 }, head);
          svgEl("text", { class: "rz-ready__tagtext", x: 0, y: y - 8.5 }, head).textContent = item.tag;
          y -= 23;
        }
        const lines = wrapLabel(item.title, 24, 3);
        const title = svgEl("text", { class: "rz-pin__title", y: y - 4 - (lines.length - 1) * 15 }, head);
        lines.forEach((line, index) => {
          svgEl("tspan", { x: 0, dy: index ? 15 : 0 }, title).textContent = line;
        });
        y -= 4 + lines.length * 15;
        svgEl("text", { class: "rz-here rz-ready__next", y: y - 2 }, head).textContent = "DO THIS NEXT";
        const place = (lift) => {
          head.setAttribute("transform", `translate(0 ${PIN_HEAD - lift})`);
          stem.setAttribute("y2", PIN_HEAD - lift + 6);
        };
        place(0);
        movers.push({ el: head, dir: -1, place });
      } else {
        const laneY = p.laneYOf(item.lane) ?? here.y;
        const k = used.get(laneY) ?? 0;
        used.set(laneY, k + 1);
        const y0 = laneY + k * 0.9 * CELL;
        // The line from you: these were made for where you are now.
        const tie = svgEl("path", { class: "rz-ready__tie" }, group);
        g = svgEl("g", { class: "rz-ready__node", tabindex: 0, role: "button", "aria-label": label }, group);
        svgEl("circle", { class: "rz-ready__ring", r: 11 }, g);
        const title = svgEl("text", { class: "rz-ready__title", x: 22, y: item.tag ? -2 : 4 }, g);
        title.textContent = item.title.length > 38 ? `${item.title.slice(0, 36).replace(/[,\s]+\S*$/, "")}…` : item.title;
        if (item.tag) {
          const w = 12 + item.tag.length * 6.3;
          svgEl("rect", { class: "rz-ready__tag", x: 22, y: 6, width: w, height: 17, rx: 8.5 }, g);
          svgEl("text", { class: "rz-ready__tagtext", x: 22 + w / 2, y: 15 }, g).textContent = item.tag;
        }
        const place = (drop) => {
          const y = y0 + drop;
          g.setAttribute("transform", `translate(${x} ${y})`);
          tie.setAttribute("d", `M ${here.x + 12} ${here.y} C ${here.x + 0.9 * CELL} ${here.y}, ${x - 0.9 * CELL} ${y}, ${x - 14} ${y}`);
        };
        place(0);
        movers.push({ el: g, dir: 1, place });
      }
      g.addEventListener("click", open);
      g.addEventListener("keydown", (event) => (event.key === "Enter" || event.key === " ") && open(event));
    });
    state.movers = movers;
  }

  /* ---------- no text on text ---------- */

  /** An element's box in board units, padded; null while it isn't laid out (hidden tab, no fonts yet). */
  function boxOf(element, pad = LABEL_PAD) {
    let b;
    try {
      b = element.getBBox();
    } catch {
      return null;
    }
    if (!b.width && !b.height) return null;
    const m = element.getCTM();
    const v = view.getCTM();
    if (!m || !v) return null;
    const t = v.inverse().multiply(m);
    return { x0: t.e + b.x * t.a - pad, y0: t.f + b.y * t.d - pad, x1: t.e + (b.x + b.width) * t.a + pad, y1: t.f + (b.y + b.height) * t.d + pad };
  }

  const hits = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  /**
   * Every label gets its own space. The road's labels and rings stand where the
   * road puts them; a road title that would sit on another drops below it, and
   * the pin rises and the ready nodes drop until nothing touches.
   */
  function declutter() {
    const solid = [];
    const take = (element) => {
      const b = boxOf(element);
      if (b) solid.push(b);
    };
    view.querySelectorAll(".rz-band__label, .rz-band__pace, .rz-lane__label").forEach(take);
    for (const g of state.nodeEls.values()) {
      take(g.querySelector(".rz-ring"));
      if (g.classList.contains("is-next")) take(g.querySelector(".rz-here"));
    }
    for (const g of state.nodeEls.values()) {
      const title = g.querySelector(".rz-title");
      const base = Number(title.getAttribute("data-base") ?? NODE_R + 22);
      title.setAttribute("y", base);
      for (let drop = 0; drop <= MAX_NUDGE; drop += NUDGE) {
        title.setAttribute("y", base + drop);
        const b = boxOf(title);
        if (!b || !solid.some((s) => hits(b, s))) break;
      }
      take(title);
    }
    for (const mover of state.movers ?? []) {
      for (let shift = 0; shift <= MAX_NUDGE; shift += NUDGE) {
        mover.place(shift);
        const b = boxOf(mover.el);
        if (!b || !solid.some((s) => hits(b, s))) break;
      }
      take(mover.el);
    }
  }

  /* ---------- paint ---------- */

  function settled(node) {
    return node?.status === "lit" || Boolean(node?.awaitingSignoff);
  }

  function paintAll(graph, options) {
    const trace = options.tracingId ? traceSet(graph, options.tracingId) : null;
    svg.classList.toggle("is-tracing", Boolean(trace));
    for (const node of graph.nodes) {
      const g = state.nodeEls.get(node.id);
      if (!g) continue;
      const standing = standingOf(node, options.nextId);
      for (const name of Object.values(STANDING)) g.classList.toggle(`is-${name}`, name === standing);
      g.classList.toggle("is-open-status", node.status === "open");
      // A free map: a step we do on the paid plan reads quieter than one they can do now.
      g.classList.toggle("is-paid", Boolean(node.paidOnly) && !node.preview);
      g.classList.toggle("is-preview", Boolean(node.preview));
      g.classList.toggle("is-win", Boolean(node.win));
      for (const kind of ["scan", "goal", "more", "waiting"]) g.classList.toggle(`is-${kind}`, node.landmark === kind);
      g.classList.toggle("is-trace", Boolean(trace?.has(node.id)));
      // Suggested changes, drawn on the map while the student suggests them (and in Aden's review).
      const marks = new Set((node.suggested ?? []).map((mark) => mark.kind));
      g.classList.toggle("is-suggested", marks.size > 0);
      for (const kind of ["add", "task", "move", "retire", "rename", "ask"]) g.classList.toggle(`is-sg-${kind}`, marks.has(kind));
      g.dataset.standing = standing;
      g.setAttribute("aria-label", `Node ${stepNumber(node)}: ${node.title}`);
    }
    for (const [key, path] of state.segFor) {
      const [from, to] = key.split("->");
      const a = graph.byId?.get(from);
      const b = graph.byId?.get(to);
      const done = settled(a) && settled(b);
      // Bright only into the step you're on (or work already in): a habit or a
      // call that's always open doesn't light the road toward it.
      const live = !done && (b?.id === options.nextId || b?.status === "lit" || b?.awaitingSignoff);
      path.classList.toggle("is-done", done);
      path.classList.toggle("is-live", live);
      path.classList.toggle("is-trace", Boolean(trace?.has(from) && trace?.has(to)));
    }
    for (const [key, path] of state.tieFor) {
      const [from, to] = key.split("->");
      path.classList.toggle("is-trace", Boolean(trace?.has(from) && trace?.has(to)));
    }
  }

  /**
   * Current runs the road from `fromId` to `toId` once, lighting `toId` as it
   * arrives. Used for the first arrival on mount and for each step forward.
   */
  function runTo(fromId, toId) {
    const p = state.plan;
    const from = p.order.indexOf(fromId);
    const to = p.order.indexOf(toId);
    const target = state.nodeEls.get(toId);
    if (from < 0 || to <= from || !target || reducedMotion) return;
    const points = p.order.slice(from, to + 1).map((id) => p.at.get(id));
    const d = points.slice(1).map((b, index) => linePath(points[index], b, p.typed).d).map((seg, index) => (index ? seg.replace(/^M [^C]+/, "") : seg)).join(" ");
    state.cancelCurrent();
    const current = svgEl("path", { class: "rz-current", d }, view.querySelector(".rz-road"));
    const spark = svgEl("circle", { class: "rz-spark", r: 3.5, cx: points[0].x, cy: points[0].y }, view);
    const body = target.querySelector(".rz-node__body");
    body.style.opacity = "0";
    const duration = Math.min(1600, 500 + 260 * (to - from));
    state.cancelCurrent = runCurrent({
      path: current,
      spark,
      duration,
      stops: [{ at: 0.985, arrive: () => rezIn(body) }],
      onDone: () => {
        setTimeout(() => {
          current.remove();
          spark.remove();
        }, 520);
      },
    });
  }

  /* ---------- camera ---------- */

  /** Put a board point at an anchor of the screen (35% across, 45% down by default). */
  function scrollToPoint(at, { glide = false, anchor = 0.35 } = {}) {
    if (!at) return;
    const w = host.clientWidth || 1200;
    const h = host.clientHeight || 800;
    // Vertically, center the whole board between the top bar (and Aden's line) and the bottom bar when it fits;
    // otherwise keep the node at 45% down.
    const usable = h - 96 - 84;
    const fits = state.plan && state.plan.height * state.zoom <= usable;
    // Too tall: the top of the board (phase names) sits just under Aden's line, lanes below, side quests last.
    const ty = fits ? 96 + (usable - state.plan.height * state.zoom) / 2 : 92 - 20 * state.zoom;
    const tx = w * (w < 700 ? 0.22 : anchor) - at.x * state.zoom;
    if (glide) glideTo({ tx, ty, zoom: state.zoom });
    else {
      state.tx = tx;
      state.ty = ty;
      clampPan();
      applyView();
    }
  }

  return {
    nodeEls: state.nodeEls,
    renderScene(graph, options = {}) {
      state.graph = graph;
      rebuild(graph);
      state.nextId = undefined;
      this.paint(graph, options);
      // Label widths change when the web fonts land; settle again then.
      document.fonts?.ready.then(() => state.graph === graph && declutter());
      // First sight: light runs from the start of the road to where you are, once.
      if (!state.arrived && options.nextId && state.plan.order[0] !== options.nextId) {
        state.arrived = true;
        runTo(state.plan.order[0], options.nextId);
      }
    },
    paint(graph, options = {}) {
      state.graph = graph;
      const nextChanged = state.nextId !== undefined && options.nextId && options.nextId !== state.nextId;
      const previous = nextChanged ? graph.byId?.get(state.nextId) : null;
      const stepped = Boolean(previous && settled(previous));
      const previousId = state.nextId;
      state.nextId = options.nextId ?? null;
      paintAll(graph, options);
      drawReady(options);
      declutter();
      if (stepped) {
        runTo(previousId, options.nextId);
        scrollToPoint(state.plan.at.get(options.nextId), { glide: true });
      }
    },
    frame(node, { glide = false } = {}) {
      scrollToPoint(state.plan?.at.get(node.id), { glide });
    },
    approach(node) {
      const g = state.nodeEls.get(node.id);
      if (!g || reducedMotion) return Promise.resolve();
      g.classList.add("is-approach");
      return new Promise((resolve) =>
        setTimeout(() => {
          g.classList.remove("is-approach");
          resolve();
        }, APPROACH_MS)
      );
    },
    retreat(node) {
      scrollToPoint(state.plan?.at.get(node.id), { glide: true });
    },
    fit() {
      if (!state.plan || !host.clientWidth) return;
      const { width, height } = state.plan;
      const zoom = Math.max(MIN_ZOOM, Math.min(1.2, (host.clientWidth - 80) / width, (host.clientHeight - 140) / height));
      glideTo({ zoom, tx: (host.clientWidth - width * zoom) / 2, ty: Math.max(70, (host.clientHeight - height * zoom) / 2) });
    },
    zoomBy(factor) {
      glideTo({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor)), px: host.clientWidth / 2, py: host.clientHeight / 2, ms: 200 });
    },
    didDrag: () => dragged,
    resize() {},
    destroy() {
      state.cancelCurrent();
      state.cancelGlide();
      clear(container);
    },
  };
}
