/**
 * What the Map is showing, as one small machine.
 *
 * Two projections of one board: the floor (`#/map`) and the list
 * (`#/map/list`). The projection and the URL are both derived from one value,
 * so they cannot disagree. Opening a node is a step page (`#/map/<nodeId>`),
 * owned by the router, never a state here.
 *
 * `3d` is kept as an argument because links to `#/map/3d` were sent while the
 * floor was behind a toggle; it now means the floor, which is the default.
 */

export const VIEW = { MAP: "map", LIST: "list" };

/** The arguments to #/map that are not node ids. */
export const LIST_ARG = "list";
export const LEGACY_FLOOR_ARG = "3d";
export const RESERVED_ARGS = [LIST_ARG, LEGACY_FLOOR_ARG];

/** Route argument to state. Anything that is not the list is the floor. */
export function stateFromArg(arg) {
  return { view: arg === LIST_ARG ? VIEW.LIST : VIEW.MAP };
}

/** State back to a route argument. Round-trips with stateFromArg. */
export function argFor(state) {
  return state.view === VIEW.LIST ? LIST_ARG : null;
}

export function hashFor(state, base = "map") {
  const arg = argFor(state);
  return `#/${base}${arg ? `/${arg}` : ""}`;
}

export function sameState(a, b) {
  return a.view === b.view;
}

/** The only way state changes. Pure, so the rules are testable without a DOM. */
export function reduce(state, event) {
  switch (event.type) {
    case "route":
      return stateFromArg(event.arg);
    case "view":
      return { view: event.view === VIEW.LIST ? VIEW.LIST : VIEW.MAP };
    default:
      return state;
  }
}

/**
 * The holder. One writer, one notification, and the current value is always
 * the result of a transition, never something a view assigned to.
 */
export function createGridState({ arg = null, onChange = () => {} } = {}) {
  let state = stateFromArg(arg);

  function dispatch(event) {
    const next = reduce(state, event);
    if (sameState(next, state)) return state;
    const previous = state;
    state = next;
    onChange(state, previous);
    return state;
  }

  return {
    get state() {
      return state;
    },
    dispatch,
    route: (nextArg) => dispatch({ type: "route", arg: nextArg ?? null }),
    setView: (view) => dispatch({ type: "view", view }),
    isList: () => state.view === VIEW.LIST,
  };
}
