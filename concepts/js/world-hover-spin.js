import * as THREE from "three";

const SPIN_MS = 1400;

/**
 * Hover-enter on the G: one smooth 360°. Next enter flips direction.
 * Mid-spin hover is ignored. Leave and re-enter to go again.
 */
export function createHoverSpin({ camera, canvas, hit, reduced, ease }) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let over = false;
  let spinning = false;
  let dir = 1;
  let startT = 0;
  let clock = 0;

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const now = raycaster.intersectObject(hit, false).length > 0;
    canvas.style.cursor = now ? "pointer" : "";
    if (now && !over && !spinning && !reduced) {
      spinning = true;
      startT = clock;
    }
    over = now;
  }

  function offset(t) {
    clock = t;
    if (!spinning) return 0;
    const u = Math.min(1, (t - startT) / SPIN_MS);
    if (u >= 1) {
      spinning = false;
      dir *= -1;
      return 0;
    }
    return dir * ease(u) * Math.PI * 2;
  }

  canvas.addEventListener("pointermove", onMove);
  return {
    offset,
    dispose() {
      canvas.removeEventListener("pointermove", onMove);
      canvas.style.cursor = "";
    },
  };
}
