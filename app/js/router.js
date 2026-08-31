/**
 * Hash router. #/map/runs means view "map", argument "runs". Hash keeps the app
 * deployable as static files anywhere, with no server rewrite rules.
 */

import { allowLeave, isLeaveDirty } from "./leave-guard.js";

/**
 * `aliases` keeps old links alive after a surface moves. Reviews folded into
 * Today and Work became the Map's list view; the links Aden already sent people
 * still have to land somewhere sensible.
 */
export function createRouter({ routes, aliases = {}, fallback, onNavigate }) {
  let lastHash = location.hash;
  let permittedHash = null;
  let restoring = false;

  function parse() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [name, ...args] = raw.split("/").filter(Boolean);
    if (aliases[name]) {
      const [mapped, ...forced] = aliases[name];
      return { name: mapped, args: forced.length ? forced : args };
    }
    return { name: routes[name] ? name : fallback, args };
  }

  function handle() {
    const incoming = location.hash;
    if (incoming !== lastHash && incoming !== permittedHash && isLeaveDirty()) {
      if (!allowLeave()) {
        restoring = true;
        location.hash = lastHash;
        return;
      }
    }
    if (restoring && incoming === lastHash) {
      restoring = false;
      permittedHash = null;
      return;
    }
    restoring = false;
    permittedHash = null;
    lastHash = incoming;
    const route = parse();
    onNavigate(route, routes[route.name]);
  }

  function go(name, ...args) {
    const next = `#/${[name, ...args].filter(Boolean).join("/")}`;
    if (location.hash === next) {
      handle();
      return;
    }
    if (isLeaveDirty() && !allowLeave()) return;
    permittedHash = next;
    location.hash = next;
  }

  window.addEventListener("hashchange", handle);

  return { start: handle, go, current: parse };
}
