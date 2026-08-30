/**
 * Boot the Living World hero. Vendored Three. Falls back to a static
 * mark if WebGL is missing. Pauses the loop when the hero is offscreen.
 */

import { createWorld } from "./world/world-scene.js";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const hero = document.querySelector(".hero--world");
const canvas = document.getElementById("world");
if (hero && canvas && hasWebGL()) {
  hero.classList.add("is-live");
  const world = createWorld({
    canvas,
    dock: { root: document.getElementById("dock") },
  });
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) world.play();
      else world.pause();
    },
    { threshold: 0.08 },
  );
  io.observe(hero);
} else if (hero) {
  hero.classList.add("is-static");
}
