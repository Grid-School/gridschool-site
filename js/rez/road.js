/**
 * The road: the one drawing the landing draft and the resident's Route view
 * share. Steps sit left to right in order (depth is sequence), each on its
 * family's lane (height is family), joined by one curve per edge that leaves
 * and arrives travelling horizontally. Current runs the road once when
 * something changes, lights each step as it arrives, then stops.
 *
 * Pure layout and path math up top (tested in road.test.mjs); the DOM and
 * animation helpers below only run in a browser.
 */

export const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Place steps on the road. `steps` are in walking order and carry a `lane`
 * index. Returns new objects with `x`/`y`; the input is not touched.
 */
export function layoutRoad(steps, { x0, x1, laneY, spacing = null }) {
  const n = steps.length;
  const gap = spacing ?? (n > 1 ? (x1 - x0) / (n - 1) : 0);
  return steps.map((step, i) => ({ ...step, x: x0 + i * gap, y: laneY(step.lane ?? 0) }));
}

/** One cubic from a to b with horizontal tangents at both ends. */
export function curve(a, b) {
  const dx = (b.x - a.x) * 0.55;
  return `C ${r(a.x + dx)} ${r(a.y)} ${r(b.x - dx)} ${r(b.y)} ${r(b.x)} ${r(b.y)}`;
}

/** The whole road through `points`, as one path. */
export function roadPath(points) {
  if (!points.length) return "";
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) d += ` ${curve(points[i - 1], points[i])}`;
  return d;
}

/** Each consecutive pair as its own path, so stretches can be painted apart. */
export function roadSegments(points) {
  const out = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    out.push({ from: a, to: b, d: `M ${r(a.x)} ${r(a.y)} ${curve(a, b)}` });
  }
  return out;
}

/**
 * The lane order that makes the calmest road: the permutation of `families`
 * that minimises the total vertical travel along `sequence` (family ids in
 * walking order), with `top` pinned to row 0 and `bottom` (if given) pinned
 * to the last row, so the road still climbs from where you are toward the
 * offer. Brute force: five lanes are 120 orders. Ties keep the given order.
 */
export function calmestLanes(families, sequence, { top = null, bottom = null } = {}) {
  const free = families.filter((id) => id !== top && id !== bottom);
  let best = null;
  let bestCost = Infinity;
  for (const middle of permutations(free)) {
    const order = [...(top ? [top] : []), ...middle, ...(bottom ? [bottom] : [])];
    const row = new Map(order.map((id, index) => [id, index]));
    let cost = 0;
    for (let i = 1; i < sequence.length; i += 1) cost += Math.abs(row.get(sequence[i]) - row.get(sequence[i - 1]));
    if (cost < bestCost) {
      bestCost = cost;
      best = order;
    }
  }
  return best ?? families;
}

function* permutations(items) {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i += 1) {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) yield [items[i], ...rest];
  }
}

/** Phase bands: the x extent of each phase's steps, padded. Order follows `phases`. */
export function phaseBands(points, phases, pad = 28) {
  return phases
    .map((phase) => {
      const xs = points.filter((p) => p.phase === phase.id).map((p) => p.x);
      if (!xs.length) return null;
      return { ...phase, x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad };
    })
    .filter(Boolean);
}

/** Break a title into at most `lines` lines of about `width` characters. */
export function wrapLabel(text, width = 18, lines = 3) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const out = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = `${kept[lines - 1].replace(/[.,;:]?$/, "")}…`;
    return kept;
  }
  return out;
}

const r = (value) => Math.round(value * 10) / 10;

/* ---------- browser helpers ---------- */

export function svgEl(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  if (parent) parent.appendChild(node);
  return node;
}

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Run current along `path` once. `stops` are `{ at, arrive }` with `at` a
 * fraction of the path's length; each `arrive` fires once as the light
 * passes. Returns a cancel function. Reduced motion: everything arrives now.
 */
export function runCurrent({ path, spark = null, stops = [], duration = 1700, onDone = null }) {
  const length = path.getTotalLength();
  const fire = () => stops.forEach((stop) => stop.arrive());
  if (prefersReducedMotion() || !length) {
    path.style.strokeDasharray = "none";
    path.style.strokeDashoffset = "0";
    spark?.remove();
    fire();
    onDone?.();
    return () => {};
  }
  path.style.strokeDasharray = `${length} ${length}`;
  path.style.strokeDashoffset = String(length);
  const pending = [...stops].sort((a, b) => a.at - b.at);
  const start = performance.now();
  let frame = 0;
  let cancelled = false;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tick = (now) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / duration);
    const e = ease(t);
    path.style.strokeDashoffset = String(length * (1 - e));
    if (spark) {
      const p = path.getPointAtLength(length * e);
      spark.setAttribute("cx", p.x);
      spark.setAttribute("cy", p.y);
    }
    while (pending.length && pending[0].at <= e + 0.002) pending.shift().arrive();
    if (t < 1) frame = requestAnimationFrame(tick);
    else {
      pending.splice(0).forEach((stop) => stop.arrive());
      spark?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
      onDone?.();
    }
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

/**
 * The fraction of `path` at which each point is reached, measured with a
 * probe path built up curve by curve. `points[0]` is the road's start.
 */
export function arrivalFractions(points, total, parent) {
  const probe = svgEl("path", { d: "", fill: "none" }, parent);
  const out = [0];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` ${curve(points[i - 1], points[i])}`;
    probe.setAttribute("d", d);
    out.push(total ? probe.getTotalLength() / total : 1);
  }
  probe.remove();
  return out;
}

/**
 * The grid the road is drawn on, in the road's own units: `cell` is half a
 * lane, so every lane is a grid line and every step sits on a crossing. Drawn
 * inside the SVG so it scales and scrolls with the map and can never drift.
 * `fade` masks it to a soft pool around the middle (the landing); without it
 * the grid runs edge to edge (the Route).
 */
export function drawGrid(parent, { id, cell, x, y, width, height, fade = false }) {
  const defs = svgEl("defs", {}, parent);
  const pattern = svgEl("pattern", { id: `${id}-cell`, width: cell, height: cell, patternUnits: "userSpaceOnUse" }, defs);
  svgEl("path", { class: "rez-grid__line", d: `M ${cell} 0 L 0 0 0 ${cell}`, fill: "none" }, pattern);
  let mask = null;
  if (fade) {
    const gradient = svgEl("radialGradient", { id: `${id}-fade`, cx: "50%", cy: "50%", r: "62%" }, defs);
    svgEl("stop", { offset: "35%", "stop-color": "#fff" }, gradient);
    svgEl("stop", { offset: "100%", "stop-color": "#fff", "stop-opacity": "0" }, gradient);
    const m = svgEl("mask", { id: `${id}-mask` }, defs);
    svgEl("rect", { x, y, width, height, fill: `url(#${id}-fade)` }, m);
    mask = `url(#${id}-mask)`;
  }
  return svgEl("rect", { class: "rez-grid", x, y, width, height, fill: `url(#${id}-cell)`, mask }, parent);
}

/** A step popping in as the light reaches it. */
export function rezIn(node) {
  if (prefersReducedMotion() || typeof node.animate !== "function") {
    node.style.opacity = "1";
    return;
  }
  node.animate(
    [
      { transform: "scale(0.2)", opacity: 0 },
      { transform: "scale(1.16)", opacity: 1, offset: 0.6 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }
  );
}
