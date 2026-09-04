/**
 * The world around the board. A grid floor, and abstract structures kept to
 * the flanks and the far end so the runway itself stays clear: wireframe
 * solids drifting at pillar height, and tall thin monoliths further out.
 * Nothing here means anything; it gives the floor a horizon and a sense of
 * travel as the camera moves forward.
 *
 * Deterministic. Placement comes from a small seeded generator, so the same
 * board gets the same world every time and screenshots can be compared.
 */

const GRID_CELL = 64;
const GRID_SPAN = 16000;
const FLANK = 520;
const SOLIDS = 18;
const MONOLITHS = 10;

export function createEnvironment(THREE, palette, worldBox) {
  const group = new THREE.Group();
  const line = new THREE.Color(palette.line);
  const cyan = new THREE.Color(palette.open);

  const grid = new THREE.GridHelper(GRID_SPAN, GRID_SPAN / GRID_CELL, new THREE.Color(palette.grid), new THREE.Color(palette.grid));
  grid.material.transparent = true;
  grid.material.opacity = 0.9;
  group.add(grid);

  const rand = seeded(0x6a7c);
  const spanZ = worldBox.maxZ - worldBox.minZ;
  const flankX = [worldBox.minX - FLANK, worldBox.maxX + FLANK];

  for (let i = 0; i < SOLIDS; i += 1) {
    const side = flankX[i % 2] + (rand() - 0.5) * 380 * (i % 2 ? 1 : -1);
    const z = worldBox.maxZ + 200 - rand() * (spanZ + 1400);
    const size = 26 + rand() * 54;
    const geometry = i % 3 === 0 ? new THREE.OctahedronGeometry(size) : new THREE.IcosahedronGeometry(size, 0);
    const mesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.16 + rand() * 0.14 })
    );
    mesh.position.set(side, 70 + rand() * 170, z);
    mesh.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    mesh.userData.spin = (rand() - 0.5) * 0.0004;
    geometry.dispose();
    group.add(mesh);
  }

  for (let i = 0; i < MONOLITHS; i += 1) {
    const side = flankX[i % 2] + (rand() * 600 + 300) * (i % 2 ? 1 : -1);
    const z = worldBox.maxZ - rand() * (spanZ + 2400);
    const height = 220 + rand() * 520;
    const width = 18 + rand() * 30;
    const mesh = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, width)),
      new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: 0.55 })
    );
    mesh.position.set(side, height / 2, z);
    group.add(mesh);
  }

  return {
    group,
    /** A slow drift on the solids; the caller decides whether motion is allowed. */
    tick(dt) {
      let moved = false;
      for (const child of group.children) {
        if (!child.userData.spin) continue;
        child.rotation.y += child.userData.spin * dt;
        moved = true;
      }
      return moved;
    },
    dispose() {
      for (const child of group.children) {
        child.geometry?.dispose();
        child.material?.dispose();
      }
    },
  };
}

/** Park–Miller LCG. Enough for scattering shapes; not for anything else. */
function seeded(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
