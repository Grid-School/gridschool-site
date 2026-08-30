import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const lineMaterials = [];

/**
 * Screen-space fat lines. Hairlines crawl against the pixel lattice as the
 * camera holds; ~1.5px analytic width keeps that variation small.
 */
export function fatLines(positions, { color, width = 1.5, opacity = 1 }) {
  const geo = new LineSegmentsGeometry().setPositions(positions);
  const mat = new LineMaterial({
    color,
    linewidth: width,
    worldUnits: false,
    transparent: true,
    opacity,
    fog: true,
  });
  lineMaterials.push(mat);
  return new LineSegments2(geo, mat);
}

/** Closed polyline on the XZ plane, y = 0 in local space. */
export function circleLine(radius, opts, segments = 64) {
  const pos = [];
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pos.push(
      Math.cos(a0) * radius, 0, Math.sin(a0) * radius,
      Math.cos(a1) * radius, 0, Math.sin(a1) * radius,
    );
  }
  return fatLines(pos, opts);
}

export function edgesOf(geometry, opts) {
  return fatLines(
    Array.from(new THREE.EdgesGeometry(geometry).attributes.position.array),
    opts,
  );
}

export function setLineResolution(w, h) {
  for (const m of lineMaterials) m.resolution.set(w, h);
}
