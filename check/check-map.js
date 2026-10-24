/**
 * The check's map: You, the suspected bottlenecks (lit, the first glowing
 * "Start here"), then the areas still locked behind a chunk of questions
 * (dashed rings with a lock), then the offer. The same road and grid as the
 * landing (js/rez/road.js), so the map they meet here is the one they keep.
 *
 * Every answer redraws it: kept nodes slide, new ones arrive lit, dropped ones
 * fade. A tap or hover opens the node's card.
 */

import {
  svgEl,
  drawGrid,
  calmestLanes,
  layoutRoad,
  roadPath,
  runCurrent,
  arrivalFractions,
  rezIn,
  prefersReducedMotion,
} from "../js/rez/road.js?v=ac1f443-202610240735";

const CELL = 28;
const LANES = ["interview", "pipeline", "proof", "network", "presence"];
const LANE_NAMES = { interview: "Interview", pipeline: "Search", proof: "Proof", network: "People", presence: "Presence" };
const narrow = matchMedia("(max-width: 720px)");
const H = 13 * CELL; // a row of room under the bottom lane for "Start here"
const Y_TOP = 3 * CELL;
const laneY = (lane) => Y_TOP + lane * 2 * CELL;
// Lane names sit left of You on wide screens; phones hide them and use the room for the map.
const youX = () => (narrow.matches ? 1.5 * CELL : 4 * CELL);
const firstX = () => (narrow.matches ? 4 * CELL : 7 * CELL);
const stepWidth = () => (narrow.matches ? 1.5 * CELL : 2 * CELL);
const at = (x, y) => `translate(${x}px, ${y}px)`;

