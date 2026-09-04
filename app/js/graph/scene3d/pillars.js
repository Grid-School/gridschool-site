/**
 * One pillar per node.
 *
 * Every node is a lit disc on the floor, always, so the road ahead is legible:
 * dim for what is ahead, brighter for what you can do now, brightest and
 * green for what is done. Columns say what to do: the node to do **next**
 * carries the tall beacon; every other node you **can** do now carries a
 * short stump, so "should do" and "could do" are both visible at a glance and
 * never confused. A node **in review** keeps an amber column at a wait; one
 * sent back for **changes** is an amber stump with a dashed rim, the thing to
 * pick up. Offered depth is a hollow dashed rim (a door, not a wall); Later is
 * a dim amber dash.
 *
 * `rise` (0..1, in group.userData) scales the column so a newly unlocked
 * node can grow out of the floor. The scene animates it; this file reads it.
 *
 * Standing comes from graph/standing.js (one vocabulary for every surface);
 * this file only draws it.
 */

import { STANDING, STANDING_TONE, standingOf } from "../standing.js";
import { numberGlyph, titleGlyph, disposeGlyph } from "./glyphs.js";

export const FULL_HEIGHT = 170;
const REVIEW_HEIGHT = 110;
const STUMP_HEIGHT = 48;
const SEGMENTS = 40;

/** Disc opacity by standing. */
const DISC = { locked: 0.16, future: 0.12, offered: 0, open: 0.3, next: 0.42, lit: 0.55, review: 0.4, fix: 0.36 };
/** Rim opacity by standing. */
const RIM = { locked: 0.35, future: 0.3, offered: 0.7, open: 0.85, next: 1, lit: 1, review: 1, fix: 1 };
/** Number and title opacity by standing. */
const INK = { locked: 0.45, future: 0.35, offered: 0.7, open: 0.9, next: 1, lit: 0.95, review: 1, fix: 1 };
/** Column height by standing. */
const COLUMN = { next: FULL_HEIGHT, open: STUMP_HEIGHT, review: REVIEW_HEIGHT, fix: STUMP_HEIGHT };
const DASHED = new Set([STANDING.OFFERED, STANDING.FUTURE, STANDING.LOCKED, STANDING.FIX]);

const GLOW_SHADER = {
  vertex: `
    varying float vHeight;
    void main() {
      vHeight = uv.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragment: `
    uniform vec3 uColor;
    uniform float uStrength;
    varying float vHeight;
    void main() {
      float fade = pow(1.0 - vHeight, 1.6);
      gl_FragColor = vec4(uColor, fade * uStrength);
    }`,
};

/** Column height by standing. Only what you can act on, or are waiting on, rises. */
export function columnHeight(standing) {
  return COLUMN[standing] ?? 0;
}

export function placePillar(group, at) {
  group.position.set(at.x, 0, at.z);
}

export function createPillar(THREE, node, at, palette) {
  const group = new THREE.Group();
  placePillar(group, at);
  group.userData.nodeId = node.id;
  group.userData.rise = 1;
  const r = at.r;

  const color = new THREE.Color(palette[STANDING_TONE[standingOf(node, null)]]);

  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 1, SEGMENTS, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uStrength: { value: 0.9 } },
      vertexShader: GLOW_SHADER.vertex,
      fragmentShader: GLOW_SHADER.fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    })
  );
  glow.name = "glow";

  const rim = new THREE.Line(
    circle(THREE, r, SEGMENTS),
    new THREE.LineDashedMaterial({ color, dashSize: 6, gapSize: 5, transparent: true })
  );
  rim.computeLineDistances();
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.6;
  rim.name = "rim";

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r - 2, SEGMENTS),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.3;
  disc.name = "disc";

  // Hit volume: the whole column, so a click on the glow lands on the node.
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 6, r + 6, FULL_HEIGHT, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = FULL_HEIGHT / 2;
  hit.userData.nodeId = node.id;
  hit.name = "hit";

  const number = numberGlyph(THREE, node, palette.ink);
  number.name = "number";
  number.renderOrder = 2;
  const title = titleGlyph(THREE, node, palette.ink);
  title.name = "title";
  title.renderOrder = 2;
  // Titles sit on the floor on the near side, toward the camera (+z).
  title.position.set(0, 4, r + 30);

  group.add(glow, rim, disc, hit, number, title);
  return group;
}

/** Status-only update. Cheap; called on every state change, hover and rise frame. */
export function paintPillar(THREE, group, node, palette, { traceSet = null, nextId = null } = {}) {
  const standing = standingOf(node, nextId);
  const color = new THREE.Color(palette[STANDING_TONE[standing]]);
  // A hover trace brightens its own upstream; it never hides the rest.
  const traced = traceSet && traceSet.has(node.id);
  const lift = traced ? 1.35 : 1;
  const height = columnHeight(standing) * (group.userData.rise ?? 1);

  const glow = group.getObjectByName("glow");
  glow.visible = height > 1;
  glow.scale.y = Math.max(1, height);
  glow.position.y = height / 2;
  glow.material.uniforms.uColor.value = color;
  glow.material.uniforms.uStrength.value = standing === STANDING.NEXT ? 1 : 0.75;

  const rim = group.getObjectByName("rim");
  rim.material.color = color;
  rim.material.opacity = Math.min(1, RIM[standing] * lift);
  const dashed = DASHED.has(standing);
  rim.material.dashSize = dashed ? 6 : 1000;
  rim.material.gapSize = dashed ? 5 : 0;
  rim.material.needsUpdate = true;

  const disc = group.getObjectByName("disc");
  disc.material.color = color;
  disc.material.opacity = Math.min(1, DISC[standing] * lift);

  // The number rides inside a column at its waist; on a flat disc it hovers low.
  const number = group.getObjectByName("number");
  number.position.set(0, height > 1 ? Math.max(22, height * 0.55) : 22, 0);
  number.material.opacity = Math.min(1, INK[standing] * lift);

  const title = group.getObjectByName("title");
  title.material.opacity = Math.min(1, INK[standing] * 0.9 * lift);

  group.userData.standing = standing;
}

export function disposePillar(group) {
  group.traverse((child) => {
    if (child.isSprite) disposeGlyph(child);
    else if (child.geometry) {
      child.geometry.dispose();
      child.material?.dispose?.();
    }
  });
}

function circle(THREE, radius, segments) {
  const points = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}
