/**
 * The mark, generated from the pattern instead of pasted into every page.
 * A G drawn in a 5x5 cell grid, rotated 45 degrees so it reads as the diamond.
 * Lit cells form the letter; unlit cells hold the square so the shape stays whole.
 */

const G_PATTERN = [
  "XXXXX",
  "X....",
  "X..XX",
  "X...X",
  "XXXXX",
];

const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 4.2;
const STEP = 5;
const RADIUS = 1.2;

function cell(col, row) {
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", (col * STEP + 0.4).toFixed(1));
  rect.setAttribute("y", (row * STEP + 0.4).toFixed(1));
  rect.setAttribute("width", CELL);
  rect.setAttribute("height", CELL);
  rect.setAttribute("rx", RADIUS);
  return rect;
}

export function gmark({ className = "nav__logo" } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("aria-hidden", "true");

  const rotate = document.createElementNS(SVG_NS, "g");
  rotate.setAttribute("transform", "translate(18 18) rotate(45) translate(-12.5 -12.5)");

  const on = document.createElementNS(SVG_NS, "g");
  on.setAttribute("class", "g-on");
  const off = document.createElementNS(SVG_NS, "g");
  off.setAttribute("class", "g-off");

  G_PATTERN.forEach((row, rowIndex) => {
    [...row].forEach((mark, colIndex) => {
      (mark === "X" ? on : off).append(cell(colIndex, rowIndex));
    });
  });

  rotate.append(off, on);
  svg.append(rotate);
  return svg;
}

/** The wordmark, so header markup is identical everywhere. */
export function wordmark() {
  const span = document.createElement("span");
  span.className = "nav__name";
  span.innerHTML = "GRID<em>SCHOOL</em>";
  return span;
}
