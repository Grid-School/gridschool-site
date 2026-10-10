/**
 * The landing hero: three answers in a sentence, and the draft map drawn from
 * them (map-draft.js) on the road (rez/road.js). Titles and the hover card
 * come from the real module library, so the draft is the platform's own steps.
 * The answers ride the Book button into apply/, which carries the draft to the desk.
 *
 * Motion (BRAND.md 2026-10-07): on the first view of a session the current
 * waits for the headline, then runs the road once, lighting each phase and
 * step as it arrives. A repeat view starts drawn. Changing an answer morphs
 * the map: kept steps slide, new ones arrive lit, dropped ones fade.
 */

import { draftMap, stepTitle, checkOf, checkSummary, CHECK, FAMILIES, PHASES } from "./map-draft.js?v=5802f60-202610100134";
import {
  svgEl,
  drawGrid,
  calmestLanes,
  layoutRoad,
  roadPath,
  phaseBands,
  runCurrent,
  arrivalFractions,
  rezIn,
  prefersReducedMotion,
} from "./rez/road.js?v=5802f60-202610100134";

/*
 * Everything sits on one grid. CELL is half a lane: lanes are every second
 * grid line, steps every second column, so the lines under the map and the
 * lanes the steps stand on are the same lines. The width grows with the
 * number of steps and the SVG scales to its box, so the cells stay square.
 */
const CELL = 28;
const H = 12 * CELL;
const Y_TOP = 3 * CELL;
const laneY = (lane) => Y_TOP + lane * 2 * CELL;
const YOU_X = 2 * CELL;
const FIRST_X = 5 * CELL;
/** On a phone the road tightens to one column per step, so the map stays legible at 360px. */
const narrow = matchMedia("(max-width: 600px)");
const stepWidth = () => (narrow.matches ? CELL : 2 * CELL);
/** The current waits for the headline on a first view. */
const ARRIVAL_DELAY = 900;
const ARRIVED_KEY = "gridschool.arrived";

const CHECK_LABEL = {
  [CHECK.ADEN]: "Reviewed by Aden, in writing",
  [CHECK.OUTSIDE]: "Judged by an engineer who did not help you",
  [CHECK.ALONE]: "You run it; we read the numbers in your 1:1",
};

const $ = (selector) => document.querySelector(selector);
const pad = (n) => String(n).padStart(2, "0");
const at = (x, y) => `translate(${x}px, ${y}px)`;

async function loadLibrary() {
  try {
    const res = await fetch("data/modules/index.json");
    const { modules } = await res.json();
    return Object.fromEntries(modules.map((module) => [module.id, module]));
  } catch {
    return {};
  }
}

function answers() {
  return { stage: $("#f-stage").value, role: $("#f-role").value, stop: $("#f-stop").value };
}

/** Deep links (?stage=…) preselect the sentence, so an ad can open on its own reader. */
function preselect() {
  const params = new URLSearchParams(location.search);
  for (const key of ["stage", "role", "stop"]) {
    const value = params.get(key);
    const select = $(`#f-${key}`);
    if (value && [...select.options].some((option) => option.value === value)) {
      select.value = value;
      select.dispatchEvent(new Event("change")); // the picker button follows
    }
  }
}

function firstView() {
  try {
    if (sessionStorage.getItem(ARRIVED_KEY)) return false;
    sessionStorage.setItem(ARRIVED_KEY, "1");
  } catch {
    /* no storage: treat every view as the first */
  }
  return true;
}

