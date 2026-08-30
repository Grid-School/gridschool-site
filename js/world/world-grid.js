import * as THREE from "three";
import { CELL, MINOR, MAJOR, OBJECT, PAD_CLEAR_R, PAD_Y } from "./world-const.js";
import { fatLines } from "./world-lines.js";

/**
 * Same Y as the pad. Segments that cross the pad disk are cut out so
 * fat grid lines cannot z-fight or paint over the rings.
 */
function outsidePieces(ax, az, bx, bz, r) {
  const r2 = r * r;
  const dx = bx - ax;
  const dz = bz - az;
  const A = dx * dx + dz * dz;
  if (A < 1e-14) {
    return ax * ax + az * az >= r2 ? [[ax, az, bx, bz]] : [];
  }
  const B = 2 * (ax * dx + az * dz);
  const C = ax * ax + az * az - r2;
  const disc = B * B - 4 * A * C;
  const ts = [0, 1];
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    const t0 = (-B - s) / (2 * A);
    const t1 = (-B + s) / (2 * A);
    if (t0 > 1e-8 && t0 < 1 - 1e-8) ts.push(t0);
    if (t1 > 1e-8 && t1 < 1 - 1e-8) ts.push(t1);
  }
  ts.sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const tA = ts[i];
    const tB = ts[i + 1];
    const mx = ax + ((tA + tB) / 2) * dx;
    const mz = az + ((tA + tB) / 2) * dz;
    if (mx * mx + mz * mz >= r2) {
      pieces.push([ax + tA * dx, az + tA * dz, ax + tB * dx, az + tB * dz]);
    }
  }
  return pieces;
}

function planeSegments(xMin, xMax, zMin, zMax, step, holeR) {
  const pos = [];
  const push = (ax, az, bx, bz) => {
    for (const [x0, z0, x1, z1] of outsidePieces(ax, az, bx, bz, holeR)) {
      pos.push(x0, 0, z0, x1, 0, z1);
    }
  };
  for (let x = xMin; x <= xMax + 1e-6; x += step) {
    push(x, zMin, x, zMax);
  }
  for (let z = zMin; z <= zMax + 1e-6; z += step) {
    push(xMin, z, xMax, z);
  }
  return pos;
}

export function createGrid() {
  const root = new THREE.Group();
  root.position.set(OBJECT.x, PAD_Y, OBJECT.z);

  const half = 120;
  const zNear = 16;
  const zFar = -half;

  root.add(
    fatLines(planeSegments(-half, half, zFar, zNear, CELL, PAD_CLEAR_R), {
      color: MINOR,
      width: 1,
      opacity: 0.055,
    }),
  );
  root.add(
    fatLines(planeSegments(-half, half, zFar, zNear, CELL * 8, PAD_CLEAR_R), {
      color: MAJOR,
      width: 1.3,
      opacity: 0.125,
    }),
  );

  return { root };
}
