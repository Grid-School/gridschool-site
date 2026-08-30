import * as THREE from "three";
import { CYAN, GRAY, G_LIT_R, G_SCALE, G_SPACING, OBJECT, PAD_Y } from "./world-const.js";

const G_PATTERN = [
  "XXXXX",
  "X....",
  "X..XX",
  "X...X",
  "XXXXX",
];

/**
 * The GridSchool G as a luminous constellation. No bounding cube.
 */
function gMarkSpheres({ spacing = G_SPACING, litRadius = G_LIT_R, dimRadius = 0.15 }) {
  const group = new THREE.Group();
  const plane = new THREE.Group();
  plane.rotation.z = Math.PI / 4;
  group.add(plane);

  const litGeo = new THREE.SphereGeometry(litRadius, 14, 14);
  const dimGeo = new THREE.SphereGeometry(dimRadius, 10, 10);
  const litMat = new THREE.MeshBasicMaterial({ color: CYAN });
  const dimMat = new THREE.MeshBasicMaterial({ color: GRAY });

  G_PATTERN.forEach((row, r) => {
    [...row].forEach((cell, col) => {
      const lit = cell === "X";
      const mesh = new THREE.Mesh(lit ? litGeo : dimGeo, lit ? litMat : dimMat);
      mesh.position.set((col - 2) * spacing, (2 - r) * spacing, 0);
      plane.add(mesh);
    });
  });

  return group;
}

function ringMesh(inner, outer, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 64),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function padUnderG() {
  const pad = new THREE.Group();
  pad.position.y = PAD_Y;
  pad.renderOrder = 1;
  pad.add(ringMesh(3.50, 3.64, 0.11));
  return pad;
}

export function createHero() {
  const root = new THREE.Group();
  root.position.set(OBJECT.x, 0, OBJECT.z);

  const gMark = gMarkSpheres({});
  gMark.position.y = OBJECT.h / 2;
  gMark.scale.setScalar(G_SCALE);
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(4.1, 16, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  gMark.add(hit);
  root.add(gMark);
  const pad = padUnderG();
  root.add(pad);

  return { root, gMark, pad, hit };
}
