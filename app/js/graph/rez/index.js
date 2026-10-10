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

import { el, clear } from "../../dom.js?v=d696edf-202610102057";
import { traceSet, stepNumber } from "../model.js?v=d696edf-202610102057";
import { STANDING, standingOf, inSequence } from "../standing.js?v=d696edf-202610102057";
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
} from "../../../../js/rez/road.js?v=d696edf-202610102057";

/*
 * One grid under everything, in the board's own units (as on the landing):
 * a cell is half a lane, steps stand every third column, so lanes are grid
 * lines and every step sits on a crossing at any zoom.
 */
const CELL = 50;
const SPACING = 3 * CELL;
const LANE_GAP = 2 * CELL;
const TOP = 2 * CELL;
const LEFT = 4 * CELL;
const RIGHT = 4 * CELL;
const SIDE_GAP = 3 * CELL;
/** Ready nodes stand this far right of you, in their lanes. */
const READY_DX = 1.5 * CELL;
const NODE_R = 15;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.6;
/** The canvas never loses the map entirely: at least this much of it stays on screen. */
const KEEP_PX = 160;
const APPROACH_MS = 220;
const DRAG_SLOP = 5;

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
    const laneY = (lane) => laneTop + lane * LANE_GAP;
    const placed = layoutRoad(
      road.map((node) => ({ id: node.id, phase: node.phase, lane: laneOf.get(node.family) ?? 0 })),
      { x0: LEFT, x1: LEFT, laneY, spacing: SPACING }
    );
    const at = new Map(placed.map((point) => [point.id, point]));
    const roadBottom = laneY(lanes - 1);
    const sideY = roadBottom + SIDE_GAP;
    side.forEach((node, index) => at.set(node.id, { id: node.id, x: LEFT + index * SPACING, y: sideY, side: true }));
    const lastX = Math.max(LEFT, ...[...at.values()].map((point) => point.x));
    return {
      at,
      order: road.map((node) => node.id),
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

    const back = svgEl("g", { class: "rz-back" }, view);
    // The grid runs far past the map in every direction: the canvas has no edge to find.
    drawGrid(back, { id: "route-grid", cell: CELL, x: -200 * CELL, y: -200 * CELL, width: p.width + 400 * CELL, height: p.height + 400 * CELL });
    for (const band of p.bands) {
      svgEl("rect", { class: "rz-band", x: band.x0, y: 24, width: band.x1 - band.x0, height: p.height - 48, rx: 10 }, back);
      svgEl("text", { class: "rz-band__label", x: band.x0 + 14, y: 46 }, back).textContent = band.label ?? band.id;
      // Pace reads up to its colon: "Phase 1 · weeks 1–3", not the whole sentence.
      if (band.pace) svgEl("text", { class: "rz-band__pace", x: band.x0 + 14, y: 62 }, back).textContent = band.pace.split(":")[0];
    }
    for (const row of p.rows) {
      svgEl("line", { class: "rz-lane", x1: 24, x2: p.width - 24, y1: row.y, y2: row.y }, back);
      svgEl("text", { class: "rz-lane__label", x: 24, y: row.y - 8 }, back).textContent = row.label.toUpperCase();
    }
    if (p.sideY !== null) {
      svgEl("text", { class: "rz-lane__label", x: 24, y: p.sideY - 40 }, back).textContent = "SIDE QUESTS";
    }
    const ties = svgEl("g", { class: "rz-ties" }, view);
    const consecutive = new Set(p.order.slice(1).map((id, index) => `${p.order[index]}->${id}`));
    for (const edge of graph.edges ?? []) {
      const key = `${edge.from}->${edge.to}`;
      const a = p.at.get(edge.from);
      const b = p.at.get(edge.to);
      if (!a || !b || consecutive.has(key) || a.side || b.side) continue;
      const [seg] = roadSegments([a, b]);
      state.tieFor.set(key, svgEl("path", { class: "rz-tie", d: seg.d }, ties));
    }

    const road = svgEl("g", { class: "rz-road" }, view);
    for (const seg of roadSegments(p.order.map((id) => ({ ...p.at.get(id) })))) {
      state.segFor.set(`${seg.from.id}->${seg.to.id}`, svgEl("path", { class: "rz-seg", d: seg.d }, road));
    }

    const nodes = svgEl("g", { class: "rz-nodes" }, view);
    for (const id of [...p.order, ...p.side]) {
      const node = graph.byId?.get(id) ?? graph.nodes.find((item) => item.id === id);
      const at = p.at.get(id);
      const g = svgEl("g", { class: "rz-node", transform: `translate(${at.x} ${at.y})`, tabindex: 0, role: "button", "data-id": id }, nodes);
      const body = svgEl("g", { class: "rz-node__body" }, g);
      svgEl("circle", { class: "rz-halo", r: NODE_R + 9 }, body);
      svgEl("circle", { class: "rz-ring", r: NODE_R }, body);
      svgEl("text", { class: "rz-num" }, body).textContent = stepNumber(node);
      const title = svgEl("text", { class: "rz-title", y: NODE_R + 22 }, g);
      wrapLabel(node.title, 19, 3).forEach((line, index) => {
        svgEl("tspan", { x: 0, dy: index ? 15 : 0 }, title).textContent = line;
      });
      svgEl("text", { class: "rz-here", y: -NODE_R - 16 }, g).textContent = "YOU ARE HERE";
      state.nodeEls.set(id, g);
    }
    sizeSvg();
  }

  /* ---------- what's ready for you, as nodes beside you ---------- */

  function drawReady(options) {
    view.querySelector(".rz-ready")?.remove();
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
    items.forEach((item) => {
      const laneY = p.laneYOf(item.lane) ?? here.y;
      const k = used.get(laneY) ?? 0;
      used.set(laneY, k + 1);
      const y = laneY + k * 0.9 * CELL;
      // The line from you: these were made for where you are now.
      svgEl("path", { class: `rz-ready__tie${item.isNext ? " is-next" : ""}`, d: `M ${here.x + 12} ${here.y} C ${here.x + 0.9 * CELL} ${here.y}, ${x - 0.9 * CELL} ${y}, ${x - 14} ${y}` }, group);
      const g = svgEl("g", { class: `rz-ready__node${item.isNext ? " is-next" : ""}`, transform: `translate(${x} ${y})`, tabindex: 0, role: "button", "aria-label": `${item.isNext ? "Do this next: " : ""}${item.title}${item.tag ? `, ${item.tag}` : ""}` }, group);
      if (item.isNext) svgEl("circle", { class: "rz-ready__halo", r: 22 }, g);
      svgEl("circle", { class: "rz-ready__ring", r: item.isNext ? 14 : 11 }, g);
      if (item.isNext) svgEl("text", { class: "rz-here rz-ready__next", y: -26 }, g).textContent = "DO THIS NEXT";
      const title = svgEl("text", { class: "rz-ready__title", x: 22, y: item.tag ? -2 : 4 }, g);
      title.textContent = item.title.length > 38 ? `${item.title.slice(0, 36).replace(/[,\s]+\S*$/, "")}…` : item.title;
      if (item.tag) {
        const w = 12 + item.tag.length * 6.3;
        svgEl("rect", { class: "rz-ready__tag", x: 22, y: 6, width: w, height: 17, rx: 8.5 }, g);
        svgEl("text", { class: "rz-ready__tagtext", x: 22 + w / 2, y: 15 }, g).textContent = item.tag;
      }
      const open = (event) => {
        event.stopPropagation();
        state.onTool?.(item.tool);
      };
      g.addEventListener("click", open);
      g.addEventListener("keydown", (event) => (event.key === "Enter" || event.key === " ") && open(event));
    });
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
      g.classList.toggle("is-trace", Boolean(trace?.has(node.id)));
      g.dataset.standing = standing;
      g.setAttribute("aria-label", `Node ${stepNumber(node)}: ${node.title}`);
    }
    for (const [key, path] of state.segFor) {
      const [from, to] = key.split("->");
      const a = graph.byId?.get(from);
      const b = graph.byId?.get(to);
      const done = settled(a) && settled(b);
      const live = !done && (b?.status === "open" || b?.status === "lit" || b?.awaitingSignoff);
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
    const d = roadSegments(points).map((seg, index) => (index ? seg.d.replace(/^M [^C]+/, "") : seg.d)).join(" ");
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
