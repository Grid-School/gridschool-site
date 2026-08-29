/**
 * The map. A navigable graph of the whole path, and the same nodes as a list.
 * Clicking a node opens the full step page (#/map/<nodeId>) — boot owns that
 * view. This file is the graph/list only.
 *
 * `#/map` is the graph, `#/map/list` is the list. "list" is reserved.
 */

import { el, mount } from "../dom.js";
import { btn, toast } from "../ui.js";
import { createScene, renderScene, paint, syncPositions } from "../graph/scene.js";
import { createCamera } from "../graph/camera.js";
import { createEditor } from "../graph/editor.js";
import { applyLayout, bounds } from "../graph/layout.js";
import { STATUS, nextUp, progress } from "../graph/model.js";
import { statusLabel, trackLabel, RULE } from "../copy.js";
import { mapList } from "./map-list.js";
import { createGridState, hashFor, VIEW } from "./grid-state.js";

/** Right side clears the control column, top clears the legend bar. */
const INSETS = { top: 76, right: 132, bottom: 72, left: 150 };
/** Same breakpoint the stylesheet uses to move the controls. */
const NARROW = 900;

export function renderMap(ctx, initialArg) {
  const svg = el("svg.map", {
    id: "gridmap",
    role: "application",
    "aria-label": "Your Defense Path",
  });
  const hudTop = el("div.hud.hud--top");
  const hudSide = el("div.hud.hud--side");
  const status = el("div.hud.hud--status", { role: "status" });
  // Two projections of one thing, so they live in one view and swap in place.
  const canvas = el("div.view.view--map", {}, svg, hudTop, hudSide, status);
  const list = el("div.view.view--maplist", { hidden: true });
  const root = el("div.mapview", {}, canvas, list);

  let current = ctx;
  let signature = "";

  /**
   * The single writer. Every transition redraws and rewrites the hash, so the
   * board, the room, and the URL are three views of one value rather than three
   * values that have to be kept in agreement by hand.
   */
  const ui = createGridState({
    arg: initialArg,
    hasNode: (id) => current.state.graph.byId.has(id),
    onChange: (next, previous) => {
      syncHash();
      draw({
        refit: next.view !== previous.view && next.view === VIEW.GRID,
      });
    },
  });

  const selected = () => null;
  const isList = () => ui.state.view === VIEW.LIST;

  /** Hash matches graph/list only. Step pages own #/map/<nodeId> via the router. */
  function syncHash() {
    const target = hashFor(ui.state);
    if (location.hash === target) return;
    history.replaceState(null, "", `${location.pathname}${location.search}${target}`);
  }

  const scene = createScene(svg);
  const camera = createCamera(svg, scene.world, {
    onChange: ({ scale }) => {
      svg.classList.toggle("lod-far", scale < 0.6);
      svg.classList.toggle("lod-near", scale > 1.15);
      svg.style.setProperty("--map-lod", String(1 / scale));
    },
    // In edit mode a press on a node belongs to the editor. If the camera also
    // panned, the world would move with the node and it would never appear to move.
    shouldPan: (event) => !(editor.enabled && event.target.closest(".gnode")),
  });

  const editor = createEditor({
    scene,
    camera,
    getGraph: () => current.state.graph,
    store: current.store,
    onCommit: () => toast("Board saved."),
    onStatus: (text) => setStatus(text),
  });

  function setStatus(text) {
    if (!text) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    mount(status, text);
  }

  function graphSignature(graph) {
    return graph.nodes.map((n) => `${n.id}:${n.x}:${n.y}:${(n.requires ?? []).join(",")}`).join("|");
  }

  function draw({ refit = false, reveal = null } = {}) {
    const { graph, student } = current.state;
    applyLayout(graph, student.layout);
    const next = graphSignature(graph);
    const options = { selectedId: selected(), nextId: nextUp(graph)?.id ?? null };

    if (next !== signature) {
      signature = next;
      renderScene(scene, graph, options);
      wireNodes();
    } else {
      paint(scene, graph, options);
      syncPositions(scene, graph);
    }

    canvas.hidden = isList();
    list.hidden = !isList();
    if (isList()) {
      mount(
        list,
        listHead(),
        mapList({
          state: current.state,
          // Opening a node from the list goes back to the graph, because the
          // room is anchored to a node's position on the board. One event does
          // both: the machine cannot land on "list, with a room open".
          onOpenNode: (id) => current.navigate("map", id),
        })
      );
    }

    if (refit && !isList()) frameBoard({ animate: false });
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
    return el(
      "div.seg",
      { role: "group", "aria-label": "How to see the map" },
      el(
        "button.seg__b",
        {
          type: "button",
          class: isList() ? null : "is-on",
          "aria-pressed": String(!isList()),
          onclick: () => ui.setView(VIEW.GRID),
        },
        "Map"
      ),
      el(
        "button.seg__b",
        {
          type: "button",
          class: isList() ? "is-on" : null,
          "aria-pressed": String(isList()),
          onclick: () => ui.setView(VIEW.LIST),
        },
        "List"
      )
    );
  }

  /**
   * On a wide screen the whole path fits and reading it is the point. On a phone
   * the same fit shrinks every node past legibility, so the map opens where the
   * student actually is and Fit stays available for the overview.
   */
  function frameBoard({ animate = false } = {}) {
    const { graph } = current.state;
    if (!isNarrow()) {
      camera.fit(bounds(graph), { animate, insets: INSETS });
      return;
    }
    const here = nextUp(graph) ?? graph.nodes.find((node) => node.status === STATUS.OPEN) ?? graph.nodes[0];
    camera.frame(here, { scale: 1, animate, insets: INSETS });
  }

  function wireNodes() {
    scene.nodeEls.forEach((group, id) => {
      group.addEventListener("click", (event) => {
        if (camera.didDrag() || editor.isDragging()) return;
        if (editor.enabled && editor.mode === "connect") return;
        event.stopPropagation();
        current.navigate("map", id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          current.navigate("map", id);
        }
      });
      group.addEventListener("mouseenter", () => {
        paint(scene, current.state.graph, {
          selectedId: selected(),
          nextId: nextUp(current.state.graph)?.id ?? null,
          tracingId: id,
        });
        if (!editor.enabled) setStatus(hoverLine(id));
      });
      group.addEventListener("mouseleave", () => {
        paint(scene, current.state.graph, {
          selectedId: selected(),
          nextId: nextUp(current.state.graph)?.id ?? null,
        });
        if (!editor.enabled) setStatus(null);
      });
      group.addEventListener("focus", () => {
        if (!editor.enabled) setStatus(hoverLine(id));
      });
      group.addEventListener("blur", () => {
        if (!editor.enabled) setStatus(null);
      });
    });
  }

  const isNarrow = () => window.innerWidth <= NARROW;

  svg.addEventListener("click", (event) => {
    if (event.target.closest(".gnode")) return;
    if (camera.didDrag()) return;
    /* step page owns close */
  });

  /* ---------- HUD ---------- */

  function renderHud() {
    const { graph } = current.state;
    const prog = progress(graph);
    const isAdmin = current.role === "admin";

    mount(
      hudTop,
      el(
        "div.hud__group",
        {},
        modeToggle(),
        el("b.hud__count", {}, `Required ${prog.spine.lit} of ${prog.spine.total}`),
        el("span.hud__depth", {}, `Depth ${prog.depth.lit} of ${prog.depth.total}`),
        el("span.hud__law", {}, RULE)
      ),
      el(
        "div.hud__group",
        {},
        legendKey("lit", "Done"),
        legendKey("open", "Current"),
        legendKey("locked", "Locked"),
        legendKey("future", "Later")
      )
    );

    mount(
      hudSide,
      btn({ label: "Fit", variant: "quiet", onclick: () => camera.fit(bounds(graph), { animate: true, insets: INSETS }) }),
      btn({
        label: "Next",
        variant: "quiet",
        onclick: () => {
          const target = nextUp(graph);
          if (target) current.navigate("map", target.id);
        },
      }),
      btn({ label: "+", variant: "quiet", title: "Zoom in", onclick: () => camera.zoomBy(1.25) }),
      btn({ label: "−", variant: "quiet", title: "Zoom out", onclick: () => camera.zoomBy(0.8) }),
      isAdmin &&
        btn({
          label: editor.enabled ? "Done editing" : "Edit map",
          variant: editor.enabled ? "solid" : "quiet",
          onclick: () => {
            editor.setEnabled(!editor.enabled);
            editor.setMode("select");
            // Rearranging is a whole-board job. The room would hide the nodes
            // sitting underneath it, so it closes on the way in.
            if (editor.enabled) {
              /* step page owns close */
              camera.release();
            }
            signature = "";
            draw();
          },
        }),
      isAdmin &&
        editor.enabled &&
        btn({
          label: editor.mode === "connect" ? "Stop wiring" : "Wire nodes",
          variant: editor.mode === "connect" ? "solid" : "quiet",
          onclick: () => {
            editor.setMode(editor.mode === "connect" ? "select" : "connect");
            renderHud();
          },
        }),
      isAdmin &&
        editor.enabled &&
        btn({
          label: "Add node",
          variant: "quiet",
          onclick: () => {
            const title = prompt("Node title for this student?");
            if (!title) return;
            const id = editor.addNode({ title });
            signature = "";
            current.navigate("map", id);
            draw();
          },
        })
    );

    setStatus(editor.enabled ? statusFor() : null);
  }

  function statusFor() {
    if (editor.mode === "connect") return "Click the node that must come first, then the node that follows.";
    return "Drag nodes to rearrange. Positions save to this student's board.";
  }

  /** One line of depth on hover: what this node is, and where it stands. */
  function hoverLine(id) {
    const node = current.state.graph.byId.get(id);
    if (!node) return null;
    const parts = [`${String(node.n).padStart(2, "0")} · ${node.title}`];
    parts.push(trackLabel(node.track));
    if (node.why) parts.push(node.why);
    const { done = 0, total = 0 } = node.taskProgress ?? {};
    if (total) parts.push(`${done}/${total} tasks`);
    if (node.video?.mins) parts.push(`video ${node.video.mins} min`);
    if (node.reviewState === "in-review") parts.push("review out");
    if (node.reviewState === "returned") parts.push("notes back");
    return parts.join(" · ");
  }

  function legendKey(status, label) {
    return el("span.legend", {}, el("i", { class: `dot dot--${status}` }), label);
  }

  /* ---------- lifecycle ---------- */

  requestAnimationFrame(() => {
    syncHash();
    draw({ refit: true });
  });

  const onResize = () => {
    if (!isList()) frameBoard({ animate: false });
  };
  window.addEventListener("resize", onResize);

  return {
    node: root,
    /**
     * The route is an input to the machine, nothing more. Feeding it the same
     * argument twice is a no-op, so a hash that lags a frame behind a close can
     * no longer be mistaken for a fresh arrival and re-open the room.
     */
    update(nextCtx, arg) {
      current = nextCtx;
      if (arg && arg !== "list" && current.state.graph.byId.has(arg)) {
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
      camera.destroy();
      editor.destroy();
    },
  };
}
