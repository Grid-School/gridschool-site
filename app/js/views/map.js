/**
 * The map. A navigable graph of the whole path, the node room you walk into when
 * you click one, and the same nodes as a list when you want the links rather
 * than the shape. This view is stateful on purpose: the camera must survive a
 * state change so submitting evidence does not throw you back to a fit view.
 *
 * `#/map` is the graph, `#/map/list` is the list, `#/map/<nodeId>` opens a room.
 * "list" is a reserved argument; node ids come from the curriculum.
 *
 * What is on screen is held in one place — `grid-state.js`. This file never
 * keeps its own copy of "which room is open"; it reads that value, renders it,
 * and sends events back. The URL is written from the same value, which is why
 * arriving at `#/map` can no longer leave a room open with nothing to close it.
 */

import { el, mount } from "../dom.js";
import { btn, placeholder, toast, field } from "../ui.js";
import { createModal } from "../modal.js";
import { createScene, renderScene, paint, syncPositions } from "../graph/scene.js";
import { createCamera } from "../graph/camera.js";
import { createEditor } from "../graph/editor.js";
import { applyLayout, bounds } from "../graph/layout.js";
import { STATUS, nextUp, progress, blockedBy } from "../graph/model.js";
import { taskRow } from "./parts.js";
import { statusLabel, LAW } from "../copy.js";
import { videoCard, resolveMedia } from "./video.js";
import { mapList } from "./map-list.js";
import { handoffDisclosure } from "./handoff.js";
import { TASK_STATE } from "../tasks.js";
import { createGridState, hashFor, VIEW } from "./grid-state.js";

/** Right side clears the control column, top clears the legend bar. */
const INSETS = { top: 76, right: 132, bottom: 72, left: 150 };
/** Same breakpoint the stylesheet uses to move the controls. */
const NARROW = 900;

/** Every step shows a player. Extra or unfinished nodes get the CDN test clip until filmed. */
const FALLBACK_VIDEO = {
  title: "Stream test · Big Buck Bunny (CC)",
  mins: 1,
  path: "test-bbb",
  watchWhen: "Test clip on our CDN. Play, scrub, and switch quality. Real lesson films replace this.",
};

