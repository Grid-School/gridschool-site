/**
 * Boot the Living World hero. Vendored Three.
 * Soft hold, then neon ignite, then the 3D world.
 * The 2D mark is only for machines with no WebGL.
 */

import { createWorld } from "./world/world-scene.js";

const IGNITE_MS = 720;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function goStatic(hero) {
  hero.classList.remove("is-booting", "is-igniting");
  hero.classList.add("is-static");
}

function goLive(hero) {
  hero.classList.remove("is-booting", "is-igniting");
  hero.classList.add("is-live");
}

function arm(hero, world) {
  goLive(hero);
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) world.play();
      else world.pause();
    },
    { threshold: 0.08 },
  );
  io.observe(hero);
  world.play();
}

const hero = document.querySelector(".hero--world");
const canvas = document.getElementById("world");
if (hero && canvas && hasWebGL()) {
  try {
    const quiet = reducedMotion();
    if (!quiet) hero.classList.add("is-igniting");
    const t0 = performance.now();
    const world = createWorld({
      canvas,
      dock: { root: document.getElementById("dock") },
    });
    const wait = quiet ? 0 : Math.max(0, IGNITE_MS - (performance.now() - t0));
    window.setTimeout(() => arm(hero, world), wait);
  } catch {
    goStatic(hero);
  }
} else if (hero) {
  goStatic(hero);
}
