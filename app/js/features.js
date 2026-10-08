/**
 * Which doors the board shows. A door that does not work today is not drawn,
 * and its route lands on the Map instead of a dead end. The code behind it
 * stays; flip the switch in config.js and the door comes back in the same
 * rail slot. One place decides, so the rail, the router, and the step bar
 * never disagree.
 *
 *   today (Coach)  shown when COACH.endpoint is a real URL
 *   posts          shown when FEATURES.posts is true
 */

import { COACH, FEATURES, isPlaceholder } from "../../config.js?v=b6ca108-202610080352";

export function enabledViews({ coach = COACH, features = FEATURES } = {}) {
  return {
    today: !isPlaceholder(coach?.endpoint),
    posts: features?.posts === true,
  };
}

/** True unless the view is one of the gated doors and its switch is off. */
export function isViewEnabled(name, flags = enabledViews()) {
  return !(name in flags) || flags[name] === true;
}

/** Drop the gated views that are switched off from a routes table. */
export function gateRoutes(routes, flags = enabledViews()) {
  return Object.fromEntries(Object.entries(routes).filter(([name]) => isViewEnabled(name, flags)));
}
