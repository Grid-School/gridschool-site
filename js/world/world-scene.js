/**
 * The Living World hero. Sizes from the canvas, not the window, so the
 * scene can live in a 100vh section while the rest of the page scrolls.
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

  function view() {
    return {
      w: Math.max(1, canvas.clientWidth),
      h: Math.max(1, canvas.clientHeight),
    };
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    alpha: false,
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
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.36, 0.32, 0.38));
  composer.addPass(new OutputPass());

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
    const { w, h } = view();
    const narrow = w < 720;
    camera.fov = narrow ? 58 : 40;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    if (narrow) {
      posRel.set(12 - gCenter.x, 15.2 - gCenter.y, -8 - gCenter.z);
      lookRel.set(OBJECT.x - gCenter.x, 0.6 - gCenter.y, OBJECT.z - gCenter.z);
    } else {
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

  function turnAway(ms) {
    const p = (ms % 22000) / 22000;
    if (p < 0.3) return 0;
    if (p < 0.5) return easeInOut((p - 0.3) / 0.2);
    if (p < 0.58) return 1;
    if (p < 0.84) return 1 - easeInOut((p - 0.58) / 0.26);
    return 0;
  }

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
  const G_REACH = 4.72;

  function screenRightOfG(y, vw) {
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
        project(pin, OBJECT.x + lx * c, ly, OBJECT.z - lx * s, vw).x,
      );
    }
    return maxX;
  }

  function project(out, x, y, z, vw) {
    out.set(x, y, z).project(camera);
    return {
      x: (out.x * 0.5 + 0.5) * vw.w,
      y: (-out.y * 0.5 + 0.5) * vw.h,
    };
  }

  function pinDock() {
    if (!dock?.root) return;
    const vw = view();
    if (vw.w < 720) {
      dock.root.style.left = "";
      dock.root.style.top = "";
      return;
    }

    const midY = OBJECT.h / 2 + BOB_AMP * bobWave(lastT);
    const attachY = midY - 0.4;
    const attach = project(pin, OBJECT.x, attachY, OBJECT.z, vw);
    const gRight = screenRightOfG(attachY, vw);

    const w = dock.root.offsetWidth;
    const h = dock.root.offsetHeight;
    const gap = 118;

    let left = Math.round(gRight + gap);
    const maxLeft = vw.w - w - 24;
    if (left > maxLeft) left = Math.round(gRight + Math.max(32, maxLeft - gRight));
    left = Math.max(24, Math.min(left, maxLeft));

    let top = Math.round(attach.y - 14);
    top = Math.max(24, Math.min(top, vw.h - h - 24));

    dock.root.style.left = `${left}px`;
    dock.root.style.top = `${top}px`;
  }

  function pose(t) {
    placeCamera(t);
    const face = Math.atan2(
      camera.position.x - gCenter.x,
      camera.position.z - gCenter.z,
    );
    hero.gMark.rotation.y =
      (reduced ? face : face + 0.7 * turnAway(t)) + hoverSpin.offset(t);
    applyBob(reduced ? 0 : t);
    pinDock();
  }

  function resize() {
    const { w, h } = view();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    setLineResolution(w, h);
    frame();
    pose(reduced ? 0 : lastT);
    if (reduced || !playing) composer.render();
  }

  let raf = 0;
  let lastT = 0;
  let playing = false;

  function loop(t) {
    lastT = t;
    pose(t);
    composer.render();
    if (playing) raf = requestAnimationFrame(loop);
  }

  function play() {
    if (reduced || playing) return;
    playing = true;
    raf = requestAnimationFrame(loop);
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
  }

  addEventListener("resize", resize);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  requestAnimationFrame(() => pinDock());
  if (reduced) {
    composer.render();
  } else {
    play();
  }

  return {
    play,
    pause,
    dispose() {
      pause();
      ro.disconnect();
      removeEventListener("resize", resize);
      hoverSpin.dispose();
      renderer.dispose();
    },
  };
}
