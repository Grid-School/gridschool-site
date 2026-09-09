/**
 * View transitions, the two the shell needs: a view fading in over the map
 * after the camera has arrived, and a view fading out before the map returns.
 * CSS owns the motion (`.is-entering`, `.is-leaving` in app.css); this file
 * owns the timing and the reduced-motion short-circuit, so no view has to.
 */

const LEAVE_MS = 180;

export function reducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Mark a freshly mounted view so its enter animation plays once. */
export function enterView(node) {
  if (!node || reducedMotion()) return;
  node.classList.add("is-entering");
  node.addEventListener("animationend", () => node.classList.remove("is-entering"), { once: true });
}

/** Play the leave animation, then resolve. Resolves at once under reduced motion. */
export function leaveView(node) {
  if (!node || !node.isConnected || reducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      node.classList.remove("is-leaving");
      resolve();
    };
    node.classList.add("is-leaving");
    node.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, LEAVE_MS + 60);
  });
}
