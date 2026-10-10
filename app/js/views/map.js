/**
 * The map. The whole path as a floor you walk forward on, and the same nodes
 * as a list. Clicking a node opens the full step page (#/map/<nodeId>); boot
 * owns that view. This file is the floor and the list only.
 *
 * `#/map` is the floor, `#/map/list` is the list. "list" and "3d" are reserved.
 *
 * The map draws one of two ways, and the student picks (BRAND.md 2026-10-07):
 * the Floor (3D, scene3d) or the Route (2D, graph/rez, the same road the
 * landing draws). Both take the same graph and give the same node proxies, so
 * everything below is shared. The pick is saved on the seat (prefs.mapStyle);
 * until a student picks, the Floor stays and a one-time card offers the
 * Route. The demo opens on the Route, the look the landing promises.
 * The SVG board this replaced lives on in `site/path/` (the public, empty
 * path) and in git history; the per-student drag layout and the admin editor
 * went with it, because on the floor position is derived from sequence.
 */

import { el, mount } from "../dom.js?v=d696edf-202610102057";
import { btn, toast } from "../ui.js?v=d696edf-202610102057";
import { createScene3d } from "../graph/scene3d/index.js?v=d696edf-202610102057";
import { createRezScene } from "../graph/rez/index.js?v=d696edf-202610102057";
import { STATUS, nextUp, progress, visibleGraph, stepNumber } from "../graph/model.js?v=d696edf-202610102057";
import { LEGEND, STANDING, STANDING_LABEL, standingOf, legendKeyOf } from "../graph/standing.js?v=d696edf-202610102057";
import { trackLabel } from "../copy.js?v=d696edf-202610102057";
import { mapList } from "./map-list.js?v=d696edf-202610102057";
import { dueLabel } from "./from-aden.js?v=d696edf-202610102057";
import { createGridState, hashFor, RESERVED_ARGS, VIEW } from "./grid-state.js?v=d696edf-202610102057";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js?v=d696edf-202610102057";
import { isProgressReadOnly } from "../store.js?v=d696edf-202610102057";
import { doneForYou, nextMove, movesAfterNext } from "../engine.js?v=d696edf-202610102057";
import { matchedRoles, fetchPacks, radarReady } from "../roles-remote.js?v=d696edf-202610102057";
import { careerOf } from "../search.js?v=d696edf-202610102057";
import { isoDate } from "../time.js?v=d696edf-202610102057";

/** Right side clears the control column, top clears the legend bar. */
const INSETS = { top: 76, right: 132, bottom: 72, left: 40 };

export const MAP_STYLE = { FLOOR: "floor", ROUTE: "route" };
const STYLE_KEY = "gridschool.mapStyle";

/** A pick kept in this browser only: the demo, and an admin viewing a seat. */
function localStyle() {
  try {
    const value = localStorage.getItem(STYLE_KEY);
    return Object.values(MAP_STYLE).includes(value) ? value : null;
  } catch {
    return null;
  }
}

/** The style this board draws in: the seat's pick, else the demo's Route, else the Floor. */
export function mapStyleFor(state, local = localStyle()) {
  const picked = state.student?.prefs?.mapStyle;
  if (state.slug === "demo" || isProgressReadOnly()) return local ?? (state.slug === "demo" ? MAP_STYLE.ROUTE : picked ?? MAP_STYLE.FLOOR);
  return Object.values(MAP_STYLE).includes(picked) ? picked : MAP_STYLE.FLOOR;
}

