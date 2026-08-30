/**
 * Pins the evidence dock to the G without tracking its rotating silhouette.
 * One world-space point: G center + camera-right * reach. That signal is a
 * sine (bob) plus a slow orbit, so the projection is smooth. left/top
 * rounding and max-of-rotated-samples were the jitter.
 */

import * as THREE from "three";
import { OBJECT } from "./world-const.js";

const REACH = 4.72;
const GAP_PX = 118;
const TOP_BIAS = 14;
const MARGIN = 24;
const NARROW = 720;

export function createDockPin({ camera, root, view }) {
  const scratch = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  let boxW = 0;
  let boxH = 0;

  function project(x, y, z, vw) {
    scratch.set(x, y, z).project(camera);
    return {
      x: (scratch.x * 0.5 + 0.5) * vw.w,
      y: (-scratch.y * 0.5 + 0.5) * vw.h,
    };
  }

  function measure() {
    if (!root) return;
    boxW = root.offsetWidth;
    boxH = root.offsetHeight;
  }

  function clear() {
    if (!root) return;
    root.style.transform = "";
    root.style.left = "";
    root.style.top = "";
  }

  function apply(attachY) {
    if (!root) return;
    const vw = view();
    if (vw.w < NARROW) {
      clear();
      return;
    }

    camera.updateMatrixWorld();
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);

    const edge = project(
      OBJECT.x + camRight.x * REACH,
      attachY + camRight.y * REACH,
      OBJECT.z + camRight.z * REACH,
      vw,
    );
    const mid = project(OBJECT.x, attachY, OBJECT.z, vw);

    if (!boxW || !boxH) measure();

    const maxLeft = vw.w - boxW - MARGIN;
    const maxTop = vw.h - boxH - MARGIN;
    const left = Math.max(MARGIN, Math.min(edge.x + GAP_PX, maxLeft));
    const top = Math.max(MARGIN, Math.min(mid.y - TOP_BIAS, maxTop));

    root.style.left = "0";
    root.style.top = "0";
    root.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  return { apply, measure, clear };
}
