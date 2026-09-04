/**
 * Boot. Resolve who is looking, load the board, wire the router. Persist writes
 * update chrome and the visible view. They do not remount Today, the map, or a
 * step. Views are plain functions except those three, which keep camera,
 * conversation, and a draft across a flush.
 *
 * There are two doors — Today and the Grid — plus two tools reached by name. The
 * routes that used to be surfaces of their own are kept as aliases so links
 * already in the wild still land somewhere true.
 */

import { el, mount, download } from "./dom.js";
import * as store from "./store.js";
import { resolveSlug, slugFromUrl, currentSession, signOut, setPersistToken, inviteFromUrl, persistToken } from "./session.js";
import { tryStoredKey } from "./gate.js";
import { createRouter } from "./router.js";
import { createChrome } from "./chrome.js";
import { toast } from "./ui.js";
import { renderLogin } from "./views/login.js";
import { renderToday } from "./views/today.js";
import { renderMap } from "./views/map.js";
import { renderStep, isStepArgs, moduleIdFromArgs } from "./views/step.js";
import { renderTasks } from "./views/tasks.js";
import { renderCalendar } from "./views/calendar.js";
import { renderLibrary } from "./views/library.js";
import { renderFirstRun, shouldOpenFirstRun } from "./views/first-run.js";
import { toggleDevUnlock, setDevUnlock } from "./dev-mode.js";
import { startReminders } from "./reminders.js";

const VIEWS = {
  today: { render: renderToday, persistent: true },
  map: { render: renderMap, persistent: true },
  tasks: { render: renderTasks },
  calendar: { render: renderCalendar },
  library: { render: renderLibrary },
  welcome: { render: renderFirstRun },
};

/** Old links keep working after surfaces folded. */
const ALIASES = {
  reviews: ["today"],
  repos: ["map", "list"],
  work: ["map", "list"],
  coach: ["today"],
  grid: ["map"],
};

const app = document.getElementById("app");
const instances = new Map();
let chrome = null;
let route = { name: "map", args: [] };
let role = "student";

function resolveRole() {
  const params = new URLSearchParams(location.search);
  if (params.get("admin") === "1" || params.get("dev") === "1") return "admin";
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

function syncChrome() {
  const ctx = context();
  const state = ctx.state;
  chrome.setActive(route.name === "map" ? "map" : route.name);
  chrome.setBanner(state);
  chrome.setSignals(state);
  const identityKey = [
    state.slug,
    state.student.name,
    state.week,
    state.unlockAll ? "1" : "0",
    state.hasLocalEdits ? "1" : "0",
    state.persistStatus?.state ?? "off",
    role,
  ].join("|");
  if (identityKey !== lastIdentityKey) {
    chrome.setIdentity(state, role);
    lastIdentityKey = identityKey;
  }
}

function renderRoute() {
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
    if (chrome.outlet.firstChild !== instance.node) mount(chrome.outlet, instance.node);
    document.title = `${ctx.state.graph.byId.get(nodeId)?.title ?? "Step"} · ${ctx.state.student.name} · GridSchool`;
    return;
  }

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

async function start() {
  /* Invite or return login injects both secrets. The student never types them.
     Demo stays the public tour: no account, no lesson text on the live site. */
  const invite = inviteFromUrl();
  if (invite) {
    renderLogin(app, { invite });
    return;
  }

  const unlocked = await tryStoredKey();
  const slug = resolveSlug();

  if (slug !== "demo" && (!unlocked || !persistToken())) {
    renderLogin(app, { email: "" });
    return;
  }

  if (!slug) {
    renderLogin(app);
    return;
  }

  role = resolveRole();
  /* Admin console is excluded from the public deploy. Keep instructor role when
     ?admin=1 or ?dev=1 so Dev unlock still works; only hide the console link. */
  const showAdminConsole = role === "admin" && (await adminSurfaceExists());
  if (wantsDevUnlock()) setDevUnlock(true);

  try {
    await store.init(slug, { tour: !unlocked });
  } catch (error) {
    if (error?.code === "BAD_TOKEN") {
      setPersistToken("");
      renderLogin(app);
      return;
    }
    /* A stored session can outlive its board: signed in on a machine that has
       the private boards, then opened on a host that publishes only the tour.
       That is not the visitor's problem, so drop the session and offer what is
       actually here instead of a dead end. */
    if (!slugFromUrl()) {
      signOut();
      renderLogin(app);
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
    return;
  }

  chrome = createChrome({
    role,
    showAdminConsole,
    onNavigate: (name) => router.go(name),
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
  });

  mount(app, chrome.root);

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

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const shortcuts = { m: "map", k: "tasks", c: "calendar" };
    if (shortcuts[event.key]) router.go(shortcuts[event.key]);
  });

  // A first-time board opens on the first twenty minutes, not on a dashboard.
  // Nobody's first question is "which of these five things should I click".
  // Setting the hash is what starts the router in that case.
  if (!location.hash && shouldOpenFirstRun(slug, store.state())) location.hash = "#/welcome";
  else router.start();
}

start();
