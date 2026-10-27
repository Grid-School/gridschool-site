/**
 * Boot. Resolve who is looking, load the board, wire the router. Persist writes
 * update chrome and the visible view. They do not remount Today, the map, or a
 * step. Views are plain functions except those three, which keep camera,
 * conversation, and a draft across a flush.
 *
 * The map is home. A fresh board opens on the floor with 00 lit as the beacon;
 * the rule the board runs on is the first paragraph of 00, so there is no
 * interstitial. Routes that used to be surfaces of their own are kept as
 * aliases so links already in the wild still land somewhere true.
 */

import { el, mount, download } from "./dom.js?v=33b0498-202610272054";
import * as store from "./store.js?v=33b0498-202610272054";
import { resolveSlug, slugFromUrl, currentSession, signOut, setPersistToken, inviteFromUrl, persistToken } from "./session.js?v=33b0498-202610272054";
import { tryStoredKey } from "./gate.js?v=33b0498-202610272054";
import { peekInvite } from "./persist-auth.js?v=33b0498-202610272054";
import { createRouter } from "./router.js?v=33b0498-202610272054";
import { createChrome } from "./chrome.js?v=33b0498-202610272054";
import { activeDoor } from "./rail.js?v=33b0498-202610272054";
import { toast } from "./ui.js?v=33b0498-202610272054";
import { isTestSeat } from "./test-seats.js?v=33b0498-202610272054";
import { renderLogin } from "./views/login.js?v=33b0498-202610272054";
import { renderToday } from "./views/today.js?v=33b0498-202610272054";
import { renderMap } from "./views/map.js?v=33b0498-202610272054";
import { renderStep, isStepArgs, moduleIdFromArgs } from "./views/step.js?v=33b0498-202610272054";
import { renderTasks } from "./views/tasks.js?v=33b0498-202610272054";
import { renderCalendar } from "./views/calendar.js?v=33b0498-202610272054";
import { renderLibrary } from "./views/library.js?v=33b0498-202610272054";
import { renderPosts } from "./views/posts.js?v=33b0498-202610272054";
import { renderHire } from "./views/hire.js?v=33b0498-202610272054";
import { renderResume } from "./views/resume.js?v=33b0498-202610272054";
import { renderProfile } from "./views/profile.js?v=33b0498-202610272054";
import { renderSend } from "./views/send.js?v=33b0498-202610272054";
import { renderPath } from "./views/path.js?v=33b0498-202610272054";
import { renderImages } from "./views/images.js?v=33b0498-202610272054";
import { renderStudio } from "./views/studio.js?v=33b0498-202610272054";
import { toggleDevUnlock, setDevUnlock } from "./dev-mode.js?v=33b0498-202610272054";
import { togglePreviewMedia, setPreviewMedia, isPreviewMedia } from "./preview-mode.js?v=33b0498-202610272054";
import { isInstructorDevice } from "./instructor-mode.js?v=33b0498-202610272054";
import { startReminders } from "./reminders.js?v=33b0498-202610272054";
import { watchReviewArrivals } from "./review-arrivals.js?v=33b0498-202610272054";
import { enterView, leaveView } from "./transitions.js?v=33b0498-202610272054";
import { gateRoutes } from "./features.js?v=33b0498-202610272054";
import * as measure from "./measure.js?v=33b0498-202610272054";
import { startTelemetry } from "./telemetry.js?v=33b0498-202610272054";
import { createNextBar } from "./views/next-bar.js?v=33b0498-202610272054";
import { useSeat } from "./next-live.js?v=33b0498-202610272054";
import { PERSIST, isPlaceholder } from "../../config.js?v=33b0498-202610272054";

/* Coach (today) and Posts are gated in features.js: switched off, they are
   not routes at all, so their links land on the Map. */
const VIEWS = gateRoutes({
  today: { render: renderToday, persistent: true },
  map: { render: renderMap, persistent: true },
  tasks: { render: renderTasks },
  calendar: { render: renderCalendar },
  library: { render: renderLibrary },
  posts: { render: renderPosts },
  do: { render: renderHire, persistent: true },
  /* The tools below open from their steps on the map and from the rail's Tools group (rail.js). */
  resume: { render: renderResume, persistent: true },
  profile: { render: renderProfile, persistent: true },
  send: { render: renderSend, persistent: true },
  path: { render: renderPath, persistent: true },
  images: { render: renderImages, persistent: true },
  studio: { render: renderStudio, persistent: true },
});

