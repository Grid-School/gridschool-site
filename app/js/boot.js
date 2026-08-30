/**
 * Boot. Resolve who is looking, load the board, wire the router, and re-render
 * on every state change. Views are plain functions except the map and Today,
 * which keep camera and conversation across navigation.
 *
 * There are two doors — Today and the Grid — plus three tools reached by name. The
 * routes that used to be surfaces of their own are kept as aliases so links
 * already in the wild still land somewhere true.
 */

import { el, mount, download } from "./dom.js";
import * as store from "./store.js";
import { resolveSlug, slugFromUrl, currentSession, signOut } from "./session.js";
import { tryStoredKey, unlock } from "./gate.js";
import { createRouter } from "./router.js";
import { createChrome } from "./chrome.js";
import { toast } from "./ui.js";
import { renderPicker } from "./views/picker.js";
import { renderToday } from "./views/today.js";
import { renderMap } from "./views/map.js";
import { renderStep, isStepArgs, moduleIdFromArgs } from "./views/step.js";
import { renderTasks } from "./views/tasks.js";
import { renderCalendar } from "./views/calendar.js";
import { renderLibrary } from "./views/library.js";
import { renderFirstRun, shouldOpenFirstRun } from "./views/first-run.js";

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
let route = { name: "today", args: [] };
let role = "student";

function resolveRole() {
  const params = new URLSearchParams(location.search);
  if (params.get("admin") === "1") return "admin";
  return currentSession()?.role ?? "student";
}

function renderGate() {
  const input = el("input", {
    type: "password",
    id: "gate-key",
    placeholder: "Access key",
    autocomplete: "current-password",
    style: "width:100%;font:inherit;font-size:15px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:11px 13px;",
  });
  const err = el("p", { style: "color:#ff9d9d;font-size:13px;margin-top:8px;", hidden: true }, "That key does not open this. Check for typos, or ask Aden.");
  const form = el(
    "form",
    {
      style: "margin-top:14px",
      onsubmit: async (event) => {
        event.preventDefault();
        try {
          await unlock(input.value);
          location.reload();
        } catch {
          err.hidden = false;
          input.select();
        }
      },
    },
    el("label", { for: "gate-key", style: "display:block;font-size:14px;margin-bottom:6px;color:var(--text)" }, "Your access key"),
    input,
    err,
    el("button.b.b--solid", { type: "submit", style: "margin-top:12px" }, "Open the platform")
  );

  mount(
    app,
    el(
      "div.gate",
      {},
      el(
        "div.picker",
        {},
        el("h1", {}, "Student access"),
        el("p.muted", {}, "The platform and its lessons are part of the program. You receive your access key when you enroll."),
        form,
        el(
          "p.picker__foot",
          {},
          "Not a student yet? ",
          el("a", { href: "./?s=demo" }, "Walk the demo board"),
          " or ",
          el("a", { href: "../#offer" }, "see what you get"),
          "."
        )
      )
    )
  );
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

function renderRoute() {
  const view = VIEWS[route.name];
  const ctx = context();

  chrome.setActive(route.name === "map" ? "map" : route.name);
  chrome.setIdentity(ctx.state, role);
  chrome.setBanner(ctx.state);
  chrome.setSignals(ctx.state);

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

async function start() {
  /* On the live site the curriculum ships encrypted; the lessons render only
     after the access key. The demo board is the one exception: it walks the
     whole platform on the public tour copy (no lesson text), because the
     walkable platform is the proof the school is real. Local development has
     the plaintext and skips all of this. */
  const unlocked = await tryStoredKey();
  const slug = resolveSlug();

  if (!unlocked && slug !== "demo") {
    renderGate();
    return;
  }

  if (!slug) {
    renderPicker(app);
    return;
  }

  role = resolveRole();
  /* The console is not published on the public site. If the admin surface is
     not actually there, the role is theater plus a dead button — degrade to
     student instead of rendering a door that 404s. */
  if (role === "admin" && !(await adminSurfaceExists())) role = "student";

  try {
    await store.init(slug, { tour: !unlocked });
  } catch {
    /* A stored session can outlive its board: signed in on a machine that has
       the private boards, then opened on a host that publishes only the tour.
       That is not the visitor's problem, so drop the session and offer what is
       actually here instead of a dead end. */
    if (!slugFromUrl()) {
      signOut();
      renderPicker(app);
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
          el("p", {}, el("a", { href: "./" }, "Open the demo board instead"))
        )
      )
    );
    return;
  }

  chrome = createChrome({
    onNavigate: (name) => router.go(name),
    onReset: () => {
      store.resetLocalEdits();
      toast("Demo board reset to its saved state.", "warn");
    },
    onExport: () => {
      download(`${slug}.json`, store.exportStudent());
      toast("Exported. Drop it in data/students/ to make it real.");
    },
  });

  mount(app, chrome.root);

  router = createRouter({
    routes: VIEWS,
    aliases: ALIASES,
    fallback: "today",
    onNavigate: (next) => {
      route = next;
      renderRoute();
      chrome.outlet.focus({ preventScroll: true });
    },
  });

  store.subscribe(() => renderRoute());

  window.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const shortcuts = { t: "today", m: "map", k: "tasks", c: "calendar" };
    if (shortcuts[event.key]) router.go(shortcuts[event.key]);
  });

  // A first-time board opens on the first twenty minutes, not on a dashboard.
  // Nobody's first question is "which of these five things should I click".
  // Setting the hash is what starts the router in that case.
  if (!location.hash && shouldOpenFirstRun(slug, store.state())) location.hash = "#/welcome";
  else router.start();
}

start();
