/**
 * The map. The whole path as a floor you walk forward on, and the same nodes
 * as a list. Clicking a node opens the full step page (#/map/<nodeId>); boot
 * owns that view. This file is the floor and the list only.
 *
 * `#/map` is the floor, `#/map/list` is the list. "list" and "3d" are reserved.
 * The SVG board this replaced lives on in `site/path/` (the public, empty
 * path) and in git history; the per-student drag layout and the admin editor
 * went with it, because on the floor position is derived from sequence.
 */

import { el, mount } from "../dom.js";
import { btn, toast } from "../ui.js";
import { createScene3d } from "../graph/scene3d/index.js";
import { STATUS, nextUp, progress, visibleGraph } from "../graph/model.js";
import { LEGEND, STANDING, STANDING_LABEL, standingOf } from "../graph/standing.js";
import { trackLabel } from "../copy.js";
import { mapList } from "./map-list.js";
import { createGridState, hashFor, RESERVED_ARGS, VIEW } from "./grid-state.js";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js";

/** Right side clears the control column, top clears the legend bar. */
const INSETS = { top: 76, right: 132, bottom: 72, left: 40 };
/** How to move on the floor. Shown while nothing is hovered. */
const WALK_HINT = "Arrow keys walk the floor · drag to pan · wheel to rise · click a ring to open it";

export function renderMap(ctx, initialArg) {
  const hudTop = el("div.hud.hud--top");
  const hudSide = el("div.hud.hud--side");
  const status = el("div.hud.hud--status", { role: "status" });
  const lockFloat = el("div.lock-float", { hidden: true });
  const world = el("div.world3d-host", { role: "application", "aria-label": "Your path" });
  const canvas = el("div.view.view--map", {}, world, hudTop, hudSide, status);
  const list = el("div.view.view--maplist", { hidden: true });
  const root = el("div.mapview", {}, canvas, list, lockFloat);

  let current = ctx;
  let signature = "";

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

  function paintOptions(extra = {}) {
    return { nextId: nextUp(current.state.graph)?.id ?? null, ...extra };
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

  /* ---------- the floor ---------- */

  let floor = null;
  let floorLoading = null;

  function loadFloor() {
    if (floor) return Promise.resolve(floor);
    if (!floorLoading) {
      floorLoading = createScene3d(world)
        .then((made) => {
          floor = made;
          signature = "";
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

  function openNode(id) {
    const node = current.state.graph.byId.get(id);
    if (shouldInterceptLock(node)) {
      showLockNotice(node);
      return;
    }
    dismissLockNotice();
    setStatus(null);
    current.navigate("map", id);
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
        setStatus(WALK_HINT);
      });
      proxy.addEventListener("focus", () => setStatus(hoverLine(id)));
      proxy.addEventListener("blur", () => setStatus(WALK_HINT));
    });
  }

  /* ---------- HUD ---------- */

  function renderHud() {
    const { graph } = current.state;
    const prog = progress(graph);

    mount(
      hudTop,
      el(
        "div.hud__group",
        {},
        modeToggle(),
        el("b.hud__count", {}, `Required ${prog.spine.lit} of ${prog.spine.total}`),
        el("span.hud__depth", {}, depthLine(prog.depth))
      ),
      el("div.hud__group", {}, ...legendFor(graph).map((standing) => legendKey(standing, STANDING_LABEL[standing])))
    );

    mount(
      hudSide,
      btn({ label: "Fit", variant: "quiet", title: "The whole path", onclick: () => floor?.fit({ insets: INSETS }) }),
      btn({
        label: "Here",
        variant: "quiet",
        title: "Stand behind the node you are on",
        onclick: () => standHere(shown(), { glide: true }),
      }),
      btn({
        label: "Next",
        variant: "quiet",
        title: "Open the node you are on",
        onclick: () => {
          const target = nextUp(graph);
          if (target) current.navigate("map", target.id);
        },
      }),
      btn({ label: "+", variant: "quiet", title: "Zoom in", onclick: () => floor?.zoomBy(1.25) }),
      btn({ label: "−", variant: "quiet", title: "Zoom out", onclick: () => floor?.zoomBy(0.8) })
    );

    setStatus(isList() ? null : WALK_HINT);
  }

  /**
   * The legend explains what is on the floor, not every state that exists.
   * "Do this next", "Done" and "Ahead" always read; the rest appear only once
   * a node on this board stands that way, so a fresh board shows three keys
   * and a laptop does not wrap eight.
   */
  function legendFor(graph) {
    const nextId = nextUp(graph)?.id ?? null;
    const present = new Set(graph.nodes.map((node) => standingOf(node, nextId)));
    const always = new Set([STANDING.NEXT, STANDING.LIT, STANDING.LOCKED]);
    return LEGEND.filter((standing) => always.has(standing) || present.has(standing));
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
    const parts = [`${String(node.n).padStart(2, "0")} · ${node.title}`, STANDING_LABEL[standing]];
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
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      floor?.destroy();
    },
  };
}
