/**
 * The Living World. The GridSchool G occupies a cell in world space.
 * It rotates. The grid is the coordinate floor, on the pad's plane.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  BOB_AMP,
  BOB_MS,
  OBJECT,
  PAD_SCALE_MAX,
  PAD_SCALE_MIN,
  VOID,
} from "./world-const.js";
import { setLineResolution } from "./world-lines.js";
import { createGrid } from "./world-grid.js";
import { createHero } from "./world-artifact.js";
import { createHoverSpin } from "./world-hover-spin.js";

export function createWorld({ canvas, dock }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  scene.fog = new THREE.Fog(VOID, 55, 175);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  const grid = createGrid();
  scene.add(grid.root);

  const hero = createHero();
  scene.add(hero.root);

  const msaaTarget = new THREE.WebGLRenderTarget(1, 1, {
    samples: 8,
    type: THREE.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, msaaTarget);
  composer.addPass(new RenderPass(scene, camera));
  /* glow on the G, not a flood on the whole scene */
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.36, 0.32, 0.38));
  composer.addPass(new OutputPass());

  /* Orbit the camera around the G's vertical axis. Camera position and
     look-at rotate together, so the G stays on the same pixel of the
     frame while the world turns around it. */
  const ORBIT_MS = 56000;
  const gCenter = new THREE.Vector3(OBJECT.x, OBJECT.h / 2, OBJECT.z);
  const posRel = new THREE.Vector3();
  const lookRel = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  function rotateYAroundG(out, rel, theta) {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    out.set(
      gCenter.x + rel.x * c + rel.z * s,
      gCenter.y + rel.y,
      gCenter.z - rel.x * s + rel.z * c,
    );
  }

  function frame() {
    const narrow = innerWidth < 720;
    camera.fov = narrow ? 58 : 40;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();

    if (narrow) {
      posRel.set(12 - gCenter.x, 15.2 - gCenter.y, -8 - gCenter.z);
      lookRel.set(OBJECT.x - gCenter.x, 0.6 - gCenter.y, OBJECT.z - gCenter.z);
    } else {
      /* G a little left of prior rest, and the whole scene dropped
         ~50px so the lower viewport is not empty air. */
      posRel.set(1 - gCenter.x, 11.5 - gCenter.y, 9 - gCenter.z);
      lookRel.set(11.5 - gCenter.x, 3.75 - gCenter.y, -28 - gCenter.z);
    }
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }

  const hoverSpin = createHoverSpin({
    camera,
    canvas,
    hit: hero.hit,
    reduced,
    ease: easeInOut,
  });

  /* 0 = hero angle (G faces camera). 1 = turned away. Holds on 0. */
  function turnAway(ms) {
    const p = (ms % 22000) / 22000;
    if (p < 0.3) return 0;
    if (p < 0.5) return easeInOut((p - 0.3) / 0.2);
    if (p < 0.58) return 1;
    if (p < 0.84) return 1 - easeInOut((p - 0.58) / 0.26);
    return 0;
  }

  /* +1 high, -1 low. Radius is inverse: low → large. */
  function bobWave(ms) {
    if (reduced) return 0;
    return Math.sin((ms / BOB_MS) * Math.PI * 2);
  }

  function applyBob(ms) {
    const wave = bobWave(ms);
    hero.gMark.position.y = OBJECT.h / 2 + BOB_AMP * wave;
    const u = (wave + 1) / 2;
    const s = PAD_SCALE_MAX + (PAD_SCALE_MIN - PAD_SCALE_MAX) * u;
    hero.pad.scale.set(s, 1, s);
    return wave;
  }

  function placeCamera(t) {
    const theta = reduced ? 0 : (t / ORBIT_MS) * Math.PI * 2;
    rotateYAroundG(camera.position, posRel, theta);
    rotateYAroundG(lookAt, lookRel, theta);
    camera.lookAt(lookAt);
  }

  const pin = new THREE.Vector3();
  /* Diamond half-diagonal after 45° and scale 1.35, plus sphere radius. */
  const G_REACH = 4.72;

  function screenRightOfG(y) {
    const ry = hero.gMark.rotation.y;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    let maxX = -Infinity;
    for (const [lx, ly] of [
      [G_REACH, y],
      [G_REACH * 0.82, y + 1.15],
      [G_REACH * 0.82, y - 1.15],
    ]) {
      maxX = Math.max(
        maxX,
        project(pin, OBJECT.x + lx * c, ly, OBJECT.z - lx * s).x,
      );
    }
    return maxX;
  }

  function project(out, x, y, z) {
    out.set(x, y, z).project(camera);
    return {
      x: (out.x * 0.5 + 0.5) * innerWidth,
      y: (-out.y * 0.5 + 0.5) * innerHeight,
    };
  }

  function pinDock() {
    if (!dock?.root) return;
    if (innerWidth < 720) {
      dock.root.style.left = "";
      dock.root.style.top = "";
      return;
    }

    /* Title on the G's center / lower third. Gap is from the diamond's
       actual screen-right tip, which yaws with the mark. */
    const midY = OBJECT.h / 2 + BOB_AMP * bobWave(lastT);
    const attachY = midY - 0.4;
    const attach = project(pin, OBJECT.x, attachY, OBJECT.z);
    const gRight = screenRightOfG(attachY);

    const w = dock.root.offsetWidth;
    const h = dock.root.offsetHeight;
    const gap = 118;

    let left = Math.round(gRight + gap);
    const maxLeft = innerWidth - w - 24;
    if (left > maxLeft) left = Math.round(gRight + Math.max(32, maxLeft - gRight));
    left = Math.max(24, Math.min(left, maxLeft));

    let top = Math.round(attach.y - 14);
    top = Math.max(24, Math.min(top, innerHeight - h - 24));

    dock.root.style.left = `${left}px`;
    dock.root.style.top = `${top}px`;
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    setLineResolution(innerWidth, innerHeight);
    frame();
    placeCamera(reduced ? 0 : lastT);
    const face0 = Math.atan2(
      camera.position.x - gCenter.x,
      camera.position.z - gCenter.z,
    );
    hero.gMark.rotation.y =
      (reduced ? face0 : face0 + 0.7 * turnAway(lastT)) + hoverSpin.offset(lastT);
    applyBob(reduced ? 0 : lastT);
    pinDock();
    if (reduced) composer.render();
  }

  let raf = 0;
  let lastT = 0;
  function loop(t) {
    lastT = t;
    placeCamera(t);
    /* Face the camera at rest (readable G). Ease away, return, hold. */
    const face = Math.atan2(
      camera.position.x - gCenter.x,
      camera.position.z - gCenter.z,
    );
    hero.gMark.rotation.y =
      (reduced ? face : face + 0.7 * turnAway(t)) + hoverSpin.offset(t);
    applyBob(t);
    pinDock();
    composer.render();
    raf = requestAnimationFrame(loop);
  }

  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(() => pinDock());
  if (reduced) {
    composer.render();
  } else {
    raf = requestAnimationFrame(loop);
  }

  return {
    dispose() {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      hoverSpin.dispose();
      renderer.dispose();
    },
  };
}