export async function mountLandingMap() {
  const svg = $("#map-svg");
  if (!svg) return;
  const mapBox = $("#map");
  const stepsEl = $("#steps");
  const caption = $("#caption");
  const card = $("#step-card");
  const library = await loadLibrary();
  const reduce = prefersReducedMotion();
  let cancel = () => {};
  /** Where each step stood last time, so a change of answers can morph instead of redraw. */
  let previous = null;
  let first = firstView();
  let hotCircle = null;

  function render() {
    cancel();
    hideCard();
    const map = draftMap(answers());
    const changed = previous !== null;
    const added = changed ? map.nodes.filter((node) => !previous.has(node.id)).map((node) => node.id) : [];
    const removed = changed ? [...previous.keys()].filter((id) => !map.nodes.some((node) => node.id === id)) : [];

    $("#r-route").textContent = map.route;
    $("#r-count").textContent = map.nodes.length;
    readChecks(map.nodes);
    document.querySelectorAll("[data-book]").forEach((link) => (link.href = `apply/?${new URLSearchParams(map.answers)}`));

    // Interview stays on top, so the road ends climbing toward the offer;
    // the lanes between are ordered for the least up-and-down.
    const order = calmestLanes(FAMILIES.map((family) => family.id), map.nodes.map((node) => node.family), { top: "interview" });
    const laneOf = Object.fromEntries(order.map((id, index) => [id, index]));
    const steps = map.nodes.map((node) => ({
      ...node,
      lane: laneOf[node.family],
      label: stepTitle(node, library),
      purpose: library[node.module.split("@")[0]]?.purpose ?? "",
      check: checkOf(node),
    }));
    const points = layoutRoad(steps, { x0: FIRST_X, x1: FIRST_X, laneY, spacing: stepWidth() });
    const you = { x: YOU_X, y: points[0].y };
    const end = { x: points.at(-1).x + 3 * CELL, y: laneY(0) };
    const W = end.x + 3 * CELL;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.classList.toggle("is-narrow", narrow.matches);

    svg.replaceChildren();
    const grid = drawGrid(svg, { id: "draft-grid", cell: CELL, x: -2 * CELL, y: 0, width: W + 4 * CELL, height: H, fade: true });
    if (first && !reduce) grid.classList.add("is-arriving");
    hotCircle = reduce ? null : hotGrid(W);

    const bands = phaseBands(points, PHASES).map((band) => {
      const g = svgEl("g", { class: first && !reduce ? "phase" : "phase is-lit" }, svg);
      svgEl("rect", { class: "phase-band", x: band.x0, y: 18, width: band.x1 - band.x0, height: H - 18, rx: 8 }, g);
      svgEl("text", { class: "phase-label", x: band.x0 + 10, y: 36 }, g).textContent = narrow.matches ? band.short : band.label;
      svgEl("text", { class: "phase-pace", x: band.x0 + 10, y: 51 }, g).textContent = band.pace;
      return { g, x0: band.x0 };
    });
    FAMILIES.forEach((family) =>
      svgEl("line", { class: "lane", x1: YOU_X - CELL, x2: end.x + CELL, y1: laneY(family.lane), y2: laneY(family.lane) }, svg)
    );

    const all = [you, ...points, end];
    const d = roadPath(all);
    svgEl("path", { class: "road-ghost", d }, svg);
    const road = svgEl("path", { class: "road", d }, svg);
    const arrivals = arrivalFractions(all, road.getTotalLength(), svg);

    const layer = svgEl("g", {}, svg);
    const youG = svgEl("g", { class: "node node--you" }, layer);
    youG.style.transform = at(you.x, you.y);
    svgEl("circle", { class: "ring", r: 7 }, youG);
    svgEl("text", { class: "you-label", y: -18 }, youG).textContent = "You";

    // Steps that left the map fade where they stood.
    if (changed && !reduce) {
      for (const id of removed) {
        const was = previous.get(id);
        const ghost = svgEl("circle", { class: "ghost-ring", r: 12, cx: was.x, cy: was.y }, layer);
        ghost.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 420, fill: "forwards" }).onfinish = () => ghost.remove();
      }
    }

    stepsEl.replaceChildren();
    const stops = points.map((point, index) => {
      const fresh = added.includes(point.id);
      const g = svgEl("g", {
        class: `node check--${point.check}${fresh ? " is-new" : ""}`,
        tabindex: 0,
        role: "button",
        "aria-label": `Step ${point.n}: ${point.label}. ${CHECK_LABEL[point.check]}.`,
      }, layer);
      g.style.transform = at(point.x, point.y);
      const pop = svgEl("g", { class: "node-pop" }, g);
      svgEl("circle", { class: "halo", r: 19 }, pop);
      if (point.check !== CHECK.ALONE) svgEl("circle", { class: "check-ring", r: 16 }, pop);
      svgEl("circle", { class: "ring", r: 12 }, pop);
      svgEl("text", { class: "num" }, pop).textContent = pad(point.n);

      // The list stays for screen readers; sighted readers get the card.
      const li = document.createElement("li");
      li.textContent = `${pad(point.n)} ${point.label}. ${CHECK_LABEL[point.check]}.`;
      stepsEl.append(li);

      const show = () => showCard(point, g);
      g.addEventListener("mouseenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("click", show);
      g.addEventListener("mouseleave", hideCard);
      g.addEventListener("blur", hideCard);

      // Kept steps slide from where they stood; the rest arrive with the light.
      const was = previous?.get(point.id);
      if (was && !reduce && (was.x !== point.x || was.y !== point.y)) {
        g.animate([{ transform: at(was.x, was.y) }, { transform: at(point.x, point.y) }], { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
      const waits = !reduce && (first || fresh);
      if (waits) pop.style.opacity = "0";
      return { at: arrivals[index + 1], arrive: () => waits && rezIn(pop) };
    });

    // Light each phase as the current enters it.
    const bandStops = bands.map((band) => {
      const firstIn = points.findIndex((point) => point.x >= band.x0);
      return { at: Math.max(0, arrivals[firstIn + 1] - 0.04), arrive: () => band.g.classList.add("is-lit") };
    });

    if (changed && (added.length || removed.length)) {
      const parts = [];
      if (added.length) parts.push(`${added.length} new for your answers`);
      if (removed.length) parts.push(`${removed.length} you no longer need`);
      caption.textContent = `${parts.join(", ")}. New steps are lit.`;
    } else if (!changed) caption.textContent = "";

    const endG = svgEl("g", { class: "node node--end" }, layer);
    endG.style.transform = at(end.x, end.y);
    svgEl("circle", { class: "ring", r: 12 }, endG);
    svgEl("text", { class: "end-label", y: 30 }, endG).textContent = "An offer";
    svgEl("text", { class: "end-label end-label--soft", y: 44 }, endG).textContent = "their yes";

    const spark = svgEl("circle", { class: "spark", r: 3, cx: you.x, cy: you.y }, svg);
    if (first && !reduce) endG.style.opacity = "0";
    const showEnd = () => endG.style.opacity === "0" && endG.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" });

    cancel = runCurrent({
      path: road,
      spark,
      stops: [...stops, ...bandStops],
      duration: first ? 1500 : 700,
      delay: first ? ARRIVAL_DELAY : 0,
      instant: !first && !changed,
      onDone: showEnd,
    });
    previous = new Map(points.map((point) => [point.id, { x: point.x, y: point.y }]));
    first = false;
    holdLabelSize();
  }

  /* ---------- the hover card ---------- */

  function showCard(point, g) {
    for (const node of svg.querySelectorAll(".node.is-hot")) node.classList.remove("is-hot");
    g.classList.add("is-hot");
    card.replaceChildren(
      el("span", "step-card__n", `Step ${pad(point.n)} · ${PHASES.find((phase) => phase.id === point.phase)?.pace ?? ""}`),
      el("b", "step-card__title", point.label),
      el("p", "step-card__purpose", point.purpose),
      el("span", `step-card__check step-card__check--${point.check}`, CHECK_LABEL[point.check])
    );
    card.hidden = false;
    // Screen position from the SVG's own transform, so letterboxing and zoom never misplace it.
    const ctm = svg.getScreenCTM();
    const box = mapBox.getBoundingClientRect();
    const scale = ctm?.a ?? 1;
    const x = (ctm ? ctm.a * point.x + ctm.e : point.x) - box.left;
    const y = (ctm ? ctm.d * point.y + ctm.f : point.y) - box.top;
    const width = card.offsetWidth;
    const left = Math.max(0, Math.min(mapBox.clientWidth - width, x - width / 2));
    const above = y - card.offsetHeight - 22 * scale;
    card.style.left = `${left}px`;
    card.style.top = `${above >= 0 ? above : y + 22 * scale}px`;
  }

  function hideCard() {
    card.hidden = true;
    for (const node of svg.querySelectorAll(".node.is-hot")) node.classList.remove("is-hot");
  }

  /*
   * Labels keep their set size on screen at any width: --u is the inverse of
   * the map's scale, and the label CSS multiplies by it.
   */
  function holdLabelSize() {
    const scale = svg.getScreenCTM()?.a || 1;
    svg.style.setProperty("--u", (1 / scale).toFixed(3));
  }
  new ResizeObserver(holdLabelSize).observe(svg);

  /* ---------- the grid notices the cursor ---------- */

  function hotGrid(width) {
    const defs = svg.querySelector("defs");
    const gradient = svgEl("radialGradient", { id: "draft-hot-fade" }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "#fff", "stop-opacity": "1" }, gradient);
    svgEl("stop", { offset: "100%", "stop-color": "#fff", "stop-opacity": "0" }, gradient);
    const mask = svgEl("mask", { id: "draft-hot-mask" }, defs);
    const circle = svgEl("circle", { cx: -999, cy: -999, r: 3.5 * CELL, fill: "url(#draft-hot-fade)" }, mask);
    svgEl("rect", { class: "rez-grid rez-grid--hot", x: -2 * CELL, y: 0, width: width + 4 * CELL, height: H, fill: "url(#draft-grid-cell)", mask: "url(#draft-hot-mask)" }, svg);
    return circle;
  }

  svg.addEventListener("pointermove", (event) => {
    if (!hotCircle || event.pointerType === "touch") return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    hotCircle.setAttribute("cx", point.x);
    hotCircle.setAttribute("cy", point.y);
  });
  svg.addEventListener("pointerleave", () => hotCircle?.setAttribute("cx", -999));
  mapBox.addEventListener("pointerleave", hideCard);

  preselect();
  ["#f-stage", "#f-role", "#f-stop"].forEach((selector) => $(selector).addEventListener("change", render));
  narrow.addEventListener("change", () => {
    previous = null;
    render();
  });
  render();
}

/** The readout's second half: who checks the steps, with the rings as keys. */
function readChecks(nodes) {
  const count = (kind) => nodes.filter((node) => checkOf(node) === kind).length;
  const out = $("#r-checks");
  const key = (kind, text) => {
    const span = el("span", `key key--${kind}`, text);
    return span;
  };
  const parts = [key(CHECK.ADEN, `${count(CHECK.ADEN)} reviewed by me`), key(CHECK.OUTSIDE, `${count(CHECK.OUTSIDE)} judged outside`)];
  if (count(CHECK.ALONE)) parts.push(el("span", "key key--alone", `${count(CHECK.ALONE)} you run alone`));
  out.replaceChildren(...parts);
  out.setAttribute("aria-label", checkSummary(nodes));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
