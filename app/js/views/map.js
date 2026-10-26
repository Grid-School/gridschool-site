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

import { el, mount } from "../dom.js?v=939d963-202610261500";
import { btn, toast } from "../ui.js?v=939d963-202610261500";
import { createScene3d } from "../graph/scene3d/index.js?v=939d963-202610261500";
import { createRezScene } from "../graph/rez/index.js?v=939d963-202610261500";
import { STATUS, nextUp, progress, visibleGraph, stepNumber } from "../graph/model.js?v=939d963-202610261500";
import { STANDING, STANDING_LABEL, standingOf } from "../graph/standing.js?v=939d963-202610261500";
import { icon } from "../icons.js?v=939d963-202610261500";
import { trackLabel } from "../copy.js?v=939d963-202610261500";
import { mapList } from "./map-list.js?v=939d963-202610261500";
import { dueLabel } from "./from-aden.js?v=939d963-202610261500";
import { createGridState, hashFor, RESERVED_ARGS, VIEW } from "./grid-state.js?v=939d963-202610261500";
import { lockNotice, shouldInterceptLock } from "./lock-notice.js?v=939d963-202610261500";
import { isProgressReadOnly } from "../store.js?v=939d963-202610261500";
import { doneForYou, nextMove, movesAfterNext, isTypedMap } from "../engine.js?v=939d963-202610261500";
import { matchedRoles, fetchPacks, radarReady } from "../roles-remote.js?v=939d963-202610261500";
import { careerOf } from "../search.js?v=939d963-202610261500";
import { isoDate } from "../time.js?v=939d963-202610261500";
import { routeGraph, isLandmark } from "../graph/route.js?v=939d963-202610261500";
import { isFreeMap, upgradeHref } from "../prep.js?v=939d963-202610261500";
import { createSuggest } from "./suggest.js?v=939d963-202610261500";

