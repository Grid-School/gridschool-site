/**
 * The map. A graph from model.js, planned onto a floor by floorplan.js, drawn
 * as discs and one beacon column, with the road (sequence) as solid beams and
 * ties (other prerequisites) dashed. Status, offered, hidden and sign-off are
 * decided upstream; this file draws them and reports clicks. Spec:
 * ops/map-3d.md.
 *
 * `nodeEls` are focusable DOM proxies, one per node, carrying an aria-label,
 * `data-id`, and state classes (`is-lit`, `is-next`, …). The view wires
 * click/hover/keyboard to them, so a screen reader and the walkthrough see
 * the same board the canvas draws. Pointer hits on the canvas are raycast to
 * a node and replayed onto its proxy.
 *
 * The step-forward event: when the Next node changes because the previous one
 * lit, the new beacon rises out of the floor and the camera glides to stand
 * behind it. Reduced motion skips both animations and jumps.
 */

import { el, clear } from "../../dom.js";
import { traceSet } from "../model.js";
import { loadThree } from "./three.js";
import { readPalette } from "./palette.js";
import { createCamera3d } from "./camera3d.js";
import { createPillar, paintPillar, placePillar, disposePillar } from "./pillars.js";
import { STANDING, standingOf } from "../standing.js";
import { createEnvironment } from "./environment.js";
import { planFloor } from "./floorplan.js";

const BEAM_LIFT = 1.2;
/** Below this camera height the titles come in; above it, numbers only. */
const TITLE_HEIGHT = 1500;
/** Camera height when standing behind one node. */
const FRAME_HEIGHT = 1100;
const RISE_MS = 700;
const GLIDE_MS = 900;

