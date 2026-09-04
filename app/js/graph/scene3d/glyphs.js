/**
 * Text in the 3D scene: the number on a cap, the title on the floor. Each is
 * a sprite with a canvas texture, so it always faces the camera and reads at
 * any pitch. Fonts are the brand's, restated because a canvas cannot read CSS.
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";

export function makeGlyph(THREE, text, { font = MONO, size = 28, color = "#e8ecf4", weight = 500, width = 256, height = 64, screenHeight = 0.04 } = {}) {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  // Screen-constant: a label reads the same at any camera height, like the
  // SVG board's counter-scaled text. Scale is then a fraction of the viewport.
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((width / height) * screenHeight, screenHeight, 1);
  sprite.userData.glyph = { text, color };
  return sprite;
}

export function numberGlyph(THREE, node, color) {
  return makeGlyph(THREE, String(node.n).padStart(2, "0"), { size: 30, color, width: 96, height: 48, screenHeight: 0.026 });
}

const TITLE_CHARS = 30;

export function titleGlyph(THREE, node, color) {
  const text = node.title.length > TITLE_CHARS ? `${node.title.slice(0, TITLE_CHARS - 1).trimEnd()}…` : node.title;
  return makeGlyph(THREE, text, { font: SANS, size: 22, weight: 400, color, width: 360, height: 40, screenHeight: 0.02 });
}

export function disposeGlyph(sprite) {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}
