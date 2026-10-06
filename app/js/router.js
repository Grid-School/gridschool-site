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
      // An alias to a door that is switched off lands on the fallback too.
      if (!routes[mapped]) return { name: fallback, args: [], redirected: true };
      return { name: mapped, args: forced.length ? forced : args, redirected: true };
    }
    if (name && !routes[name]) return { name: fallback, args: [], redirected: true };
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
    // An alias, or a door that is switched off (features.js), lands somewhere
    // true; the address bar should say where, so a copied link is the real
    // route and not the retired or hidden name.
    const canonical = `#/${[route.name, ...route.args].filter(Boolean).join("/")}`;
    if (incoming !== canonical && route.redirected) {
      history.replaceState(null, "", `${location.pathname}${location.search}${canonical}`);
      lastHash = canonical;
    }
    const { redirected, ...shown } = route;
    onNavigate(shown, routes[route.name]);
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

  return {
    start: handle,
    go,
    current: () => {
      const { redirected, ...shown } = parse();
      return shown;
    },
  };
}