export async function createScene3d(container) {
  const THREE = await loadThree();
  const palette = readPalette();

  const canvas = el("canvas.world3d", { "aria-hidden": "true" });
  const proxies = el("div.world3d__proxies", { role: "group", "aria-label": "Nodes" });
  clear(container);
  container.append(canvas, proxies);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // Depth cue only: fog starts past the target so the board itself never dims.
  scene.fog = new THREE.Fog(new THREE.Color(palette.bg), 2000, 6000);

  const beams = new THREE.Group();
  const pillars = new THREE.Group();
  scene.add(beams, pillars);
  let environment = null;

  let dirty = true;
  let frameId = 0;
  let lastTick = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const camera = createCamera3d(THREE, canvas, {
    isActive: () => !container.hidden,
    onChange: ({ height }) => {
      // The pose, readable from the DOM: the walkthrough asserts pan and zoom
      // against it, and it costs one attribute write per move.
      container.dataset.camera = `${Math.round(camera.target.x)},${Math.round(camera.target.z)},${Math.round(height)}`;
      scene.fog.near = height * 1.3;
      scene.fog.far = height * 3.4;
      // Level of detail: from high up, numbers only.
      const near = height < TITLE_HEIGHT;
      if (near !== state.showTitles) {
        state.showTitles = near;
        for (const group of state.pillarFor.values()) group.getObjectByName("title").visible = near;
      }
      dirty = true;
    },
  });

  const state = {
    THREE,
    palette,
    canvas,
    proxies,
    nodeEls: new Map(),
    pillarFor: new Map(),
    beamFor: new Map(),
    plan: null,
    graph: null,
    options: {},
    camera,
    hovered: null,
    showTitles: false,
    nextId: undefined,
    /** A column growing: { id, t } while in flight. */
    rising: null,
  };

  // A fit asked for while the host had no size (arriving under a step page)
  // is kept and replayed once the host is measurable.
  let pendingFrame = null;
  let measured = false;

  function resize() {
    const rect = container.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      measured = false;
      return;
    }
    renderer.setSize(Math.floor(rect.width), Math.floor(rect.height), false);
    camera.resize(Math.floor(rect.width), Math.floor(rect.height));
    if (!measured && pendingFrame) pendingFrame();
    measured = true;
    dirty = true;
  }

  /** Run a camera move now, or as soon as the host has a size. */
  function whenMeasured(move) {
    pendingFrame = move;
    if (measured) move();
  }

  function loop(now = 0) {
    frameId = requestAnimationFrame(loop);
    if (container.hidden) return;
    const dt = Math.min(0.05, (now - lastTick) / 1000 || 0);
    lastTick = now;
    if (camera.tick(dt)) dirty = true;
    if (stepRise(dt)) dirty = true;
    if (!reducedMotion && environment?.tick(dt * 1000)) dirty = true;
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera.camera);
  }

  function stepRise(dt) {
    if (!state.rising) return false;
    const group = state.pillarFor.get(state.rising.id);
    const node = state.graph?.byId?.get(state.rising.id);
    if (!group || !node) {
      state.rising = null;
      return false;
    }
    state.rising.t = Math.min(1, state.rising.t + (dt * 1000) / RISE_MS);
    group.userData.rise = easeOut(state.rising.t);
    paintPillar(THREE, group, node, palette, state.options);
    if (state.rising.t >= 1) state.rising = null;
    return true;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function hitNode(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera.camera);
    const hits = raycaster.intersectObjects(pillars.children.map((group) => group.getObjectByName("hit")), false);
    return hits[0]?.object.userData.nodeId ?? null;
  }

  function replay(id, type) {
    state.nodeEls.get(id)?.dispatchEvent(new Event(type, { bubbles: false }));
  }

  canvas.addEventListener("pointermove", (event) => {
    // A drag is a camera gesture; the pointer crossing a node then is noise.
    const id = camera.didDrag() && event.buttons ? state.hovered : hitNode(event);
    if (id === state.hovered) return;
    if (state.hovered) replay(state.hovered, "mouseleave");
    state.hovered = id;
    canvas.style.cursor = id ? "pointer" : "";
    if (id) replay(id, "mouseenter");
  });
  canvas.addEventListener("pointerleave", () => {
    if (state.hovered) replay(state.hovered, "mouseleave");
    state.hovered = null;
  });
  canvas.addEventListener("click", (event) => {
    if (camera.didDrag()) return;
    const id = hitNode(event);
    if (id) state.nodeEls.get(id)?.click();
  });

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  loop();

  function standBehind(id, { glide }) {
    const at = state.plan?.at.get(id);
    if (!at) return;
    whenMeasured(() => camera.frame(at, { height: FRAME_HEIGHT, glide: glide && !reducedMotion ? GLIDE_MS : 0 }));
  }

  return {
    ...state,
    scene,
    /** Full rebuild: ids or edges changed. */
    renderScene(graph, options = {}) {
      state.graph = graph;
      state.plan = planFloor(graph);
      rebuild(state, { pillars, beams, proxies }, graph);
      state.nextId = undefined;
      this.paint(graph, options);
    },
    /** Status and trace only. Detects the step-forward event. */
    paint(graph, options = {}) {
      state.graph = graph;
      state.options = options;
      const trace = options.tracingId ? traceSet(graph, options.tracingId) : null;
      // The step forward: the node that was Next is no longer open (it lit,
      // or its link went in for review) and a different node is Next now.
      const nextChanged = state.nextId !== undefined && options.nextId && options.nextId !== state.nextId;
      const previous = nextChanged ? graph.byId?.get(state.nextId) : null;
      const stepped = Boolean(previous && (previous.status === "lit" || previous.awaitingSignoff));
      state.nextId = options.nextId ?? null;

      if (stepped) {
        const group = state.pillarFor.get(options.nextId);
        if (group && !reducedMotion) {
          group.userData.rise = 0;
          state.rising = { id: options.nextId, t: 0 };
        }
        standBehind(options.nextId, { glide: true });
      }

      for (const node of graph.nodes) {
        const group = state.pillarFor.get(node.id);
        if (group) paintPillar(THREE, group, node, palette, { ...options, traceSet: trace });
        const proxy = state.nodeEls.get(node.id);
        if (proxy) markProxy(proxy, node, options.nextId);
      }
      paintBeams(state, graph, trace);
      dirty = true;
    },
    /** Stand behind a node, looking ahead. */
    frame(node, { glide = false } = {}) {
      standBehind(node.id, { glide });
    },
    /** The overview: the whole floor in one frame. */
    fit(opts) {
      if (!state.plan) return;
      whenMeasured(() => camera.fit(state.plan.box, opts));
    },
    zoomBy: (factor) => camera.zoomBy(factor),
    didDrag: () => camera.didDrag(),
    resize,
    destroy() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      camera.destroy();
      for (const group of state.pillarFor.values()) disposePillar(group);
      for (const line of state.beamFor.values()) {
        line.geometry.dispose();
        line.material.dispose();
      }
      environment?.dispose();
      renderer.dispose();
      clear(container);
    },
  };

  function rebuild(state, { pillars, beams, proxies }, graph) {
    environment?.dispose();
    if (environment) scene.remove(environment.group);
    environment = createEnvironment(THREE, palette, state.plan.box);
    scene.add(environment.group);

    for (const group of state.pillarFor.values()) {
      pillars.remove(group);
      disposePillar(group);
    }
    state.pillarFor.clear();
    state.nodeEls.clear();
    clear(proxies);

    for (const id of state.plan.order) {
      const node = graph.byId?.get(id) ?? graph.nodes.find((item) => item.id === id);
      const group = createPillar(THREE, node, state.plan.at.get(id), palette);
      group.getObjectByName("title").visible = state.showTitles;
      pillars.add(group);
      state.pillarFor.set(id, group);
      const proxy = el("button.world3d__proxy", {
        type: "button",
        "aria-label": `Node ${node.n}: ${node.title}`,
        "data-id": id,
      });
      proxies.append(proxy);
      state.nodeEls.set(id, proxy);
    }

    for (const line of state.beamFor.values()) {
      beams.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    state.beamFor.clear();
    const addBeam = (edge, dashed) => {
      const material = dashed
        ? new THREE.LineDashedMaterial({ color: new THREE.Color(palette.open), dashSize: 10, gapSize: 8, transparent: true, opacity: 0.22 })
        : new THREE.LineBasicMaterial({ color: new THREE.Color(palette.open), transparent: true, opacity: 0.5 });
      const line = new THREE.Line(new THREE.BufferGeometry(), material);
      line.userData.edge = edge;
      line.userData.dashed = dashed;
      beams.add(line);
      state.beamFor.set(`${edge.from}->${edge.to}`, line);
    };
    state.plan.sequence.forEach((edge) => addBeam(edge, false));
    state.plan.ties.forEach((edge) => addBeam(edge, true));
    layBeams(state);
  }
}

