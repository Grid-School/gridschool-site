/**
 * Colours come from the stylesheet, read once at mount, so the 3D board and
 * the SVG board cannot drift apart: change a token in app.css and both move.
 */

const TOKENS = {
  lit: "--ok",
  open: "--cyan",
  amber: "--amber",
  locked: "--locked",
  line: "--line",
  grid: "--grid",
  ink: "--ink",
  bg: "--bg",
};

const FALLBACK = {
  lit: "#3ddc84",
  open: "#28e1ff",
  amber: "#ffb32b",
  locked: "#3a4d6b",
  line: "#16233d",
  grid: "#0c1526",
  ink: "#e8ecf4",
  bg: "#05070c",
};

export function readPalette(element = document.documentElement) {
  const style = getComputedStyle(element);
  const out = {};
  for (const [key, token] of Object.entries(TOKENS)) {
    const value = style.getPropertyValue(token).trim();
    out[key] = value || FALLBACK[key];
  }
  return out;
}