export function renderMap(ctx, initialArg) {
  const svg = el("svg.map", {
    id: "gridmap",
    role: "application",
    "aria-label": "Your Defense Path",
  });
  const hudTop = el("div.hud.hud--top");
  const hudSide = el("div.hud.hud--side");
  const status = el("div.hud.hud--status", { role: "status" });
  const room = createModal({
    label: "Node detail",
    size: "fill",
    // Escape and the scrim ask; the machine decides. One route out, always.
    onClose: () => ui.close(),
  });
  // Two projections of one thing, so they live in one view and swap in place.
  const canvas = el("div.view.view--map", {}, svg, hudTop, hudSide, status, room.layer);
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
      // A room that opened under the pointer swallowed the pointerup. Leave the
      // camera idle on the way out or the board reads as stuck mid-drag.
      if (previous.room && !next.room) camera.release();
      draw({
        // Coming back to the board from the list re-frames it once it is visible.
        refit: next.view !== previous.view && next.view === VIEW.GRID,
        reveal: next.room && next.room !== previous.room ? next.room : null,
      });
    },
  });

  const selected = () => ui.state.room;
  const isList = () => ui.state.view === VIEW.LIST;

  /**
   * The hash is written from state, never read back into it mid-flight, and
   * always with replaceState: opening a panel is not a page you should have to
   * press Back through, and a queued hashchange is what let the URL and the
   * board disagree in the first place.
   */
  function syncHash() {
    const target = hashFor(ui.state);
    if (location.hash === target) return;
    history.replaceState(null, "", `${location.pathname}${location.search}${target}`);
  }

  /**
   * A room the student did not click — Next, a blocker, a deep link — may belong
   * to a node parked off screen. Bring it into view with no glide, because the
   * panel grows out of where the node actually is right now.
   */
  function revealRoom(id) {
    if (isList()) return;
    const node = current.state.graph.byId.get(id);
    if (node && !camera.isVisible(node, 40)) camera.centerOn(node, { animate: false, insets: INSETS });
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
          onOpenNode: (id) => ui.open(id),
        })
      );
    }

    // The camera moves before the room is built. The panel grows out of its
    // node's position on screen, so that position has to be final first — and
    // the canvas has to be visible, or the fit measures a hidden element and
    // lands nowhere.
    if (refit && !isList()) frameBoard({ animate: false });
    if (reveal) revealRoom(reveal);

    renderHud();
    renderRoom();
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
        ui.toggle(id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          ui.toggle(id);
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
    ui.close();
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
        el("b.hud__count", {}, `${prog.lit} of ${prog.total} done`),
        el("span.hud__law", {}, LAW)
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
          if (target) ui.open(target.id);
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
              ui.close();
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
            ui.open(id);
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

  /* ---------- the node room ---------- */

  /**
   * The room is a projection of one value, not something that gets opened and
   * closed by whoever is nearby. If the machine holds no room, the panel is
   * shut — there is no branch in which the two can disagree.
   */
  function renderRoom() {
    const { graph, student } = current.state;
    const node = selected() ? graph.byId.get(selected()) : null;
    room.setOpen(Boolean(node), {
      content: node ? nodeRoom(node, graph, student) : null,
      origin: node ? camera.toScreen(node) : null,
    });
  }

  function roomEyebrow(node, graph) {
    const family = (graph.families ?? []).find((item) => item.id === node.family);
    const weeks = Array.isArray(node.weeks) && node.weeks.length
      ? ` · week ${node.weeks[0] === node.weeks[1] ? node.weeks[0] : `${node.weeks[0]}–${node.weeks[1]}`}`
      : "";
    return `${family?.label ?? "Step"} · ${String(node.n).padStart(2, "0")} · ${statusLabel(node.status)}${weeks}`;
  }

  /**
   * One sequence. Teach first, then do, then turn in. No side column.
   *   1. Video
   *   2. Reading + checklist
   *   3. The link they produce
   */
  function nodeRoom(node, graph, student) {
    const isAdmin = current.role === "admin";
    const blockers = blockedBy(graph, node.id);
    const canTurnIn = node.status === STATUS.OPEN || node.status === STATUS.LIT;
    const video = resolveMedia(node.video) ? node.video : FALLBACK_VIDEO;

    return el(
      "div.room",
      {},
      el(
        "header.room__head",
        {},
        el(
          "div",
          {},
          el("b.eyebrow", {}, roomEyebrow(node, graph)),
          el("h2.room__title", {}, node.title)
        ),
        el("button.room__close", { type: "button", "aria-label": "Close this step", onclick: () => ui.close() }, "×")
      ),
      el(
        "div.room__video",
        {},
        el("b.eyebrow", {}, "Watch this first"),
        el("p.room__vidtitle", {}, `${video.title} · ${video.mins} min`),
        videoCard({
          title: video.title,
          mins: video.mins,
          youtube: video.youtube,
          path: video.path,
          thumb: video.thumb,
          watchWhen: video.watchWhen ?? "Watch this, then do the steps.",
          startOpen: true,
        })?.node
      ),
      el(
        "div.room__read.room__copy",
        {},
        el("b.eyebrow", {}, "Read this"),
        node.why && el("p.room__why", {}, node.why),
        node.reading && el("p.room__reading", {}, node.reading)
      ),
      /* The lesson: the node's teaching, complete enough that the video is a
         luxury rather than a requirement. Authored in curriculum.json. On the
         public tour the text is stripped, and this says so instead of hiding it. */
      node.lesson?.length
        ? el(
            "div.room__lesson.room__copy",
            {},
            el("b.eyebrow", {}, "Understand this"),
            node.lesson.map((section) =>
              el(
                "section.lesson__sec",
                {},
                section.h && el("h3", {}, section.h),
                (section.p ?? []).map((paragraph) => el("p", {}, paragraph))
              )
            )
          )
        : node.lessonLocked
          ? el(
              "div.room__lesson.room__copy",
              {},
              el("b.eyebrow", {}, "Understand this"),
              el(
                "p.room__hint",
                {},
                "The full lesson text lives here. It is part of the program and unlocks with the access key you receive at enrollment. The tasks and the done-when below are real; only the teaching is held back."
              )
            )
          : null,
      node.kind === "future"
        ? el("div.room__copy", {}, placeholder({
            title: "Not open yet",
            note: node.coming,
            when: "You can still watch. The work opens when this step does.",
          }))
        : null,
      node.tasks?.length
        ? el(
            "div.room__tasks.room__copy",
            {},
            el("b.eyebrow", {}, "Do this"),
            el("p.room__hint", {}, "Check a box when you finish it. Open Show steps only if you want the how-to."),
            el(
              "div.tasks.tasks--tight",
              {},
              node.tasks.map((task) =>
                taskRow(
                  { ...task, nodeId: node.id, nodeN: node.n, nodeTitle: node.title, state: student.tasks?.[task.id]?.state ?? TASK_STATE.TODO },
                  { store: current.store, navigate: current.navigate }
                )
              )
            )
          )
        : null,
      el(
        "div.room__out.room__copy",
        {},
        el("b.eyebrow", {}, "Turn this in"),
        el("p.room__done", {}, el("b", {}, "Done when "), node.evidence),
        blockers.length
          ? el(
              "div.room__blocked",
              {},
              el("p.room__hint", {}, "This step stays locked until the ones below are done. Clicking one opens that step."),
              el(
                "div.room__prereqs",
                {},
                blockers.map((blocker) =>
                  el(
                    "button.room__goto",
                    { type: "button", onclick: () => ui.open(blocker.id) },
                    `Go to ${String(blocker.n).padStart(2, "0")} · ${blocker.title}`
                  )
                )
              )
            )
          : null,
        canTurnIn && node.status === STATUS.LIT ? litBlock(node) : null,
        canTurnIn ? evidenceForm(node) : null,
        canTurnIn
          ? el(
              "div.room__handoff",
              {},
              handoffDisclosure({ store: current.store, node, label: "Send for review" }),
              reviewsFor(node)
            )
          : null
      ),
      isAdmin ? el("div.room__copy", {}, adminBlock(node, graph)) : null
    );
  }

  /** What this node has already been through with me. */
  function reviewsFor(node) {
    const reviews = (current.state.student.reviews ?? []).filter((review) => review.nodeId === node.id);
    if (!reviews.length) return null;
    return el(
      "div.room__rvs",
      {},
      reviews.map((review) =>
        el(
          "div.rv",
          { class: `rv--${review.state}` },
          el(
            "div.rv__head",
            {},
            el("b", {}, review.title),
            el("span.rv__state", {}, review.state === "returned" ? "returned" : "in review")
          ),
          review.verdict && el("p.rv__verdict", {}, review.verdict)
        )
      )
    );
  }

  function litBlock(node) {
    return el(
      "div.room__lit",
      {},
      el("b.eyebrow", {}, "Your link"),
      el("a.room__link", { href: node.proof?.url ?? "#", target: "_blank", rel: "noopener" }, node.proof?.url ?? "evidence"),
      node.proof?.note && el("p.room__note", {}, node.proof.note),
      node.proof?.at && el("span.room__at", {}, `attached ${node.proof.at}`)
    );
  }

  function evidenceForm(node) {
    const url = field({
      label: "The link",
      id: `ev-url-${node.id}`,
      type: "url",
      value: node.proof?.url ?? "",
      placeholder: "https://",
      hint: "Paste the link. That is what marks this step done.",
    });
    const note = field({
      label: "What should I look at",
      id: `ev-note-${node.id}`,
      value: node.proof?.note ?? "",
      placeholder: "What should I look at hardest?",
      textarea: true,
    });

    return el(
      "form.room__form",
      {
        onsubmit: (event) => {
          event.preventDefault();
          const value = url.input.value.trim();
          if (!/^https?:\/\/.+/.test(value)) {
            toast("That needs to be a URL a stranger can open.", "warn");
            return;
          }
          current.store.submitEvidence(node.id, value, note.input.value.trim());
          toast(`Step ${String(node.n).padStart(2, "0")} saved.`);
        },
      },
      url.node,
      note.node,
      el(
        "div.room__acts",
        {},
        btn({ label: node.status === STATUS.LIT ? "Update the link" : "Save the link", variant: "solid", type: "submit" }),
        node.status === STATUS.LIT &&
          btn({
            label: "Remove the link",
            variant: "quiet",
            onclick: (event) => {
              event.preventDefault();
              current.store.clearEvidence(node.id);
              toast("Link removed.", "warn");
            },
          })
      )
    );
  }

  function adminBlock(node, graph) {
    return el(
      "div.room__admin",
      {},
      el("b.eyebrow", {}, "Instructor only"),
      el(
        "div.room__chips",
        {},
        (node.requires ?? []).map((id) => {
          const req = graph.byId.get(id);
          return el(
            "span.chip2",
            {},
            req ? `${String(req.n).padStart(2, "0")} ${req.title}` : id,
            el(
              "button.chip2__x",
              { type: "button", "aria-label": `Remove ${id} as a prerequisite`, onclick: () => editor.unlink(node.id, id) },
              "×"
            )
          );
        }),
        !(node.requires ?? []).length && el("span.muted", {}, "no prerequisites")
      ),
      node.custom &&
        btn({
          label: "Delete this node",
          variant: "danger",
          onclick: () => {
            if (!confirm(`Delete "${node.title}" from this board?`)) return;
            editor.removeNode(node.id);
            signature = "";
            ui.close();
          },
        })
    );
  }

  /* ---------- lifecycle ---------- */

  requestAnimationFrame(() => {
    syncHash();
    draw({ refit: true, reveal: ui.state.room });
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
      const before = ui.state;
      ui.route(arg);
      if (ui.state !== before) return; // the transition already redrew and rewrote the hash
      // No transition: either a plain data change, or a URL the machine refused
      // — a node id that is not on this board. Either way the hash is corrected
      // back to what is actually on screen.
      syncHash();
      draw();
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      camera.destroy();
      editor.destroy();
      room.destroy();
    },
  };
}