/** Top clears the bar, right the control stack, bottom the next-step card. */
const INSETS = { top: 64, right: 72, bottom: 96, left: 40 };

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
  // The control stack rides just above the next-step card, however tall it wraps.
  const nextbarSize = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => canvas.style.setProperty("--nextbar-h", `${nextCard.hidden ? 0 : nextCard.offsetHeight}px`))
    : null;
  nextbarSize?.observe(nextCard);
  const root = el("div.mapview", {}, canvas, list, lockFloat);

  let current = ctx;
  let signature = "";

  // Suggest changes (views/suggest.js): the student's own suggestion drawn on this map.
  const suggest = createSuggest({ ctx: () => current, redraw: () => draw() });
  canvas.append(...suggest.elements);

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
    // A Complete step's hint (prep.js) is drawn text too: a stage moved on the desk redraws it.
    // A suggested change (a rename, a mark) is drawn text too.
    return graph.nodes.map((n) => `${n.id}:${n.n}:${(n.requires ?? []).join(",")}${n.hint ? `:${n.hint}` : ""}`).join("|") + suggest.signature();
  }

  /*
   * A Complete or free map draws as one route (graph/route.js). On a free map the folded
   * question steps open in place, and "See the full plan" previews the done-for-you steps
   * as the paid plan shows them. Both are this view's own state, never saved.
   */
  let foldOpen = false;
  let fullPlan = false;

  /** A student sees the spine, what they picked and what is on offer. */
  const shown = () => routeGraph(visibleGraph(boardGraph()), { foldOpen, fullPlan });
  /** The live map, or the student's suggestion drawn on it while they're suggesting. */
  const boardGraph = () => suggest.graph() ?? current.state.graph;

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

  /**
   * The map node that holds the next move, on a typed map: the step itself, or
   * the campaign node whose touch is due. Null when the move isn't a node
   * (a booked conversation, someone inside), which then shows as one pin.
   */
  function nextNodeId(next) {
    if (next.stepId) return next.stepId;
    if (next.targetId) return current.state.graph.nodes.find((node) => node.campaign === next.targetId)?.id ?? null;
    return null;
  }

  function paintOptions(extra = {}) {
    const graph = current.state.graph;
    if (!hasBand()) return { nextId: nextUp(graph)?.id ?? null, ...extra };
    if (isTypedMap(graph)) {
      // One road: every move is a node, so nothing floats beside it. The white
      // ring sits on the node the bottom bar names.
      const next = move();
      const onNode = nextNodeId(next);
      const pin = onNode ? [] : [{ title: next.title, tag: next.fed ? TAG[next.fed] : null, tool: next.tool, lane: next.lane, isNext: true }];
      return { nextId: onNode ?? nextUp(graph)?.id ?? null, ready: { items: pin }, onTool: (tool) => current.navigate("do", tool), ...extra };
    }
    return { nextId: nextUp(graph)?.id ?? null, ready: readyNodes(), onTool: (tool) => current.navigate("do", tool), ...extra };
  }

  /** Aden's current work for them, as a plain sentence under the top bar. */
  function renderAden() {
    const item = (careerOf(current.state.student).working ?? []).find((w) => !w.done && w.text);
    adenLine.hidden = !hasBand() || isList() || !item || suggest.isOn();
    if (item) mount(adenLine, el("span.adenline__dot", { "aria-hidden": "true" }), el("span", {}, `Your coach is working on: ${item.text}`));
  }

  /** The bottom bar: the one next move, docked, so it never covers the map. Agrees with the white ring. */
  function renderNext() {
    if (!hasBand() || isList() || suggest.isOn()) {
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
        label: next.stepId ? "Open the step" : next.targetId ? "Open the campaign" : "Open",
        variant: "solid",
        onclick: () => (next.stepId ? current.navigate("map", next.stepId) : next.targetId ? current.navigate("do", "targets", next.targetId) : current.navigate("do", next.tool)),
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
          if (!world.dataset.suggest) {
            world.dataset.suggest = "1";
            suggest.attach(world);
          }
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
        // Editing marks (task dots, ×, names to rename) ride on the steps while editing, and come off after.
        suggest.decorate(made.nodeEls);
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

  /** What a landmark says when it's tapped: it's not a step, so it opens nothing. */
  const LANDMARK_LINE = {
    _scan: "You took the free scan. Your map starts one step in.",
    _goal: "Where this route leads: interviews.",
  };

  function openNode(id) {
    // Suggesting changes: a tap opens what can be changed about the step, not the step.
    if (!isList() && suggest.tap(id)) return;
    if (isLandmark(id)) {
      if (id === "_more") {
        foldOpen = true;
        draw();
        return;
      }
      if (id === "_waiting") return openNode("f.sample");
      // The rest of the course: open its first locked step, which says what it is and how to get it.
      if (id === "_course") {
        const first = current.state.graph.nodes.find((node) => node.course && node.paidOnly);
        if (first) return openNode(first.id);
      }
      setStatus(LANDMARK_LINE[id] ?? null);
      return;
    }
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
        // Editing: no tracing, so the map never dims around a step being dragged or changed.
        if (!suggest.isOn()) painter({ tracingId: id });
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

  function iconBtn(name, label, onclick) {
    return el("button.mapctl", { type: "button", title: label, "aria-label": label, onclick }, icon(name));
  }

  function renderHud() {
    const { graph } = current.state;
    const prog = progress(graph);
    const free = isFreeMap(graph);
    const planSwitch = free
      ? el(
          "button.planswitch",
          {
            type: "button",
            role: "switch",
            "aria-checked": String(fullPlan),
            class: fullPlan ? "is-on" : null,
            onclick: () => {
              fullPlan = !fullPlan;
              draw();
            },
          },
          el("i.planswitch__track", { "aria-hidden": "true" }, el("i.planswitch__knob")),
          "See the full plan"
        )
      : null;
    const startPlan = free && fullPlan ? btn({ label: "Start the full plan", variant: "solid", href: upgradeHref(graph, null, { demo: current.state.slug === "demo" }) }) : null;

    // Map controls, the way every map app does them: a small stack in the corner, icons, no words.
    // The map frames itself when it opens; scroll or pinch zooms; the crosshair brings you back to your step.
    const controls = [
      iconBtn("locate", "Back to your step", () => standHere(shown(), { glide: true })),
      iconBtn("zoomin", "Zoom in", () => floor?.zoomBy(1.25)),
      iconBtn("zoomout", "Zoom out", () => floor?.zoomBy(0.8)),
    ];
    mount(
      hudTop,
      el(
        "div.hud__group",
        {},
        modeToggle(),
        planSwitch,
        startPlan,
        // A personal map has no elective depth; "No depth picked yet" would
        // read as a choice the student cannot make.
        hasDepth(graph, prog) ? el("span.hud__depth", {}, depthLine(prog.depth)) : null,
        prog.side.total ? el("span.hud__side", {}, `Side quests ${prog.side.lit} of ${prog.side.total}`) : null
      ),
      el(
        "div.hud__group",
        {},
        hasBand() && !free && suggest.ready() && !isList()
          ? el(
              "button.b.b--ghost.hud__suggest",
              {
                type: "button",
                class: suggest.isOn() ? "is-on" : null,
                "aria-pressed": String(suggest.isOn()),
                title: "Propose steps, tasks or changes. Your coach reviews them before your map changes.",
                onclick: () => suggest.setOn(!suggest.isOn()),
              },
              suggest.isOn() ? "Done editing" : "Edit my map"
            )
          : null
      )
    );

    // What each mark means is written on the map itself (YOU ARE HERE, each step's tag), so there is no legend.
    mount(hudSide, ...controls);

    setStatus(null);
    renderNext();
    renderAden();
    suggest.render();
    suggest.renderCard();
    invite.hidden = true;
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
    if (LANDMARK_LINE[id]) return LANDMARK_LINE[id];
    const graph = boardGraph();
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

  /* ---------- lifecycle ---------- */

  requestAnimationFrame(() => {
    syncHash();
    draw();
  });
  // Don't wait for a frame: what's ready starts loading the moment the map mounts.
  void loadLive();
  void suggest.refresh();

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
      nextbarSize?.disconnect();
      suggest.detach();
      floor?.destroy();
    },
  };
}
