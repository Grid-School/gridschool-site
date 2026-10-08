/**
 * The landing hero: three answers in a sentence, and the draft map drawn from
 * them (map-draft.js) on the road (rez/road.js). Titles and the hover line
 * come from the real module library, so the draft is the platform's own steps.
 * The answers ride the Book button into apply/, which carries the draft to the desk.
 */

import { draftMap, stepTitle, FAMILIES, PHASES } from "./map-draft.js?v=1eba295-202610080607";
import { svgEl, drawGrid, calmestLanes, layoutRoad, roadPath, phaseBands, runCurrent, arrivalFractions, rezIn, prefersReducedMotion } from "./rez/road.js?v=1eba295-202610080607";

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
const HINT = "Hover a step to see what you leave it with.";

const $ = (selector) => document.querySelector(selector);
const pad = (n) => String(n).padStart(2, "0");

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
    if (value && [...select.options].some((option) => option.value === value)) select.value = value;
  }
}

function bookHref(map) {
  return `apply/?${new URLSearchParams(map.answers)}`;
}

export async function mountLandingMap() {
  const svg = $("#map-svg");
  if (!svg) return;
  const stepsEl = $("#steps");
  const caption = $("#caption");
  const library = await loadLibrary();
  let cancel = () => {};
  /** The step ids last drawn, so a change of answers can show what changed. */
  let previous = null;

  function render() {
    cancel();
    const map = draftMap(answers());
    const ids = new Set(map.nodes.map((node) => node.id));
    const added = previous ? map.nodes.filter((node) => !previous.has(node.id)).map((node) => node.id) : [];
    const removed = previous ? [...previous].filter((id) => !ids.has(id)).length : 0;
    previous = ids;
    $("#r-route").textContent = map.route;
    $("#r-count").textContent = map.nodes.length;
    document.querySelectorAll("[data-book]").forEach((link) => (link.href = bookHref(map)));

    // Interview stays on top, so the road ends climbing toward the offer;
    // the lanes between are ordered for the least up-and-down.
    const order = calmestLanes(
      FAMILIES.map((family) => family.id),
      map.nodes.map((node) => node.family),
      { top: "interview" }
    );
    const laneOf = Object.fromEntries(order.map((id, index) => [id, index]));
    const steps = map.nodes.map((node) => ({
      ...node,
      lane: laneOf[node.family],
      label: stepTitle(node, library),
      purpose: library[node.module.split("@")[0]]?.purpose ?? "",
    }));
    const points = layoutRoad(steps, { x0: FIRST_X, x1: FIRST_X, laneY, spacing: stepWidth() });
    const you = { x: YOU_X, y: points[0].y };
    const end = { x: points.at(-1).x + 3 * CELL, y: laneY(0) };
    const W = end.x + 3 * CELL;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.classList.toggle("is-narrow", narrow.matches);

    while (svg.lastChild && svg.lastChild.nodeName !== "title") svg.lastChild.remove();
    drawGrid(svg, { id: "draft-grid", cell: CELL, x: -2 * CELL, y: 0, width: W + 4 * CELL, height: H, fade: true });

    for (const band of phaseBands(points, PHASES)) {
      svgEl("rect", { class: "phase-band", x: band.x0, y: 18, width: band.x1 - band.x0, height: H - 18, rx: 8 }, svg);
      svgEl("text", { class: "phase-label", x: band.x0 + 10, y: 36 }, svg).textContent = narrow.matches ? band.short : band.label;
      svgEl("text", { class: "phase-pace", x: band.x0 + 10, y: 51 }, svg).textContent = band.pace;
    }
    FAMILIES.forEach((family) => svgEl("line", { class: "lane", x1: YOU_X - CELL, x2: end.x + CELL, y1: laneY(family.lane), y2: laneY(family.lane) }, svg));

    const all = [you, ...points, end];
    const d = roadPath(all);
    svgEl("path", { class: "road-ghost", d }, svg);
    const road = svgEl("path", { class: "road", d }, svg);
    const arrivals = arrivalFractions(all, road.getTotalLength(), svg);

    const nodes = svgEl("g", {}, svg);
    const youG = svgEl("g", { class: "node node--you", transform: `translate(${you.x} ${you.y})` }, nodes);
    svgEl("circle", { class: "ring", r: 7 }, youG);
    svgEl("text", { class: "you-label", y: -18 }, youG).textContent = "YOU";

    stepsEl.replaceChildren();
    const stops = points.map((point, index) => {
      const fresh = added.includes(point.id);
      const g = svgEl("g", { class: fresh ? "node is-new" : "node", transform: `translate(${point.x} ${point.y})`, tabindex: 0, role: "button", "aria-label": `Step ${point.n}: ${point.label}` }, nodes);
      const pop = svgEl("g", { class: "node-pop" }, g);
      svgEl("circle", { class: "halo", r: 19 }, pop);
      svgEl("circle", { class: "ring", r: 12 }, pop);
      svgEl("text", { class: "num" }, pop).textContent = pad(point.n);

      const li = document.createElement("li");
      li.innerHTML = `<span class="n">${pad(point.n)}</span><span></span><span class="fam">${point.family}</span>`;
      li.children[1].textContent = point.label;
      if (fresh) li.classList.add("is-new");
      stepsEl.append(li);

      const hot = (on) => {
        g.classList.toggle("is-hot", on);
        li.classList.toggle("is-hot", on);
        if (on) {
          caption.replaceChildren(Object.assign(document.createElement("b"), { textContent: `${point.label}. ` }), point.purpose);
        } else caption.textContent = HINT;
      };
      for (const target of [g, li]) {
        target.addEventListener("mouseenter", () => hot(true));
        target.addEventListener("mouseleave", () => hot(false));
      }
      g.addEventListener("focus", () => hot(true));
      g.addEventListener("blur", () => hot(false));

      if (!prefersReducedMotion()) pop.style.opacity = "0";
      return {
        at: arrivals[index + 1],
        arrive: () => {
          rezIn(pop);
          li.classList.add("is-in");
        },
      };
    });

    // A phone shows the first four steps and a way to see the rest.
    const more = $("#steps-more");
    const collapse = narrow.matches && steps.length > 4;
    stepsEl.classList.toggle("is-collapsed", collapse);
    more.hidden = !collapse;
    more.textContent = `All ${steps.length} steps`;
    more.onclick = () => {
      stepsEl.classList.remove("is-collapsed");
      more.hidden = true;
    };

    // Say what the answers changed, once, where the hover line lives.
    if (previous && (added.length || removed)) {
      const parts = [];
      if (added.length) parts.push(`${added.length} new for your answers`);
      if (removed) parts.push(`${removed} you no longer need`);
      caption.textContent = `${parts.join(", ")}. New steps are lit.`;
    }

    const endG = svgEl("g", { class: "node node--end", transform: `translate(${end.x} ${end.y})` }, nodes);
    svgEl("circle", { class: "ring", r: 12 }, endG);
    svgEl("text", { class: "end-label", y: 30 }, endG).textContent = "AN OFFER";
    svgEl("text", { class: "end-label", y: 43 }, endG).textContent = "THEIR YES";
    endG.style.opacity = "0";

    const spark = svgEl("circle", { class: "spark", r: 3, cx: you.x, cy: you.y }, svg);
    cancel = runCurrent({
      path: road,
      spark,
      stops,
      onDone: () => endG.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: "forwards" }) ?? (endG.style.opacity = "1"),
    });
  }

  preselect();
  ["#f-stage", "#f-role", "#f-stop"].forEach((selector) => $(selector).addEventListener("change", render));
  narrow.addEventListener("change", render);
  caption.textContent = HINT;
  render();
}
