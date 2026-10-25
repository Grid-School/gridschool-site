/**
 * The share card: a 1200x630 picture of someone's scan, drawn on a canvas in
 * the page's own tokens. It carries the #1 likely blocker's title, the shape of
 * their map (lit findings, dashed locked areas, on the same grid floor) and
 * gridschool.org/check. Never a name, an email or anything from a resume.
 */

import { calmestLanes } from "../js/rez/road.js?v=391fdce-202610250551";

const W = 1200;
const H = 630;
const PAD = 72;
// The same lanes as the live map (check-map.js), top to bottom.
const LANES = ["interview", "pipeline", "proof", "network", "presence"];

function tokens() {
  const css = getComputedStyle(document.documentElement);
  const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: read("--bg", "#02050a"),
    void: read("--void", "#010205"),
    line: read("--line", "#101c2c"),
    text: read("--text", "#d9e4ef"),
    soft: read("--soft", "#a9b8c8"),
    muted: read("--muted", "#7b8ca0"),
    ghost: read("--ghost", "#44566b"),
    cyan: read("--cyan", "#2be4ff"),
    cyanRgb: read("--cyan-rgb", "43, 228, 255"),
    lumen: read("--lumen", "#effdff"),
    sans: read("--font-sans", "system-ui, sans-serif"),
    mono: read("--font-mono", "ui-monospace, monospace"),
  };
}

function wrap(ctx, text, width, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width <= width || !line) line = tryLine;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, "")}…`;
  }
  return lines;
}

/**
 * Draws the card. `nodes` is diagnosisMap's list (findings first, then locked areas);
 * `title` is the #1 finding's title. Returns the canvas.
 */
export async function drawShareCard({ title, nodes, label }) {
  const t = tokens();
  try {
    await document.fonts?.ready;
  } catch {
    /* system fonts are fine */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // The void, the floor grid fading toward the top, the one light source.
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) {
    ctx.strokeStyle = `rgba(${t.cyanRgb}, .045)`;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 300);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 300; y <= H; y += 30) {
    ctx.strokeStyle = `rgba(${t.cyanRgb}, ${0.02 + ((y - 300) / (H - 300)) * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  const fade = ctx.createLinearGradient(0, 300, 0, 400);
  fade.addColorStop(0, t.bg);
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 299, W, 101);
  const glow = ctx.createRadialGradient(W * 0.7, H * 0.7, 0, W * 0.7, H * 0.7, W * 0.55);
  glow.addColorStop(0, `rgba(${t.cyanRgb}, .09)`);
  glow.addColorStop(1, `rgba(${t.cyanRgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Header: the wordmark, and what this is.
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 22px ${t.mono}`;
  ctx.fillStyle = t.text;
  ctx.fillText("GRID", PAD, PAD + 8);
  const grid = ctx.measureText("GRID").width;
  ctx.fillStyle = t.cyan;
  ctx.fillText("SCHOOL", PAD + grid, PAD + 8);
  ctx.font = `500 18px ${t.mono}`;
  ctx.fillStyle = t.muted;
  ctx.textAlign = "right";
  ctx.fillText(label.toUpperCase(), W - PAD, PAD + 8);
  ctx.textAlign = "left";

  // The #1 likely blocker.
  ctx.font = `500 19px ${t.mono}`;
  ctx.fillStyle = t.cyan;
  ctx.fillText("LIKELY BLOCKER #1", PAD, 172);
  ctx.font = `500 52px ${t.sans}`;
  ctx.fillStyle = t.lumen;
  const lines = wrap(ctx, title, W - PAD * 2, 2);
  lines.forEach((line, n) => ctx.fillText(line, PAD, 236 + n * 62));

  // The map's shape: You, then each node on its lane, joined by one curve per edge.
  // Lanes in the live map's order (calmestLanes, Interview on top), ending at the offer.
  const shown = nodes.slice(0, 9);
  const order = calmestLanes(LANES, shown.map((node) => node.family), { top: "interview" });
  const top = 392;
  const laneGap = 32;
  const laneY = (family) => top + Math.max(0, order.indexOf(family)) * laneGap;
  const x0 = PAD + 20;
  const span = W - PAD * 2 - 40;
  const step = span / (shown.length + 1);
  const points = [{ x: x0, y: shown.length ? laneY(shown[0].family) : top, kind: "you" }];
  shown.forEach((node, n) => points.push({ x: x0 + (n + 1) * step, y: laneY(node.family), kind: node.state, n: n + 1 }));
  points.push({ x: x0 + span, y: top, kind: "locked", end: true });
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 1;
  order.forEach((family) => {
    ctx.beginPath();
    ctx.moveTo(x0 - 24, laneY(family) + 0.5);
    ctx.lineTo(x0 + span + 24, laneY(family) + 0.5);
    ctx.stroke();
  });
  for (let n = 1; n < points.length; n += 1) {
    const a = points[n - 1];
    const b = points[n];
    const mid = (a.x + b.x) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(mid, a.y, mid, b.y, b.x, b.y);
    const lit = b.kind !== "locked";
    ctx.strokeStyle = lit ? `rgba(${t.cyanRgb}, .75)` : t.ghost;
    ctx.lineWidth = lit ? 2 : 1.5;
    ctx.setLineDash(lit ? [] : [3, 7]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const p of points) {
    if (p.kind === "you") {
      ctx.fillStyle = t.lumen;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `500 15px ${t.mono}`;
      ctx.fillStyle = t.soft;
      ctx.textAlign = "center";
      ctx.fillText("YOU", p.x, p.y - 18);
      ctx.textAlign = "left";
      continue;
    }
    const locked = p.kind === "locked";
    const r = p.kind === "next" ? 17 : 14;
    if (p.kind === "next") {
      ctx.shadowColor = `rgba(${t.cyanRgb}, .55)`;
      ctx.shadowBlur = 26;
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = t.void; // solid: the road ends at the ring, never shows through it
    ctx.fill();
    ctx.shadowBlur = 0;
    if (p.kind === "next") {
      ctx.fillStyle = `rgba(${t.cyanRgb}, .2)`;
      ctx.fill();
    }
    ctx.setLineDash(locked ? [3, 3] : []);
    ctx.strokeStyle = locked ? t.ghost : t.cyan;
    ctx.lineWidth = p.kind === "next" ? 2 : 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    if (!locked) {
      ctx.font = `500 14px ${t.mono}`;
      ctx.fillStyle = p.kind === "next" ? t.lumen : t.soft;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.n), p.x, p.y + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  // Where to take your own.
  ctx.font = `500 24px ${t.mono}`;
  ctx.fillStyle = t.cyan;
  ctx.textAlign = "right";
  ctx.fillText("gridschool.org/check", W - PAD, H - 44);
  ctx.textAlign = "left";
  ctx.strokeStyle = `rgba(${t.cyanRgb}, .22)`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
  return canvas;
}

export const cardBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