/** State classes on a proxy, so tests and assistive tech read the same board. */
function markProxy(proxy, node, nextId) {
  proxy.setAttribute("aria-label", `Node ${node.n}: ${node.title}`);
  const standing = standingOf(node, nextId);
  for (const name of Object.values(STANDING)) proxy.classList.toggle(`is-${name}`, name === standing);
  // The model's status is a separate axis from standing; both are useful.
  proxy.classList.toggle("is-open-status", node.status === "open");
  proxy.dataset.standing = standing;
}

/**
 * The road runs disc to disc as one gentle curve bowing toward the lane it is
 * heading to; ties are the same curve, dashed. Points sit just above the floor.
 */
const BEAM_SAMPLES = 24;
function layBeams(state) {
  const { THREE, plan } = state;
  for (const line of state.beamFor.values()) {
    const a = plan.at.get(line.userData.edge.from);
    const b = plan.at.get(line.userData.edge.to);
    if (!a || !b) continue;
    const points = [];
    // Leave each rim before curving; arrive on the rim of the next.
    const dz = b.z - a.z;
    const z1 = a.z + Math.sign(dz) * (a.r + 4);
    const z2 = b.z - Math.sign(dz) * (b.r + 4);
    for (let i = 0; i <= BEAM_SAMPLES; i += 1) {
      const t = i / BEAM_SAMPLES;
      const s = t * t * (3 - 2 * t);
      points.push(new THREE.Vector3(a.x + (b.x - a.x) * s, BEAM_LIFT, z1 + (z2 - z1) * t));
    }
    line.geometry.setFromPoints(points);
    if (line.userData.dashed) line.computeLineDistances();
  }
}

/**
 * The road reads as three stretches. Behind you it is green and settled;
 * the stretch you are walking (into any node you can act on) is bright cyan;
 * beyond that it fades, so the eye lands where the work is. Ties stay faint
 * until a hover traces them.
 */
function paintBeams(state, graph, trace) {
  const { THREE, palette } = state;
  for (const line of state.beamFor.values()) {
    const { from, to } = line.userData.edge;
    const a = graph.byId?.get(from);
    const b = graph.byId?.get(to);
    const settled = (node) => node?.status === "lit" || node?.awaitingSignoff;
    const done = settled(a) && settled(b);
    const live = !done && (b?.status === "open" || b?.status === "lit");
    const inTrace = trace && trace.has(from) && trace.has(to);
    line.material.color = new THREE.Color(done ? palette.lit : palette.open);
    const base = line.userData.dashed ? 0.14 : done ? 0.7 : live ? 0.6 : 0.22;
    line.material.opacity = inTrace ? Math.min(1, base * 1.8) : base;
  }
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
