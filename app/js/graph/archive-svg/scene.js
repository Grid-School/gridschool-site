/**
 * The SVG scene. Circles for nodes, one curve per edge, a grid floor
 * that pans with the world. Status is expressed with classes so every visual
 * decision stays in CSS where the brand system lives.
 */

import { el, clear } from "../../dom.js";
import { edgePath, bounds, phaseBands } from "./layout.js";
import { spreadLabels } from "./labels.js";
import { STATUS, traceSet } from "../model.js";

const LABEL_CHARS = 17;
/**
 * Rough advance per character of .phaselabel. Measured against the widest case:
 * the zoomed-out step where the heading font grows to stay legible.
 */
const PHASE_LABEL_ADVANCE = 11.6;

export function createScene(svg) {
  clear(svg);

  const defs = el("defs", {}, gridPattern());
  const world = el("g.world");
  const floor = el("rect.floor", { x: -6000, y: -6000, width: 12000, height: 12000, fill: "url(#grid-floor)" });
  const phaseLayer = el("g.layer.layer--phases");
  const edgeLayer = el("g.layer.layer--edges");
  const draftLayer = el("g.layer.layer--draft");
  const nodeLayer = el("g.layer.layer--nodes");

  world.append(floor, phaseLayer, edgeLayer, draftLayer, nodeLayer);
  svg.append(defs, world);

  return {
    svg,
    world,
    phaseLayer,
    edgeLayer,
    draftLayer,
    nodeLayer,
    nodeEls: new Map(),
    edgeEls: new Map(),
  };
}

function gridPattern() {
  return el(
    "pattern",
    { id: "grid-floor", width: 64, height: 64, patternUnits: "userSpaceOnUse" },
    el("path", { d: "M 64 0 L 0 0 0 64", fill: "none", stroke: "var(--grid)", "stroke-width": 1 })
  );
}

export function renderScene(scene, graph, options = {}) {
  renderPhases(scene, graph);
  renderFamilies(scene, graph);
  renderEdges(scene, graph);
  renderNodes(scene, graph, options);
  paint(scene, graph, options);
}

/**
 * Phase bands are measured from the nodes that belong to them, not from a column
 * number in the data. A phase spanning two columns gets a label over the whole
 * span, and moving a node cannot leave its phase heading behind.
 */
function renderPhases(scene, graph) {
  clear(scene.phaseLayer);
  const box = bounds(graph, 120);
  const bands = phaseBands(graph);

  bands.forEach((band, index) => {
    const previous = bands[index - 1];
    if (previous) {
      const seam = (previous.maxX + band.minX) / 2;
      scene.phaseLayer.append(el("path.phaseline", { d: `M ${seam} ${box.minY} V ${box.maxY}` }));
    }
    const lines = [band.phase?.label ?? "", band.weeks ? `weeks ${band.weeks}` : ""].filter(Boolean);
    if (!lines.length) return;
    const half = (Math.max(...lines.map((line) => line.length)) * PHASE_LABEL_ADVANCE) / 2;
    const centre = (band.minX + band.maxX) / 2;
    const x = Math.min(Math.max(centre, box.minX + half), box.maxX - half);
    scene.phaseLayer.append(
      el(
        "text.phaselabel",
        { x, y: box.minY + 26, "text-anchor": "middle" },
        el("tspan", { x }, lines[0]),
        lines[1] ? el("tspan.phaselabel__weeks", { x, dy: 15 }, lines[1]) : null
      )
    );
  });
}

function renderFamilies(scene, graph) {
  const origin = Math.min(...graph.nodes.map((node) => node.x));
  const gutter = origin - 140;
  const rail = [];
  for (const family of graph.families ?? []) {
    const nodes = graph.nodes.filter((node) => node.family === family.id);
    if (!nodes.length) continue;
    const first = nodes.reduce((best, node) => {
      if (node.x < best.x) return node;
      if (node.x === best.x && node.y < best.y) return node;
      return best;
    });
    if (family.id === "capstone") {
      scene.phaseLayer.append(
        el(
          "text.familylabel",
          { x: first.x, y: first.y - first.r - 44, "text-anchor": "middle" },
          family.label
        )
      );
      continue;
    }
    rail.push({ label: family.label, y: first.y + 4 });
  }
  for (const item of spreadLabels(rail)) {
    scene.phaseLayer.append(
      el("text.familylabel", { x: gutter, y: item.y, "text-anchor": "end" }, item.label)
    );
  }
}


function renderEdges(scene, graph) {
  clear(scene.edgeLayer);
  scene.edgeEls.clear();
  for (const edge of graph.edges) {
    const from = graph.byId.get(edge.from);
    const to = graph.byId.get(edge.to);
    if (!from || !to) continue;
    const path = el("path.edge", { d: edgePath(from, to), dataset: { id: edge.id } });
    scene.edgeEls.set(edge.id, path);
    scene.edgeLayer.append(path);
  }
}

function renderNodes(scene, graph, options) {
  clear(scene.nodeLayer);
  scene.nodeEls.clear();
  for (const node of [...graph.nodes].sort((a, b) => a.n - b.n)) {
    const group = nodeElement(node, options);
    scene.nodeEls.set(node.id, group);
    scene.nodeLayer.append(group);
  }
}

