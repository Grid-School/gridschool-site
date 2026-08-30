/**
 * World-space constants. One cell is 4 units. The object sits on a cell
 * corner so a game developer reads coordinates, not decoration.
 * Three.js looks down -z, so the world lives at negative z.
 */
export const VOID = 0x010306;
export const CYAN = 0x28e1ff;
export const GRAY = 0x5a6e84;
export const DIM = 0x2a3544;
export const MAJOR = 0x3a4a5c;
export const MINOR = 0x161e28;
export const AXIS = 0x4a5c70;

export const CELL = 4;

export const G_SPACING = 1.2;
export const G_SCALE = 1.35;
export const G_LIT_R = 0.28;

/* 2×2 cells, 8-unit object. Right of the camera, on the grid. */
export const OBJECT = {
  x: 16,
  z: -32,
  w: 8,
  d: 8,
  h: 8,
};

/* Pad sits below the lowest sphere. Grid uses the same Y. */
const gTip = 2 * G_SPACING * Math.SQRT2 * G_SCALE;
export const PAD_Y = OBJECT.h / 2 - gTip - G_LIT_R * G_SCALE - 1.05;
export const BOB_AMP = 0.72;
export const BOB_MS = 12000;
export const PAD_SCALE_MIN = 0.7;
export const PAD_SCALE_MAX = 1.32;
/* Hole sized for the ring at max scale. */
export const PAD_CLEAR_R = 3.64 * PAD_SCALE_MAX + 0.2;
