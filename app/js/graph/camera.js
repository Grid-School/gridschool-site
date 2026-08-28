/**
 * The camera. Pan, zoom, pinch, keyboard, and fit-to-bounds with insets so the
 * HUD never covers the map. Cursor-anchored zoom keeps the point under the
 * pointer fixed, which is the difference between a map that feels solid and one
 * that feels like it is sliding away from you.
 */

const MIN_SCALE = 0.22;
const MAX_SCALE = 2.6;
const DRAG_THRESHOLD = 4;

const clamp = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

/**
 * `shouldPan` lets the owner veto a press the camera would otherwise claim —
 * dragging a node has to move the node, not the canvas under it.
 */
export function createCamera(svg, world, { onChange = () => {}, shouldPan = () => true } = {}) {
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let moved = false;
  let origin = null;
  let pinch = null;

  function apply() {
    world.setAttribute("transform", `translate(${tx} ${ty}) scale(${scale})`);
    onChange({ scale, tx, ty });
  }

  function glide(on) {
    world.classList.toggle("world--animating", Boolean(on));
    if (on) setTimeout(() => world.classList.remove("world--animating"), 420);
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const next = clamp(scale * factor);
    if (next === scale) return;
    tx = px - ((px - tx) * next) / scale;
    ty = py - ((py - ty) * next) / scale;
    scale = next;
    apply();
  }

  function zoomBy(factor) {
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }

  function fit(box, { animate = false, insets = {} } = {}) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
    const rect = svg.getBoundingClientRect();
    const availW = Math.max(240, rect.width - left - right);
    const availH = Math.max(240, rect.height - top - bottom);
    const w = Math.max(1, box.maxX - box.minX);
    const h = Math.max(1, box.maxY - box.minY);
    glide(animate);
    scale = clamp(Math.min(availW / w, availH / h));
    tx = left + (availW - w * scale) / 2 - box.minX * scale;
    ty = top + (availH - h * scale) / 2 - box.minY * scale;
    apply();
  }

  function centerOn(point, { animate = true, insets = {} } = {}) {
    const { top = 0, right = 0, bottom = 0, left = 0 } = insets;
    const rect = svg.getBoundingClientRect();
    glide(animate);
    tx = left + (rect.width - left - right) / 2 - point.x * scale;
    ty = top + (rect.height - top - bottom) / 2 - point.y * scale;
    apply();
  }

  /** Centre a point at a chosen zoom. Used where fitting everything is useless. */
  function frame(point, { scale: next = scale, animate = false, insets = {} } = {}) {
    scale = clamp(next);
    centerOn(point, { animate, insets });
  }

  /** Screen point to world point. The editor needs this to place dragged nodes. */
  function toWorld(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - tx) / scale,
      y: (clientY - rect.top - ty) / scale,
    };
  }

  /** World point to client point. The node room grows out of the node it is for. */
  function toScreen(point) {
    const rect = svg.getBoundingClientRect();
    return {
      x: rect.left + point.x * scale + tx,
      y: rect.top + point.y * scale + ty,
    };
  }

  /** Is a world point inside the viewport, with room to spare? */
  function isVisible(point, margin = 0) {
    const rect = svg.getBoundingClientRect();
    const at = toScreen(point);
    return (
      at.x > rect.left + margin &&
      at.x < rect.right - margin &&
      at.y > rect.top + margin &&
      at.y < rect.bottom - margin
    );
  }

  /**
   * Panning listens on the window rather than capturing the pointer. Pointer
   * capture would retarget the following click to the <svg>, which silently
   * breaks every click handler on a node.
   */
  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (event.target.closest("[data-no-pan]")) return;
    if (!shouldPan(event)) return;
    dragging = true;
    moved = false;
    origin = { x: event.clientX, y: event.clientY, tx, ty };
    svg.classList.add("is-panning");
  }

  function onPointerMove(event) {
    if (!dragging || !origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (!moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) moved = true;
    if (!moved) return;
    tx = origin.tx + dx;
    ty = origin.ty + dy;
    apply();
  }

  function onPointerUp() {
    dragging = false;
    origin = null;
    svg.classList.remove("is-panning");
  }

  /** A modal or a route change can eat the pointerup. Leave the camera idle. */
  function release() {
    dragging = false;
    origin = null;
    moved = false;
    pinch = null;
    svg.classList.remove("is-panning");
  }

  function onWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0016);
    zoomAt(event.clientX, event.clientY, factor);
  }

  function touchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  function onTouchStart(event) {
    if (event.touches.length !== 2) return;
    pinch = { distance: touchDistance(event.touches) };
  }

  function onTouchMove(event) {
    if (event.touches.length !== 2 || !pinch) return;
    event.preventDefault();
    const distance = touchDistance(event.touches);
    const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
    const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
    zoomAt(midX, midY, distance / pinch.distance);
    pinch.distance = distance;
  }

  svg.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("touchstart", onTouchStart, { passive: true });
  svg.addEventListener("touchmove", onTouchMove, { passive: false });

  function destroy() {
    svg.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    svg.removeEventListener("wheel", onWheel);
    svg.removeEventListener("touchstart", onTouchStart);
    svg.removeEventListener("touchmove", onTouchMove);
  }

  apply();

  return {
    fit,
    centerOn,
    frame,
    zoomBy,
    toWorld,
    toScreen,
    isVisible,
    destroy,
    /** True when the last pointer sequence was a pan, so clicks can be ignored. */
    release,
    didDrag: () => moved,
    get scale() {
      return scale;
    },
  };
}