function nodeElement(node, options) {
  const r = node.r;
  const group = el("g.gnode", {
    dataset: { id: node.id },
    transform: `translate(${node.x} ${node.y})`,
    tabindex: 0,
    role: "button",
    "aria-label": `Node ${node.n}: ${node.title}`,
  });

  const metaY = r + 24 + labelLines(node.title).length * 15;
  group.append(
    el("circle.gnode__halo", { r: r + 16 }),
    el("circle.gnode__hit", { r: r + 10 }),
    el("circle.gnode__ring", { r }),
    // Task progress, drawn as an arc filling the ring. Content set in paint().
    el("path.gnode__prog", { d: "" }),
    el("circle.gnode__core", { r: r - 9 }),
    el("text.gnode__num", { y: 5, "text-anchor": "middle" }, String(node.n).padStart(2, "0")),
    // Review standing, top-right of the ring. Class set in paint().
    el("circle.gnode__rvdot", { cx: r * 0.72, cy: -r * 0.72, r: 4.5 }),
    wrappedLabel(node.title, r + 24),
    el("text.gnode__meta", { y: metaY, "text-anchor": "middle" }, ""),
    // The receipt: where the evidence lives, visible from orbit. Set in paint().
    el("text.gnode__proofchip", { y: metaY + 15, "text-anchor": "middle" }, "")
  );

  return group;
}

function metaFor(node) {
  if (node.kind === "future") return "coming";
  if (node.status === STATUS.LOCKED) return "locked";
  const { done = 0, total = 0 } = node.taskProgress ?? {};
  if (node.status === STATUS.LIT) return "lit";
  if (node.awaitingSignoff) return "awaiting sign-off";
  if (node.offered) return "on offer";
  return total ? `${done}/${total} tasks` : "open";
}

/** The domain of the receipt, because "github.com" is proof and "https://…" is noise. */
function proofChipFor(node) {
  if (node.status !== STATUS.LIT || !node.proof?.url) return "";
  try {
    return new URL(node.proof.url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Arc from 12 o'clock, clockwise, `fraction` of the way around radius `r`. */
function progressArc(r, fraction) {
  if (!fraction) return "";
  if (fraction >= 1) {
    // A full circle collapses to nothing as an arc; two half-arcs read the same.
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}`;
  }
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  const x = r * Math.cos(angle);
  const y = r * Math.sin(angle);
  return `M 0 ${-r} A ${r} ${r} 0 ${fraction > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

function labelLines(title) {
  const words = String(title).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > LABEL_CHARS && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function wrappedLabel(title, y) {
  const text = el("text.gnode__label", { y, "text-anchor": "middle" });
  labelLines(title).forEach((line, index) => {
    text.append(el("tspan", { x: 0, dy: index === 0 ? 0 : 15 }, line));
  });
  return text;
}

/** Status classes only. Cheap enough to call on every state change. */
export function paint(scene, graph, { selectedId = null, nextId = null, tracingId = null } = {}) {
  const trace = tracingId ? traceSet(graph, tracingId) : null;

  scene.nodeEls.forEach((group, id) => {
    const node = graph.byId.get(id);
    if (!node) return;
    group.classList.toggle("is-lit", node.status === STATUS.LIT);
    group.classList.toggle("is-open", node.status === STATUS.OPEN);
    group.classList.toggle("is-locked", node.status === STATUS.LOCKED);
    group.classList.toggle("is-future", node.status === STATUS.FUTURE);
    group.classList.toggle("is-offered", Boolean(node.offered));
    group.classList.toggle("is-submitted", Boolean(node.awaitingSignoff));
    group.classList.toggle("is-next", id === nextId);
    group.classList.toggle("is-selected", id === selectedId);
    group.classList.toggle("is-onpath", Boolean(trace?.has(id)));
    group.classList.toggle("is-dimmed", Boolean(trace) && !trace.has(id));

    // Content that tracks the student's actual state, not just classes.
    group.querySelector(".gnode__meta").textContent = metaFor(node);
    group.querySelector(".gnode__proofchip").textContent = proofChipFor(node);

    const { done = 0, total = 0 } = node.taskProgress ?? {};
    const showProg = total > 0 && (node.status === STATUS.OPEN || node.status === STATUS.LIT);
    group
      .querySelector(".gnode__prog")
      .setAttribute("d", showProg ? progressArc(node.r, node.status === STATUS.LIT ? 1 : done / total) : "");

    const dot = group.querySelector(".gnode__rvdot");
    dot.classList.toggle("rv--sent", node.reviewState === "in-review");
    dot.classList.toggle("rv--back", node.reviewState === "returned");
  });

  scene.edgeEls.forEach((path, id) => {
    const [from, to] = id.split("->");
    const fromNode = graph.byId.get(from);
    const toNode = graph.byId.get(to);
    const done = fromNode?.status === STATUS.LIT;
    path.classList.toggle("edge--done", done);
    path.classList.toggle("edge--live", done && toNode?.status === STATUS.OPEN);
    path.classList.toggle("edge--onpath", Boolean(trace?.has(from) && trace?.has(to)));
    path.classList.toggle("edge--dimmed", Boolean(trace) && !(trace.has(from) && trace.has(to)));
  });
}

/** Cheap position sync during a drag. No rebuild, no flicker. */
export function syncPositions(scene, graph) {
  scene.nodeEls.forEach((group, id) => {
    const node = graph.byId.get(id);
    if (node) group.setAttribute("transform", `translate(${node.x} ${node.y})`);
  });
  scene.edgeEls.forEach((path, id) => {
    const [from, to] = id.split("->");
    const a = graph.byId.get(from);
    const b = graph.byId.get(to);
    if (a && b) path.setAttribute("d", edgePath(a, b));
  });
}
