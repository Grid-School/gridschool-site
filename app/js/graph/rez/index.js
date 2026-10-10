/**
 * The Route: the same board as the floor (scene3d), drawn flat on the road the
 * landing draws (js/rez/road.js). Depth is sequence left to right, height is
 * family, one curve per edge. A student picks Floor or Route on the map; this
 * file keeps scene3d's interface exactly (renderScene, paint, nodeEls, frame,
 * approach, retreat, fit, zoomBy, didDrag, resize, destroy), so map.js does
 * not care which one it holds.
 *
 * Light means done. Behind you the road is green and settled, the stretch
 * into the step you are on is cyan, and ahead it is a dim line. When a step
 * lights, current runs once from it to the new Next, which pops in, and the
 * view glides to it. Nothing idles. Reduced motion jumps.
 */

import { el, clear } from "../../dom.js?v=15fea56-202610100117";
import { traceSet, stepNumber } from "../model.js?v=15fea56-202610100117";
import { STANDING, standingOf, inSequence } from "../standing.js?v=15fea56-202610100117";
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
} from "../../../../js/rez/road.js?v=15fea56-202610100117";

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
const NODE_R = 15;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
const APPROACH_MS = 220;
const DRAG_SLOP = 5;

export async function createRezScene(container) {
  const reducedMotion = prefersReducedMotion();
  const svg = svgEl("svg", { class: "rez-board", role: "group", "aria-label": "Your route" });
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
    nextId: undefined,
    cancelCurrent: () => {},
    arrived: false,
  };

  /* ---------- drag to pan ---------- */
  let drag = null;
  let dragged = false;
  const onDown = (event) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    drag = { x: event.clientX, y: event.clientY, left: host.scrollLeft, top: host.scrollTop };
    dragged = false;
  };
  const onMove = (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP) return;
    dragged = true;
    host.classList.add("is-dragging");
    host.scrollLeft = drag.left - dx;
    host.scrollTop = drag.top - dy;
  };
  const onUp = () => {
    drag = null;
    host.classList.remove("is-dragging");
  };
  // A click that ended a drag is swallowed before it reaches a node.
  const onClickCapture = (event) => {
    if (!dragged) return;
    event.stopPropagation();
    event.preventDefault();
    dragged = false;
  };
  host.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  host.addEventListener("click", onClickCapture, true);

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
    const laneY = (lane) => TOP + lane * LANE_GAP;
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
      width: lastX + RIGHT,
      height: (side.length ? sideY : roadBottom) + 2 * CELL,
    };
  }

  function sizeSvg() {
    if (!state.plan) return;
    const { width, height } = state.plan;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", Math.round(width * state.zoom));
    svg.setAttribute("height", Math.round(height * state.zoom));
  }

  function rebuild(graph) {
    state.cancelCurrent();
    state.plan = plan(graph);
    state.nodeEls.clear();
    state.segFor.clear();
    state.tieFor.clear();
    svg.replaceChildren();
    const { plan: p } = state;

    const back = svgEl("g", { class: "rz-back" }, svg);
    // Far past the edges: the host scrolls over padding, and the grid should too.
    drawGrid(back, { id: "route-grid", cell: CELL, x: -20 * CELL, y: -20 * CELL, width: p.width + 40 * CELL, height: p.height + 40 * CELL });
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

    const ties = svgEl("g", { class: "rz-ties" }, svg);
    const consecutive = new Set(p.order.slice(1).map((id, index) => `${p.order[index]}->${id}`));
    for (const edge of graph.edges ?? []) {
      const key = `${edge.from}->${edge.to}`;
      const a = p.at.get(edge.from);
      const b = p.at.get(edge.to);
      if (!a || !b || consecutive.has(key) || a.side || b.side) continue;
      const [seg] = roadSegments([a, b]);
      state.tieFor.set(key, svgEl("path", { class: "rz-tie", d: seg.d }, ties));
    }

    const road = svgEl("g", { class: "rz-road" }, svg);
    for (const seg of roadSegments(p.order.map((id) => ({ ...p.at.get(id) })))) {
      state.segFor.set(`${seg.from.id}->${seg.to.id}`, svgEl("path", { class: "rz-seg", d: seg.d }, road));
    }

    const nodes = svgEl("g", { class: "rz-nodes" }, svg);
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
    const current = svgEl("path", { class: "rz-current", d }, svg.querySelector(".rz-road"));
    const spark = svgEl("circle", { class: "rz-spark", r: 3.5, cx: points[0].x, cy: points[0].y }, svg);
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

  function scrollToPoint(at, { glide = false, anchor = 0.35 } = {}) {
    if (!at) return;
    const left = at.x * state.zoom - host.clientWidth * anchor;
    const top = at.y * state.zoom - host.clientHeight * 0.45;
    host.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: glide && !reducedMotion ? "smooth" : "auto" });
  }

  function setZoom(next, { keepCenter = true } = {}) {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const cx = (host.scrollLeft + host.clientWidth / 2) / state.zoom;
    const cy = (host.scrollTop + host.clientHeight / 2) / state.zoom;
    state.zoom = zoom;
    sizeSvg();
    if (keepCenter) {
      host.scrollLeft = cx * zoom - host.clientWidth / 2;
      host.scrollTop = cy * zoom - host.clientHeight / 2;
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
      const zoom = Math.min(1, host.clientWidth / state.plan.width, host.clientHeight / state.plan.height);
      setZoom(zoom, { keepCenter: false });
      host.scrollTo({ left: 0, top: 0 });
    },
    zoomBy(factor) {
      setZoom(state.zoom * factor);
    },
    didDrag: () => dragged,
    resize() {},
    destroy() {
      state.cancelCurrent();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      clear(container);
    },
  };
}
