/**
 * three.js, loaded once, on the first board that asks for the 3D view. The
 * 2D board never pays for it. The copy is the one vendored for the landing
 * hero (`site/vendor/three`), so the app has no CDN dependency and both
 * scenes run the same revision.
 */

const THREE_URL = new URL("../../../../vendor/three/three.module.js", import.meta.url).href;

let pending = null;

export function loadThree() {
  if (!pending) {
    pending = import(THREE_URL).catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