/** Old links keep working after surfaces folded. */
const ALIASES = {
  reviews: ["today"],
  repos: ["map", "list"],
  work: ["map", "list"],
  coach: ["today"],
  welcome: ["map", "or.start"],
  grid: ["map"],
  search: ["do", "today"],
  hire: ["do", "today"],
  tasks: ["map"],
};

const app = document.getElementById("app");
const instances = new Map();
let chrome = null;
let nextBar = null;
let route = { name: "map", args: [] };
let role = "student";

function resolveRole() {
  const params = new URLSearchParams(location.search);
  if (params.get("admin") === "1" || params.get("dev") === "1") return "admin";
  /* Switched on from the admin console, off from the rail. Chrome only:
     writes still require the ADMIN_TOKEN either way. */
  if (isInstructorDevice()) return "admin";
  return currentSession()?.role ?? "student";
}

function wantsDevUnlock() {
  return new URLSearchParams(location.search).get("dev") === "1";
}

async function adminSurfaceExists() {
  /* GET, not HEAD: the page itself is small, and Chromium aborts HEAD against
     some static servers, which would falsely lock the door in local dev. */
  try {
    return (await fetch("../admin/", { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

function context() {
  return {
    state: store.state(),
    store,
    role,
    navigate: (name, ...args) => router.go(name, ...args),
  };
}

let router = null;
let lastIdentityKey = "";
/** The step page on screen, if any, so leaving it can fade before the map returns. */
let shownStep = null;

function syncChrome() {
  const ctx = context();
  const state = ctx.state;
  // On the resume's step page the rail lights Resume, the door that opens it.
  const onResume = route.name === "map" && route.args[0] && route.args[0] === resumeStep(state.graph)?.id;
  chrome.setActive(onResume ? "resume" : activeDoor(route.name, route.args));
  chrome.setBanner(state);
  chrome.setCall(state);
  chrome.setSignals(state);
  nextBar?.render();
  const identityKey = [
    state.slug,
    state.student.name,
    state.week,
    state.unlockAll ? "1" : "0",
    state.hasLocalEdits ? "1" : "0",
    state.persistStatus?.state ?? "off",
    role,
    isPreviewMedia() ? "1" : "0",
  ].join("|");
  if (identityKey !== lastIdentityKey) {
    chrome.setIdentity(state, role);
    lastIdentityKey = identityKey;
  }
}

/** The map's resume step (the resume-engine module), if this map has one. */
function resumeStep(graph) {
  return (graph?.nodes ?? []).find((node) => String(node.moduleRef ?? "").startsWith("resume-engine")) ?? null;
}

function renderRoute() {
  // The rail's Resume opens the same step page the map does, so the resume never looks two ways.
  if (route.name === "resume" && !route.args.length) {
    const step = resumeStep(store.state().graph);
    if (step) {
      history.replaceState(null, "", `#/map/${step.id}`);
      route = { name: "map", args: [step.id] };
    }
  }
  // Headline, About, photos and the portfolio link live in the "Your LinkedIn" step now: Jobs → Profile opens it.
  if (route.name === "do" && route.args[0] === "profile" && store.state().graph?.byId?.has("b.linkedin")) {
    history.replaceState(null, "", "#/map/b.linkedin");
    route = { name: "map", args: ["b.linkedin"] };
  }
  const view = VIEWS[route.name];
  const ctx = context();
  syncChrome();

  // Full step page: #/map/<nodeId>[/m/...] not a modal over the graph.
  if (route.name === "map" && isStepArgs(route.args, ctx.state.graph)) {
    document.body.dataset.view = "step";
    const nodeId = route.args[0];
    const moduleId = moduleIdFromArgs(route.args);
    const key = `step:${nodeId}:${moduleId ?? ""}`;
    let instance = instances.get(key);
    // Drop other step instances so we do not leak DOM/listeners.
    for (const [id, inst] of instances) {
      if (id.startsWith("step:") && id !== key) {
        inst.destroy?.();
        instances.delete(id);
      }
    }
    if (!instance) {
      instance = renderStep(ctx, nodeId, moduleId);
      instances.set(key, instance);
    } else {
      instance.update(ctx, nodeId, moduleId);
    }
    if (chrome.outlet.firstChild !== instance.node) {
      mount(chrome.outlet, instance.node);
      // The camera has already gone to the node (map.js); the page arrives over it.
      enterView(instance.node);
    }
    shownStep = instance.node;
    document.title = `${ctx.state.graph.byId.get(nodeId)?.title ?? "Step"} · ${ctx.state.student.name} · GridSchool`;
    return;
  }

  // Leaving a step for the floor: the page fades before the map comes back.
  const leaving = shownStep;
  shownStep = null;
  if (leaving && route.name === "map") {
    leaveView(leaving).then(() => {
      if (shownStep === null && route.name === "map") mountRoute(view, ctx);
    });
    return;
  }
  mountRoute(view, ctx);
}

function mountRoute(view, ctx) {
  document.body.dataset.view = route.name;

  if (view.persistent) {
    let instance = instances.get(route.name);
    if (!instance) {
      instance = view.render(ctx, ...route.args);
      instances.set(route.name, instance);
    } else {
      instance.update(ctx, ...route.args);
    }
    // Re-mounting an already-mounted node detaches and re-attaches it, which
    // throws away focus and restarts every transition inside it. The map is
    // persistent precisely so that does not happen.
    if (chrome.outlet.firstChild !== instance.node) mount(chrome.outlet, instance.node);
  } else {
    mount(chrome.outlet, view.render(ctx, ...route.args));
  }

  document.title = `${cap(route.name)} · ${ctx.state.student.name} · GridSchool`;
}

function cap(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Persist writes update chrome and the visible view. They do not remount. */
function onStoreChange() {
  if (!chrome) return;
  syncChrome();
  const ctx = context();
  if (route.name === "map" && isStepArgs(route.args, ctx.state.graph)) {
    const key = `step:${route.args[0]}:${moduleIdFromArgs(route.args) ?? ""}`;
    instances.get(key)?.update(ctx, route.args[0], moduleIdFromArgs(route.args));
    return;
  }
  const view = VIEWS[route.name];
  if (view?.persistent) {
    instances.get(route.name)?.update(ctx, ...route.args);
    return;
  }
  if (view) mount(chrome.outlet, view.render(ctx, ...route.args));
}

function markReady() {
  window.__gsReady = true;
}

async function start() {
  /* Invite or return login injects both secrets. The student never types them.
     Demo stays the public tour: no account, no lesson text on the live site. */
  const invite = inviteFromUrl();
  const signedIn = currentSession();
  if (invite && signedIn?.persistToken && signedIn.slug && signedIn.slug !== "demo") {
    /* A link that still works always wins over a remembered sign-in: that sign-in may be from a paused
       or restored seat, and quietly using it sent people to the login screen with no way forward. A link
       already used means they're in: open the board. */
    let live = false;
    try {
      await peekInvite(invite);
      live = true;
    } catch {
      live = false;
    }
    if (live) {
      signOut();
    } else {
      const url = new URL(location.href);
      url.searchParams.delete("invite");
      url.searchParams.set("s", signedIn.slug);
      location.replace(url);
      return;
    }
  }
  if (invite) {
    renderLogin(app, { invite });
    markReady();
    return;
  }

  const unlocked = await tryStoredKey();
  const slug = resolveSlug();
  // A free seat (opened from the free check) never gets the lesson key: its board runs on the
  // public course copy plus its own map from the server. Paid and residency seats still need the key.
  const freeSeat = !unlocked && Boolean(persistToken()) && currentSession()?.plan === "free" && currentSession()?.slug === slug;

  if (slug !== "demo" && ((!unlocked && !freeSeat) || !persistToken())) {
    renderLogin(app, { email: "" });
    markReady();
    return;
  }

  if (!slug) {
    renderLogin(app);
    markReady();
    return;
  }

  role = resolveRole();
  /* Admin console is excluded from the public deploy. Keep instructor role when
     ?admin=1 or ?dev=1 so Dev unlock still works; only hide the console link. */
  // Inside the console's "Their board" tab (?embed=1) the link back to the console is already around it.
  const embedded = new URLSearchParams(location.search).get("embed") === "1";
  const showAdminConsole = role === "admin" && !embedded && (await adminSurfaceExists());
  if (wantsDevUnlock()) setDevUnlock(true);
  /* ?preview=1 turns on the media preview for an instructor session, so a
     testing link can carry the stand-in clips without touching the rail. */
  if (role === "admin" && new URLSearchParams(location.search).get("preview") === "1") {
    setPreviewMedia(true);
  }

  // Aden viewing a real student's board: their progress is theirs alone.
  store.setProgressReadOnly(role === "admin" && slug !== "demo" && !isTestSeat(slug));
  window.addEventListener("gridschool:progress-readonly", () =>
    toast("View only: this is the student's own progress. Try things on the test seat (aden).", "warn")
  );

  try {
    await store.init(slug, { tour: !unlocked && !freeSeat, publicCopy: freeSeat });
  } catch (error) {
    if (error?.code === "BAD_TOKEN") {
      setPersistToken("");
      renderLogin(app);
      markReady();
      return;
    }
    /* A stored session can outlive its board: signed in on a machine that has
       the private boards, then opened on a host that publishes only the tour.
       That is not the visitor's problem, so drop the session and offer what is
       actually here instead of a dead end. */
    if (!slugFromUrl()) {
      signOut();
      renderLogin(app);
      markReady();
      return;
    }
    mount(
      app,
      el(
        "div.gate",
        {},
        el(
          "div.picker",
          {},
          el("h1", {}, "That board is not on this site"),
          el("p.muted", {}, "The link may be for a private board, or the name may be misspelled."),
          el("p", {}, el("a", { href: "./?s=demo" }, "Open the demo board instead"))
        )
      )
    );
    markReady();
    return;
  }

  // The event log hears the map opened (measure.js): a student on their own seat only.
  measure.enable({ role, slug, test: isTestSeat(slug) });
  measure.mapOpened();
  // How the app is used, click by click (telemetry.js): every signed-in student, test seats included (they're
  // marked on the desk). Never the desk viewing a board, never the demo.
  if (role === "student" && slug && slug !== "demo" && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint)) startTelemetry(PERSIST.endpoint, persistToken);

  chrome = createChrome({
    role,
    showAdminConsole,
    getState: () => store.state(),
    onNavigate: (name, ...args) => router.go(name, ...args),
    onReset: () => {
      store.resetLocalEdits();
      toast("Demo board reset to its saved state.", "warn");
    },
    onExport: () => {
      download(`${slug}.json`, store.exportStudent());
      toast(
        slug === "demo"
          ? "Exported. Drop it in data/students/ to make it real."
          : "Backup downloaded."
      );
    },
    onToggleDev: () => {
      toggleDevUnlock();
      store.refresh();
      toast(
        store.state().unlockAll
          ? "Dev unlock on. All nodes open for reading."
          : "Dev unlock off. Prerequisites gate the map again.",
        "ok"
      );
    },
    onTogglePreview: () => {
      const on = togglePreviewMedia();
      store.refresh();
      toast(
        on
          ? "Media preview on. Unfilmed steps show the test clip on this device."
          : "Media preview off. Unfilmed steps show only what the film covers.",
        "ok"
      );
    },
  });

  mount(app, chrome.root);

  // The one next move, under every screen (views/next-bar.js).
  useSeat(slug);
  nextBar = createNextBar({
    getState: () => store.state(),
    getRoute: () => route,
    navigate: (name, ...args) => router.go(name, ...args),
    onReviewRead: (id) => store.markReviewRead(id),
  });
  chrome.shellMain.append(nextBar.root);

  router = createRouter({
    routes: VIEWS,
    aliases: ALIASES,
    fallback: "map",
    onNavigate: (next) => {
      route = next;
      renderRoute();
      chrome.outlet.focus({ preventScroll: true });
    },
  });

  store.subscribe(onStoreChange);
  // Meeting reminders: an hour and fifteen minutes before every live room.
  startReminders({ getState: () => store.state() });
  // A verdict that lands while the board is open says so once. The instructor
  // is the one returning it, so only the student's side listens.
  if (role !== "admin") watchReviewArrivals(store);

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const shortcuts = { m: "map", c: "calendar" };
    if (shortcuts[event.key]) router.go(shortcuts[event.key]);
  });

  router.start();
  markReady();
}

start().catch((error) => {
  console.error(error);
  window.showBootFailure?.(error);
});
