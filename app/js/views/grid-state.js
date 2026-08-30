/**
 * What the Grid is showing, as one small machine.
 *
 * Three things used to decide that: a `selectedId` local, a `mode` local, and
 * the hash. Any two could disagree, and they did - leaving the board with a
 * room open and coming back re-opened a room the URL said was shut, and the
 * room that came back could sit on top of the board with nothing to close it.
 *
 * Here there is one value. The projection, the open room, and the URL are all
 * derived from it, so "the URL says closed while a room is open" is not a state
 * this can hold. Views read it and never write their own copy.
 */

export const VIEW = { GRID: "grid", LIST: "list" };

/** The one argument to #/map that is not a node id. */
export const LIST_ARG = "list";

/**
 * The list is a projection of the whole board, so a room cannot be open inside
 * it. Normalising here rather than at each call site is what makes that true by
 * construction instead of by everyone remembering.
 */
function normalize(state) {
  if (state.view === VIEW.LIST) return { view: VIEW.LIST, room: null };
  return { view: VIEW.GRID, room: state.room ?? null };
}

/** Route argument to state. An unknown node id opens nothing. */
export function stateFromArg(arg, hasNode = () => true) {
  if (arg === LIST_ARG) return normalize({ view: VIEW.LIST });
  const id = arg || null;
  return normalize({ view: VIEW.GRID, room: id && hasNode(id) ? id : null });
}

/** State back to a route argument. Round-trips with stateFromArg. */
export function argFor(state) {
  if (state.view === VIEW.LIST) return LIST_ARG;
  return state.room ?? null;
}

export function hashFor(state, base = "map") {
  const arg = argFor(state);
  return `#/${base}${arg ? `/${arg}` : ""}`;
}

export function sameState(a, b) {
  return a.view === b.view && a.room === b.room;
}

/**
 * The only way state changes. Pure, so the rules are testable without a DOM.
 * `hasNode` keeps a stale or hand-typed id from opening a room for a node that
 * is not on this student's board.
 */
export function reduce(state, event, { hasNode = () => true } = {}) {
  switch (event.type) {
    case "route":
      return stateFromArg(event.arg, hasNode);

    case "open":
      if (!event.id || !hasNode(event.id)) return state;
      return normalize({ view: VIEW.GRID, room: event.id });

    case "toggle":
      if (!event.id || !hasNode(event.id)) return state;
      if (state.view === VIEW.GRID && state.room === event.id) {
        return normalize({ view: VIEW.GRID, room: null });
      }
      return normalize({ view: VIEW.GRID, room: event.id });

    case "close":
      return normalize({ ...state, room: null });

    case "view":
      return normalize({ view: event.view === VIEW.LIST ? VIEW.LIST : VIEW.GRID, room: state.room });

    default:
      return state;
  }
}

/**
 * The holder. One writer, one notification, and the current value is always the
 * result of a transition - never something a view assigned to.
 */
export function createGridState({ arg = null, hasNode = () => true, onChange = () => {} } = {}) {
  let state = stateFromArg(arg, hasNode);

  function dispatch(event) {
    const next = reduce(state, event, { hasNode });
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
    open: (id) => dispatch({ type: "open", id }),
    toggle: (id) => dispatch({ type: "toggle", id }),
    close: () => dispatch({ type: "close" }),
    setView: (view) => dispatch({ type: "view", view }),
    isList: () => state.view === VIEW.LIST,
    openRoom: () => state.room,
  };
}
