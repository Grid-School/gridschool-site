/**
 * Map editing. Drag a node to move it, draw an edge to change what a node
 * depends on, add or remove nodes I appended for one student. Every change goes
 * through the store, so it persists and shows up in the JSON export.
 *
 * Only Aden sees this. A student's board is theirs to walk, not to rewire.
 */

import { el, clear } from "../dom.js";
import { edgePath, freeSlot } from "./layout.js";
import { syncPositions } from "./scene.js";

const DRAG_THRESHOLD = 3;

export function createEditor({ scene, camera, getGraph, store, onCommit, onStatus }) {
  let mode = "select";
  let drag = null;
  let connectFrom = null;
  let enabled = false;

  function setEnabled(next) {
    enabled = next;
    scene.svg.classList.toggle("is-editable", enabled);
    if (!enabled) cancelConnect();
  }

  function setMode(next) {
    mode = next;
    scene.svg.classList.toggle("is-connecting", mode === "connect");
    if (mode !== "connect") cancelConnect();
    onStatus?.(statusText());
  }

  function statusText() {
    if (!enabled) return null;
    if (mode === "connect") {
      return connectFrom
        ? `Now click the node that should come after ${connectFrom}.`
        : "Click the node that must come first.";
    }
    return "Drag nodes to rearrange. Positions save to this board.";
  }

  function nodeIdFrom(event) {
    return event.target.closest(".gnode")?.dataset.id ?? null;
  }

  function onPointerDown(event) {
    if (!enabled || mode !== "select") return;
    const id = nodeIdFrom(event);
    if (!id) return;
    const graph = getGraph();
    const node = graph.byId.get(id);
    if (!node) return;
    const start = camera.toWorld(event.clientX, event.clientY);
    drag = { id, moved: false, offsetX: node.x - start.x, offsetY: node.y - start.y };
    event.stopPropagation();
  }

  function onPointerMove(event) {
    if (!drag) return;
    const graph = getGraph();
    const node = graph.byId.get(drag.id);
    if (!node) return;
    const point = camera.toWorld(event.clientX, event.clientY);
    const nextX = point.x + drag.offsetX;
    const nextY = point.y + drag.offsetY;
    if (!drag.moved && Math.hypot(nextX - node.x, nextY - node.y) < DRAG_THRESHOLD) return;
    drag.moved = true;
    node.x = nextX;
    node.y = nextY;
    syncPositions(scene, graph);
  }

  function onPointerUp() {
    if (!drag) return;
    const { id, moved } = drag;
    drag = null;
    if (!moved) return;
    const node = getGraph().byId.get(id);
    store.moveNode(id, node.x, node.y);
    onCommit?.();
  }

  function onClick(event) {
    if (!enabled || mode !== "connect") return;
    const id = nodeIdFrom(event);
    if (!id) return;
    event.stopPropagation();
    if (!connectFrom) {
      connectFrom = id;
      scene.nodeEls.get(id)?.classList.add("is-wiring");
      onStatus?.(statusText());
      return;
    }
    if (connectFrom === id) {
      cancelConnect();
      return;
    }
    const graph = getGraph();
    const target = graph.byId.get(id);
    const requires = [...new Set([...(target.requires ?? []), connectFrom])];
    const result = store.setRequires(id, requires);
    cancelConnect();
    if (result?.error) onStatus?.(result.error);
    else onCommit?.();
  }

  function onDraftMove(event) {
    if (!enabled || mode !== "connect" || !connectFrom) return;
    const graph = getGraph();
    const from = graph.byId.get(connectFrom);
    if (!from) return;
    const point = camera.toWorld(event.clientX, event.clientY);
    clear(scene.draftLayer);
    scene.draftLayer.append(
      el("path.edge.edge--draft", { d: edgePath(from, { ...point, r: 8 }) })
    );
  }

  function cancelConnect() {
    if (connectFrom) scene.nodeEls.get(connectFrom)?.classList.remove("is-wiring");
    connectFrom = null;
    clear(scene.draftLayer);
    onStatus?.(statusText());
  }

  /** Detach a prerequisite without touching the rest of the wiring. */
  function unlink(nodeId, requiredId) {
    const graph = getGraph();
    const target = graph.byId.get(nodeId);
    if (!target) return;
    const requires = (target.requires ?? []).filter((id) => id !== requiredId);
    store.setRequires(nodeId, requires);
    onCommit?.();
  }

  function addNode({ title, evidence, why, requires = [] }) {
    const graph = getGraph();
    const slot = freeSlot(graph);
    const n = Math.max(0, ...graph.nodes.map((node) => node.n)) + 1;
    const id = `custom-${n}-${Date.now().toString(36)}`;
    store.addNode({
      id,
      n,
      title: title || `Custom node ${n}`,
      phase: graph.phases.at(-1)?.id ?? "proof",
      family: graph.families?.[0]?.id ?? "signal",
      weeks: [],
      col: slot.col,
      lane: slot.lane,
      requires,
      evidence: evidence || "A URL that proves this is done.",
      why: why || "Added for this student.",
      kind: "core",
      custom: true,
      tasks: [],
      video: null,
    });
    onCommit?.();
    return id;
  }

  function removeNode(id) {
    const graph = getGraph();
    for (const node of graph.nodes) {
      if ((node.requires ?? []).includes(id)) {
        store.setRequires(node.id, node.requires.filter((r) => r !== id));
      }
    }
    store.removeNode(id);
    onCommit?.();
  }

  scene.svg.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  scene.svg.addEventListener("click", onClick);
  scene.svg.addEventListener("pointermove", onDraftMove);

  function destroy() {
    scene.svg.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    scene.svg.removeEventListener("click", onClick);
    scene.svg.removeEventListener("pointermove", onDraftMove);
  }

  return {
    setEnabled,
    setMode,
    unlink,
    addNode,
    removeNode,
    destroy,
    get mode() {
      return mode;
    },
    get enabled() {
      return enabled;
    },
    isDragging: () => Boolean(drag?.moved),
  };
}
