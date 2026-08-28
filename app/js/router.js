/**
 * Hash router. #/map/runs means view "map", argument "runs". Hash keeps the app
 * deployable as static files anywhere, with no server rewrite rules.
 */

/**
 * `aliases` keeps old links alive after a surface moves. Reviews folded into
 * Today and Work became the Map's list view; the links Aden already sent people
 * still have to land somewhere sensible.
 */
export function createRouter({ routes, aliases = {}, fallback, onNavigate }) {
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
    const route = parse();
    onNavigate(route, routes[route.name]);
  }

  function go(name, ...args) {
    const next = `#/${[name, ...args].filter(Boolean).join("/")}`;
    if (location.hash === next) handle();
    else location.hash = next;
  }

  window.addEventListener("hashchange", handle);

  return { start: handle, go, current: parse };
}