export function renderMap(ctx, initialArg) {
  const hudTop = el("div.hud.hud--top");
  const hudSide = el("div.hud.hud--side");
  const status = el("div.hud.hud--status", { role: "status" });
  const nextCard = el("div.nextbar", { role: "region", "aria-label": "Do this next" });
  const adenLine = el("div.adenline", { hidden: true });
  const lockFloat = el("div.lock-float", { hidden: true });
  const invite = el("div.style-invite", { hidden: true, role: "dialog", "aria-label": "A new way to see your map" });
  const world = el("div.world3d-host", { role: "application", "aria-label": "Your path" });
  const canvas = el("div.view.view--map", {}, world, hudTop, adenLine, hudSide, status, nextCard, invite);
  const list = el("div.view.view--maplist", { hidden: true });
  const root = el("div.mapview", {}, canvas, list, lockFloat);

  let current = ctx;
  let signature = "";

  // The Route only, for now (2026-10-10): one 2D map, the one the landing draws.
  // The Floor (scene3d) and the per-seat pick stay in the code for a later return.
  const style = () => MAP_STYLE.ROUTE;

  /** The single writer: every transition redraws and rewrites the hash. */
  const ui = createGridState({
    arg: initialArg,
    onChange: () => {
      syncHash();
      draw();
    },
  });

  const isList = () => ui.state.view === VIEW.LIST;

  function syncHash() {
    const target = hashFor(ui.state);
    if (location.hash === target) return;
    history.replaceState(null, "", `${location.pathname}${location.search}${target}`);
  }

  function setStatus(text) {
    if (!text) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    mount(status, text);
  }

  /** Ids and edges only: positions are derived from these on the floor. */
  function graphSignature(graph) {
    return graph.nodes.map((n) => `${n.id}:${n.n}:${(n.requires ?? []).join(",")}`).join("|");
  }

  /** A student sees the spine, what they picked and what is on offer. */
  const shown = () => visibleGraph(current.state.graph);

  /** Ready nodes and the next move ride on every real board (not the public demo). */
  const hasBand = () => current.state.slug !== "demo";

  /* What's ready comes from the server: radar matches (for people they know inside) and prepared roles. */
  const live = { roles: [], packs: {}, loaded: false };
  async function loadLive() {
    if (!hasBand() || !radarReady()) return;
    const career = careerOf(current.state.student);
    const titles = career.titles.length ? career.titles : ["Software Engineer"];
    const [roles, packs] = await Promise.all([
      matchedRoles({ titles, years: career.years ?? null, limit: 60 }).then((r) => r.roles ?? []).catch(() => []),
      fetchPacks(current.state.slug).catch(() => ({})),
    ]);
    live.roles = roles;
    live.packs = packs;
    live.loaded = true;
    if (!isList()) drawFloor(shown(), paintOptions());
    renderNext();
  }

  const move = () => nextMove({ student: current.state.student, graph: current.state.graph, roles: live.roles, packs: live.packs });

  /** What a ready thing is, in the words an app would use. */
  const TAG = { insider: "Found for you", campaign: "Drafted for you", prepared: "Prepared for you" };
  const LANE_OF = { insider: "network", campaign: "pipeline", prepared: "pipeline" };
  const titleOf = (item) =>
    item.kind === "insider" ? `Ask ${item.person.name} at ${item.role.company}` : item.kind === "campaign" ? `Send the ${item.target.company} campaign` : `Apply to ${item.label.replace(/^Prepared: /, "")}`;

  /** The next move (white) and up to two more things made for them, as nodes beside "you are here". */
  function readyNodes() {
    const next = move();
    const column = doneForYou({ student: current.state.student, roles: live.roles, packs: live.packs });
    const items = [];
    let skipFed = Boolean(next.fed);
    if (!next.stepId && next.lane) {
      const tag = next.fed ? TAG[next.fed] : /^Prepare for your/.test(next.title) ? "Booked" : null;
      items.push({ title: next.title, tag, tool: next.tool, lane: next.lane, isNext: true });
    }
    for (const item of column.ready) {
      if (items.length >= 3) break;
      if (skipFed && item.kind === next.fed) {
        skipFed = false;
        continue;
      }
      items.push({ title: titleOf(item), tag: TAG[item.kind], tool: item.tool, lane: LANE_OF[item.kind], isNext: false });
    }
    return { items };
  }

  function paintOptions(extra = {}) {
    const nextId = nextUp(current.state.graph)?.id ?? null;
    if (!hasBand()) return { nextId, ...extra };
    return { nextId, ready: readyNodes(), onTool: (tool) => current.navigate("do", tool), ...extra };
  }

  /** Aden's current work for them, as a plain sentence under the top bar. */
  function renderAden() {
    const item = (careerOf(current.state.student).working ?? []).find((w) => !w.done && w.text);
    adenLine.hidden = !hasBand() || isList() || !item;
    if (item) mount(adenLine, el("span.adenline__dot", { "aria-hidden": "true" }), el("span", {}, `Aden is working on: ${item.text}`));
  }

  /** The bottom bar: the one next move, docked, so it never covers the map. Agrees with the white ring. */
  function renderNext() {
    if (!hasBand() || isList()) {
      nextCard.hidden = true;
      return;
    }
    const next = move();
    // "+N more today" only after they've done something today: the first look is one move, not a list.
    const today = isoDate(new Date());
    const doneToday = (current.state.student?.search?.apps ?? []).some((a) => a.date === today) || String(current.state.student?.search?.profileAt ?? "").startsWith(today);
    const more = doneToday ? movesAfterNext({ student: current.state.student, roles: live.roles, packs: live.packs }) : 0;
    nextCard.hidden = false;
    mount(
      nextCard,
      el("span.nextbar__dot", { "aria-hidden": "true" }),
      el("div.nextbar__text", {}, el("b.nextbar__title", {}, next.title), el("span.nextbar__why", {}, next.why)),
      more ? btn({ label: `+${more} more today`, variant: "quiet", onclick: () => current.navigate("do", "today") }) : null,
      btn({
        label: next.stepId ? "Open the step" : "Open",
        variant: "solid",
        onclick: () => (next.stepId ? current.navigate("map", next.stepId) : current.navigate("do", next.tool)),
      })
    );
  }

  function draw() {
    canvas.hidden = isList();
    list.hidden = !isList();
    if (isList()) {
      mount(list, listHead(), mapList({ state: current.state, onOpenNode: (id) => openNode(id) }));
    } else {
      drawFloor(shown(), paintOptions());
    }
    renderHud();
  }

  function listHead() {
    return el(
      "header.view__head",
      {},
      el("b.eyebrow", {}, "What a stranger can click"),
      el("h1", {}, "Your work"),
      el("p.muted", {}, "The same nodes as the map, as the list you paste into a message."),
      el("div.view__nav", {}, modeToggle())
    );
  }

  /** One control, two projections. Never two navigation items for one dataset. */
  function modeToggle() {
    const seg = (view, label) =>
      el(
        "button.seg__b",
        {
          type: "button",
          class: ui.state.view === view ? "is-on" : null,
          "aria-pressed": String(ui.state.view === view),
          onclick: () => ui.setView(view),
        },
        label
      );
    return el("div.seg", { role: "group", "aria-label": "How to see the map" }, seg(VIEW.MAP, "Map"), seg(VIEW.LIST, "List"));
  }

  /* ---------- the floor (or the route: one surface, two renderers) ---------- */

  let floor = null;
  let floorLoading = null;
  let floorStyle = null;

  function loadFloor() {
    const want = style();
    if (floorStyle !== want) {
      floor?.destroy();
      floor = null;
      floorLoading = null;
      floorStyle = want;
      signature = "";
    }
    if (floor) return Promise.resolve(floor);
    if (!floorLoading) {
      const create = want === MAP_STYLE.ROUTE ? createRezScene : createScene3d;
      floorLoading = create(world)
        .then((made) => {
          // The student switched while this one was loading: drop it.
          if (floorStyle !== want) {
            made.destroy();
            return loadFloor();
          }
          floor = made;
          signature = "";
          world.dataset.style = want;
          return made;
        })
        .catch((error) => {
          floorLoading = null;
          console.error("The map could not load", error);
          toast("The map could not draw. The list still works.", "warn");
          ui.setView(VIEW.LIST);
          throw error;
        });
    }
    return floorLoading;
  }

  function drawFloor(graph, options) {
    const next = graphSignature(graph);
    loadFloor().then(
      (made) => {
        if (isList()) return;
        made.resize();
        if (next !== signature) {
          signature = next;
          made.renderScene(graph, options);
          wireNodes(made.nodeEls, made);
          standHere(graph);
        } else {
          made.paint(graph, options);
        }
      },
      () => {}
    );
  }

  /** Open standing behind the node you are on, looking ahead. */
  function standHere(graph, { glide = false } = {}) {
    if (!floor) return;
    const here = nextUp(graph) ?? graph.nodes.find((node) => node.status === STATUS.OPEN) ?? graph.nodes.at(-1);
    if (here) floor.frame(here, { glide });
    else floor.fit({ insets: INSETS });
  }

  /** The node the camera went into; on return it pulls back out from there. */
  let openedId = null;

  function openNode(id) {
    const node = current.state.graph.byId.get(id);
    if (shouldInterceptLock(node)) {
      showLockNotice(node);
      return;
    }
    dismissLockNotice();
    setStatus(null);
    openedId = id;
    const go = () => current.navigate("map", id);
    if (floor && !isList()) floor.approach(node).then(go);
    else go();
  }

  /** Back on the floor after a step: the eye comes back out of the node it entered. */
  function returnFromNode() {
    if (!openedId) return;
    const node = current.state.graph.byId.get(openedId);
    openedId = null;
    if (node && floor && !isList()) floor.retreat(node);
  }

  function dismissLockNotice() {
    lockFloat.hidden = true;
    mount(lockFloat);
  }

  function showLockNotice(node) {
    setStatus(null);
    lockFloat.hidden = false;
    mount(
      lockFloat,
      lockNotice({
        graph: current.state.graph,
        node,
        onGo: (id) => {
          dismissLockNotice();
          current.navigate("map", id);
        },
        onDismiss: dismissLockNotice,
      })
    );
  }

  /** The floor hands over focusable proxies and replays canvas hits onto them. */
  function wireNodes(nodeEls, surface) {
    const painter = (options) => surface.paint(shown(), paintOptions(options));
    nodeEls.forEach((proxy, id) => {
      // The canvas already swallows a click that ended a drag before replaying
      // it here, so a proxy click (keyboard, assistive tech, tests) is always real.
      proxy.addEventListener("click", (event) => {
        event.stopPropagation();
        openNode(id);
      });
      proxy.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openNode(id);
        }
      });
      proxy.addEventListener("mouseenter", () => {
        painter({ tracingId: id });
        setStatus(hoverLine(id));
      });
      proxy.addEventListener("mouseleave", () => {
        painter();
        setStatus(null);
      });
      proxy.addEventListener("focus", () => setStatus(hoverLine(id)));
      proxy.addEventListener("blur", () => setStatus(null));
    });
  }

  /* ---------- HUD ---------- */

  function renderHud() {
    const { graph } = current.state;
    const prog = progress(graph);

    const controls = [
      btn({ label: "Fit", variant: "quiet", title: "The whole path", onclick: () => floor?.fit({ insets: INSETS }) }),
      btn({
        label: "Here",
        variant: "quiet",
        title: "Stand behind the node you are on",
        onclick: () => standHere(shown(), { glide: true }),
      }),
      hasBand() ? null : btn({
        label: "Next",
        variant: "quiet",
        title: "Open the node you are on",
        onclick: () => {
          const target = nextUp(graph);
          if (target) current.navigate("map", target.id);
        },
      }),
      btn({ label: "+", variant: "quiet", title: "Zoom in", onclick: () => floor?.zoomBy(1.25) }),
      btn({ label: "−", variant: "quiet", title: "Zoom out", onclick: () => floor?.zoomBy(0.8) }),
    ];
    mount(
      hudTop,
      el(
        "div.hud__group",
        {},
        modeToggle(),
        el("b.hud__count", {}, hasBand() ? `${prog.spine.lit} of ${prog.spine.total} steps done` : `Required ${prog.spine.lit} of ${prog.spine.total}`),
        // A personal map has no elective depth; "No depth picked yet" would
        // read as a choice the student cannot make.
        hasDepth(graph, prog) ? el("span.hud__depth", {}, depthLine(prog.depth)) : null,
        prog.side.total ? el("span.hud__side", {}, `Side quests ${prog.side.lit} of ${prog.side.total}`) : null
      ),
      hasBand() ? el("div.hud__group.hud__controls", {}, controls) : null,
      hasBand()
        ? el(
            "div.hud__group.hud__key",
            {},
            el("span.legend", {}, el("i.key.key--done"), "done"),
            el("span.legend", {}, el("i.key.key--next"), "do this next"),
            el("span.legend", {}, el("i.key.key--tag", {}, "tag"), "made for you")
          )
        : el("div.hud__group", {}, ...legendFor(graph).map((standing) => legendKey(standing, STANDING_LABEL[standing])))
    );

    mount(hudSide, ...(hasBand() ? [] : controls));

    setStatus(null);
    renderNext();
    renderAden();
    invite.hidden = true;
  }

  /**
   * The legend explains what is on the floor, not every state that exists.
   * "Do this next", "Done" and "Ahead" always read; the rest appear only once
   * a node on this board stands that way, so a fresh board shows three keys
   * and a laptop does not wrap eight.
   */
  function legendFor(graph) {
    const nextId = nextUp(graph)?.id ?? null;
    const present = new Set(graph.nodes.map((node) => legendKeyOf(standingOf(node, nextId))));
    const always = new Set([STANDING.NEXT, STANDING.LIT, STANDING.LOCKED]);
    return LEGEND.filter((standing) => always.has(standing) || present.has(standing));
  }

  /** Depth exists on this map: a depth-track family, or a node marked depth. */
  function hasDepth(graph, prog) {
    return (graph.families ?? []).some((family) => family.track === "depth") || prog.depth.available > 0;
  }

  /** Depth is what you took on, then what is waiting to be picked. */
  function depthLine(depth) {
    const taken = depth.total ? `Depth ${depth.lit} of ${depth.total} picked` : "No depth picked yet";
    return depth.offered ? `${taken} · ${depth.offered} on offer` : taken;
  }

  /** One line of depth on hover: what this node is, and where it stands. */
  function hoverLine(id) {
    const { graph } = current.state;
    const node = graph.byId.get(id);
    if (!node) return null;
    const standing = standingOf(node, nextUp(graph)?.id ?? null);
    const parts = [`${stepNumber(node)} · ${node.title}`, STANDING_LABEL[standing]];
    const due = node.status !== STATUS.LIT ? dueLabel(node.fromAden?.due) : null;
    if (due) parts.push(due);
    if (standing === STANDING.LOCKED) {
      const blockers = (node.requires ?? [])
        .map((rid) => graph.byId.get(rid))
        .filter((item) => item && item.status !== STATUS.LIT && !item.awaitingSignoff)
        .map((item) => item.title);
      parts.push(`opens after ${blockers.length ? blockers.join(", ") : "a prior step"}`);
      return parts.join(" · ");
    }
    if (standing === STANDING.FUTURE) return parts.join(" · ");
    if (standing === STANDING.OFFERED) parts.push("open it to add it to your path");
    else parts.push(trackLabel(node.track));
    // An open node far up the road is not a skip: say what opened it.
    if (standing === STANDING.OPEN && node.n > (nextUp(graph)?.n ?? 0) + 1) {
      const openers = (node.requires ?? [])
        .map((rid) => graph.byId.get(rid))
        .filter((item) => item && (item.status === STATUS.LIT || item.awaitingSignoff))
        .map((item) => item.title);
      if (openers.length) parts.push(`opened by ${openers.join(", ")}`);
    }
    if (node.why) parts.push(node.why);
    const { done = 0, total = 0 } = node.taskProgress ?? {};
    if (total) parts.push(`${done}/${total} tasks`);
    if (node.video?.mins) parts.push(`video ${node.video.mins} min`);
    return parts.join(" · ");
  }

  function legendKey(status, label) {
    return el("span.legend", {}, el("i", { class: `dot dot--${status}` }), label);
  }

  /* ---------- lifecycle ---------- */

  requestAnimationFrame(() => {
    syncHash();
    draw();
  });
  // Don't wait for a frame: what's ready starts loading the moment the map mounts.
  void loadLive();

  const onResize = () => {
    if (!isList()) floor?.resize();
  };
  window.addEventListener("resize", onResize);

  return {
    node: root,
    /** The route is an input to the machine; the same argument twice is a no-op. */
    update(nextCtx, arg) {
      current = nextCtx;
      if (arg && !RESERVED_ARGS.includes(arg) && current.state.graph.byId.has(arg)) {
        current.navigate("map", arg);
        return;
      }
      const before = ui.state;
      ui.route(arg);
      if (ui.state !== before) return;
      syncHash();
      draw();
      returnFromNode();
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      floor?.destroy();
    },
  };
}
