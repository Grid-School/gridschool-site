/**
 * The hero floor: an infinite grid seen from a low camera, walking forward
 * forever, with a faint current at the horizon. This is the brand's one
 * atmosphere on the landing: the same floor the map stands on, empty, before
 * anything on it has lit. Plain 2D canvas, no library, no interaction.
 *
 * Reduced motion: the floor is drawn once and stands still.
 */

const CELL = 1;            // world units between lines
const LINES_X = 14;        // vertical lines each side of centre
const DEPTH = 26;          // how many cells forward we draw
const SPEED = 0.42;        // cells per second the camera walks
const CAM_H = 1.15;        // camera height above the floor, in cells
const FOCAL = 1.05;        // perspective strength (fraction of canvas height)

const canvas = document.querySelector(".hero__grid");
if (canvas) boot(canvas);

function boot(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, dpr = 1, horizon = 0;
  let cyan = "40, 225, 255";

  const readTone = () => {
    const raw = getComputedStyle(document.body).getPropertyValue("--grid-rgb").trim();
    if (raw) cyan = raw;
  };

  const fit = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    horizon = h * 0.3;
  };

  // Project a floor point (x cells right of centre, z cells ahead) to the canvas.
  const project = (x, z) => {
    const f = h * FOCAL;
    const sy = horizon + (f * CAM_H) / z;
    const sx = w / 2 + (f * x) / z;
    return [sx, sy];
  };

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);

    // Horizon current: a thin band of light the floor runs toward.
    const glow = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, w * 0.55);
    glow.addColorStop(0, `rgba(${cyan}, 0.22)`);
    glow.addColorStop(0.35, `rgba(${cyan}, 0.06)`);
    glow.addColorStop(1, `rgba(${cyan}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    const near = 0.9;                       // closest z we draw
    const far = near + DEPTH;
    const offset = (t * SPEED) % CELL;      // the walk: lines slide toward us

    // Horizontal lines, spaced one cell apart in z, fading with distance.
    for (let i = 0; i <= DEPTH; i += 1) {
      const z = near + i * CELL - offset + CELL;
      if (z <= near) continue;
      const [, y] = project(0, z);
      const depthFade = 1 - (z - near) / (far - near);
      const a = 0.04 + 0.34 * depthFade * depthFade;
      ctx.strokeStyle = `rgba(${cyan}, ${a})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical lines converge on the vanishing point; the centre ones read
    // strongest, the outer ones dissolve.
    for (let i = -LINES_X; i <= LINES_X; i += 1) {
      const x = i * CELL;
      const [x0, y0] = project(x, near);
      const [x1, y1] = project(x, far);
      const sideFade = 1 - Math.abs(i) / (LINES_X + 1);
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, `rgba(${cyan}, ${0.38 * sideFade})`);
      grad.addColorStop(1, `rgba(${cyan}, 0)`);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // The floor dissolves into the page toward the bottom so type sits on
    // quiet ground, and into the void above the horizon.
    const bottom = ctx.createLinearGradient(0, h * 0.62, 0, h);
    bottom.addColorStop(0, "rgba(1, 3, 6, 0)");
    bottom.addColorStop(0.85, "rgba(1, 3, 6, 0.94)");
    bottom.addColorStop(1, "rgba(1, 3, 6, 1)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, w, h);
    const top = ctx.createLinearGradient(0, 0, 0, horizon);
    top.addColorStop(0, "rgba(1, 3, 6, 0.9)");
    top.addColorStop(1, "rgba(1, 3, 6, 0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, horizon);
  };

  let start = null;
  let raf = 0;
  const frame = (now) => {
    if (start === null) start = now;
    draw((now - start) / 1000);
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!still && !raf) {
      raf = requestAnimationFrame(frame);
    }
  };

  readTone();
  fit();
  addEventListener("resize", () => { fit(); if (still) draw(0); });
  if (still) {
    draw(0);
  } else {
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", onVisibility);
  }
  canvas.classList.add("is-live");
}
