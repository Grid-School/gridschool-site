/**
 * The 3D camera. Third person: it stands behind the board and looks forward
 * and down at PITCH degrees, so the far end of the floor is "ahead" and
 * progress is travel. It does not orbit. Arrow keys (and WASD) walk the floor,
 * drag pans it, wheel and pinch change height, Fit frames a box, Frame centres
 * a node.
 *
 * Works in floor coordinates (world x, world z); the caller converts board
 * boxes and nodes through space.js before asking.
 */

export const PITCH_DEG = 45;
const FOV = 40;
const MIN_HEIGHT = 180;
const MAX_HEIGHT = 4200;
const DRAG_THRESHOLD = 4;
/** Floor units per second at full key press, at a reference height. */
const WALK_SPEED = 900;
const KEYS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

export function createCamera3d(THREE, canvas, { onChange = () => {}, isActive = () => true } = {}) {
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 30000);
  const target = new THREE.Vector3(0, 0, 0);
  let height = 1200;
  let moved = false;
  let origin = null;
  let pinch = null;
  const held = new Set();

  const pitch = (PITCH_DEG * Math.PI) / 180;

  function apply() {
    camera.position.set(target.x, target.y + height * Math.cos(pitch), target.z + height * Math.sin(pitch));
    camera.lookAt(target);
    onChange({ height });
  }

  function resize(width, aspectHeight) {
    camera.aspect = width / Math.max(1, aspectHeight);
    camera.updateProjectionMatrix();
    apply();
  }

  /** Floor units the viewport spans at the target, per unit of height. */
  function spanPerHeight() {
    const vertical = 2 * Math.tan((FOV * Math.PI) / 360);
    return { w: vertical * camera.aspect, h: vertical };
  }

  /**
   * Frame a floor box. Depth is foreshortened by the pitch, so the far edge
   * needs less height than the width does; the near edge, being closer to the
   * lens, needs a little more. Both are estimated from the target distance.
   */
  function fit(box, { insets = {} } = {}) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
    const rect = canvas.getBoundingClientRect();
    const availW = Math.max(240, rect.width - left - right);
    const availH = Math.max(240, rect.height - top - bottom);
    const w = Math.max(1, box.maxX - box.minX);
    const d = Math.max(1, box.maxZ - box.minZ);
    const span = spanPerHeight();
    const needW = (w / span.w) * (rect.width / availW);
    const needD = ((d * Math.sin(pitch)) / span.h) * (rect.height / availH) * 1.25;
    height = clamp(Math.max(needW, needD));
    target.set((box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2);
    apply();
  }

  /**
   * Centre on a floor point, then look past it so the point sits `anchor` of
   * the way up the viewport (0 is the bottom edge) and the road ahead fills
   * the rest. The visible depth is estimated on the target plane.
   */
  function frame(point, { height: h = 520, anchor = 0.28, glide = 0 } = {}) {
    const nextHeight = clamp(h);
    const visibleDepth = (spanPerHeight().h * nextHeight) / Math.sin(pitch);
    const nextZ = point.z - (0.5 - anchor) * visibleDepth;
    if (glide > 0) {
      tween = { from: { x: target.x, z: target.z, h: height }, to: { x: point.x, z: nextZ, h: nextHeight }, t: 0, ms: glide };
      return;
    }
    tween = null;
    height = nextHeight;
    target.set(point.x, 0, nextZ);
    apply();
  }

  /** A glide in flight, or null. Stepped from tick(). */
  let tween = null;

  function stepTween(dt) {
    if (!tween) return false;
    tween.t = Math.min(1, tween.t + (dt * 1000) / tween.ms);
    const k = easeInOut(tween.t);
    target.x = tween.from.x + (tween.to.x - tween.from.x) * k;
    target.z = tween.from.z + (tween.to.z - tween.from.z) * k;
    height = tween.from.h + (tween.to.h - tween.from.h) * k;
    if (tween.t >= 1) tween = null;
    apply();
    return true;
  }

  function zoomBy(factor) {
    height = clamp(height / factor);
    apply();
  }

  /** One screen pixel is this many floor units at the target. */
  function unitsPerPixel() {
    const rect = canvas.getBoundingClientRect();
    return (spanPerHeight().h * height) / Math.max(1, rect.height);
  }

  /** Called every frame. Returns true if the camera moved (keys or a glide). */
  function tick(dt) {
    if (stepTween(dt)) return true;
    if (!held.size) return false;
    let dx = 0;
    let dz = 0;
    for (const key of held) {
      const [kx, kz] = KEYS[key];
      dx += kx;
      dz += kz;
    }
    if (!dx && !dz) return false;
    const norm = Math.hypot(dx, dz) || 1;
    const speed = WALK_SPEED * (height / 1200) * dt;
    target.x += (dx / norm) * speed;
    target.z += (dz / norm) * speed;
    apply();
    return true;
  }

  function onKeyDown(event) {
    if (!isActive() || !(event.key in KEYS) || isTyping(event)) return;
    event.preventDefault();
    tween = null;
    held.add(event.key);
  }

  function onKeyUp(event) {
    held.delete(event.key);
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    canvas.setPointerCapture?.(event.pointerId);
    origin = { x: event.clientX, y: event.clientY, tx: target.x, tz: target.z };
    tween = null;
    moved = false;
  }

  function onPointerMove(event) {
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    moved = true;
    const k = unitsPerPixel();
    target.x = origin.tx - dx * k;
    target.z = origin.tz - (dy * k) / Math.sin(pitch);
    apply();
  }

  function onPointerUp() {
    origin = null;
  }

  function onWheel(event) {
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY * 0.0015));
  }

  function onTouchStart(event) {
    if (event.touches.length === 2) pinch = { dist: touchDistance(event), height };
  }

  function onTouchMove(event) {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    height = clamp(pinch.height * (pinch.dist / touchDistance(event)));
    apply();
  }

  function onTouchEnd() {
    pinch = null;
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  const onBlur = () => held.clear();
  window.addEventListener("blur", onBlur);

  return {
    camera,
    target,
    resize,
    fit,
    frame,
    zoomBy,
    tick,
    didDrag: () => moved,
    isWalking: () => held.size > 0,
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}

function isTyping(event) {
  const el = event.target;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

function touchDistance(event) {
  const [a, b] = event.touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

const clamp = (value) => Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, value));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