export function mountCheckMap({ svg, box, card }) {
  const reduce = prefersReducedMotion();
  let previous = null;
  let cancel = () => {};
  let lastNodes = [];
  let lastCompact = false;
  let lastWide = false;

  /**
   * `compact` is the phone's strip while questions are on screen: every node
   * on one line, no labels, a few rows tall, so the question keeps the screen
   * and each answer still visibly lands on the map. The full map is the default.
   */
  function render(nodes, { first = false, compact = false, wide = false } = {}) {
    cancel();
    hide();
    lastNodes = nodes;
    if (compact !== lastCompact || wide !== lastWide) previous = null; // a different shape: arrive fresh instead of sliding across
    lastCompact = compact;
    lastWide = wide;
    const height = compact ? 3 * CELL : H;
    const yOf = compact ? () => 1.5 * CELL : laneY;
    const order = calmestLanes(LANES, nodes.map((node) => node.family), { top: "interview" });
    const laneOf = Object.fromEntries(order.map((id, index) => [id, index]));
    const placed = layoutRoad(
      nodes.map((node) => ({ ...node, lane: laneOf[node.family] })),
      { x0: compact ? 3 * CELL : firstX(), x1: 0, laneY: yOf, spacing: compact ? 1.5 * CELL : wide ? 3 * CELL : stepWidth() }
    );
    const you = { x: compact ? CELL : youX(), y: placed[0]?.y ?? yOf(2) };
    const lastX = placed.length ? placed.at(-1).x : firstX();
    const end = { x: lastX + (compact ? 2 : 3) * CELL, y: yOf(0) };
    const W = end.x + (compact ? CELL : 3 * CELL);
    svg.setAttribute("viewBox", `0 0 ${W} ${height}`);
    svg.classList.toggle("is-narrow", narrow.matches);
    svg.classList.toggle("is-compact", compact);
    svg.replaceChildren();

    const grid = drawGrid(svg, { id: "check-grid", cell: CELL, x: -2 * CELL, y: 0, width: W + 4 * CELL, height, fade: true });
    if (first && !reduce) grid.classList.add("is-arriving");
    if (compact) svgEl("line", { class: "lane", x1: 0, x2: W, y1: yOf(0), y2: yOf(0) }, svg);
    else order.forEach((family, index) => {
      svgEl("line", { class: "lane", x1: youX() - CELL, x2: end.x + CELL, y1: laneY(index), y2: laneY(index) }, svg);
      svgEl("text", { class: "lane-name", x: CELL * 0.5, y: laneY(index) + 3.5 }, svg).textContent = LANE_NAMES[family];
    });

    const lit = placed.filter((node) => node.state !== "locked");
    const all = [you, ...placed, end];
    svgEl("path", { class: "road-ghost road-ghost--locked", d: roadPath(all) }, svg);
    const litPoints = [you, ...lit];
    const road = svgEl("path", { class: "road", d: litPoints.length > 1 ? roadPath(litPoints) : `M ${you.x} ${you.y}` }, svg);
    const arrivals = litPoints.length > 1 ? arrivalFractions(litPoints, road.getTotalLength(), svg) : [0];

    const layer = svgEl("g", {}, svg);
    const youG = svgEl("g", { class: "node node--you" }, layer);
    youG.style.transform = at(you.x, you.y);
    svgEl("circle", { class: "ring", r: 7 }, youG);
    if (!compact) svgEl("text", { class: "you-label", y: -18 }, youG).textContent = "You";

    if (previous && !reduce) {
      for (const [id, was] of previous) {
        if (placed.some((node) => node.id === id)) continue;
        const ghost = svgEl("circle", { class: "ghost-ring", r: 12, cx: was.x, cy: was.y }, layer);
        ghost.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 420, fill: "forwards" }).onfinish = () => ghost.remove();
      }
    }

    const stops = [];
    for (const node of placed) {
      const fresh = previous !== null && !previous.has(node.id);
      const g = svgEl("g", {
        class: `node node--${node.state}${fresh ? " is-new" : ""}`,
        "data-id": node.id,
        tabindex: 0,
        role: "button",
        "aria-label": node.state === "locked" ? `Locked: ${node.title}. Opens up with ${node.questions} questions.` : `Likely bottleneck: ${node.title}`,
      }, layer);
      g.style.transform = at(node.x, node.y);
      const pop = svgEl("g", { class: "node-pop" }, g);
      svgEl("circle", { class: "halo", r: 19 }, pop);
      svgEl("circle", { class: "ring", r: 12 }, pop);
      if (node.state === "locked") lock(pop);
      // The lit rings carry the numbers of the findings beside the map.
      else svgEl("text", { class: "num" }, pop).textContent = String(lit.findIndex((other) => other.id === node.id) + 1);
      if (node.state === "next") {
        svgEl("circle", { class: "pulse", r: 12 }, pop);
        // Below the ring: the road leaves upward toward the offer, so above is where it crosses.
        if (!compact) svgEl("text", { class: "here-label", y: 31 }, pop).textContent = "Start here";
      }
      const was = previous?.get(node.id);
      if (was && !reduce && (was.x !== node.x || was.y !== node.y)) {
        g.animate([{ transform: at(was.x, was.y) }, { transform: at(node.x, node.y) }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
      const show = () => open(node, g);
      g.addEventListener("mouseenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("click", show);
      g.addEventListener("mouseleave", hide);
      g.addEventListener("blur", hide);
      const index = lit.findIndex((other) => other.id === node.id);
      const waits = !reduce && (first || fresh);
      if (waits) pop.style.opacity = "0";
      stops.push({ at: index >= 0 ? arrivals[index + 1] : 1, arrive: () => waits && rezIn(pop) });
    }

    const endG = svgEl("g", { class: "node node--end" }, layer);
    endG.style.transform = at(end.x, end.y);
    svgEl("circle", { class: "ring", r: 12 }, endG);
    if (!compact) svgEl("text", { class: "end-label", y: 30 }, endG).textContent = "An offer";

    const spark = svgEl("circle", { class: "spark", r: 3, cx: you.x, cy: you.y }, svg);
    cancel = runCurrent({
      path: road,
      spark,
      stops,
      duration: first ? 1300 : 650,
      delay: first ? 300 : 0,
      instant: !first && previous !== null && !placed.some((node) => !previous.has(node.id)),
    });
    previous = new Map(placed.map((node) => [node.id, { x: node.x, y: node.y }]));
    holdLabelSize();
  }

  function lock(parent) {
    const g = svgEl("g", { class: "lock", transform: "translate(-4.5 -5)" }, parent);
    svgEl("rect", { x: 0, y: 4, width: 9, height: 7, rx: 1.6 }, g);
    svgEl("path", { d: "M2 4 V2.6 a2.5 2.5 0 0 1 5 0 V4", fill: "none" }, g);
  }

  function open(node, g) {
    for (const hot of svg.querySelectorAll(".node.is-hot")) hot.classList.remove("is-hot");
    g.classList.add("is-hot");
    const parts = [];
    if (node.state === "locked") {
      parts.push(el("span", "map-card__tag", `Locked · ${node.questions} questions · about ${node.minutes} min`));
      parts.push(el("b", "map-card__title", node.title));
      parts.push(el("p", "map-card__body", "This opens up once you have your full map."));
    } else {
      parts.push(el("span", "map-card__tag map-card__tag--lit", node.state === "next" ? "Likely · start here" : "Likely"));
      parts.push(el("b", "map-card__title", node.title));
      if (node.bottleneck?.evidence?.[0]) parts.push(el("p", "map-card__body", node.bottleneck.evidence[0]));
    }
    card.replaceChildren(...parts);
    card.hidden = false;
    const ctm = svg.getScreenCTM();
    const rect = box.getBoundingClientRect();
    const scale = ctm?.a ?? 1;
    const x = (ctm ? ctm.a * node.x + ctm.e : node.x) - rect.left;
    const y = (ctm ? ctm.d * node.y + ctm.f : node.y) - rect.top;
    const width = card.offsetWidth;
    card.style.left = `${Math.max(0, Math.min(box.clientWidth - width, x - width / 2))}px`;
    const above = y - card.offsetHeight - 24 * scale;
    card.style.top = `${above >= 0 ? above : y + 24 * scale}px`;
  }

  function hide() {
    card.hidden = true;
    for (const hot of svg.querySelectorAll(".node.is-hot")) hot.classList.remove("is-hot");
  }

  function holdLabelSize() {
    const scale = svg.getScreenCTM()?.a || 1;
    svg.style.setProperty("--u", (1 / scale).toFixed(3));
  }

  new ResizeObserver(holdLabelSize).observe(svg);
  box.addEventListener("pointerleave", hide);
  narrow.addEventListener("change", () => {
    previous = null;
    render(lastNodes, { compact: lastCompact && narrow.matches });
  });

  /** Light one node from outside the map (a finding card), or none. */
  function hot(id) {
    for (const node of svg.querySelectorAll(".node[data-id]")) node.classList.toggle("is-hot", node.dataset.id === id);
  }

  return { render, hot };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
