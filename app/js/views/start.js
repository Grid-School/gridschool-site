/**
 * Start here (server/start_step.py, node s.start): the parts of the first step that aren't plain tasks.
 *
 * - startBlock, above the tasks: the welcome film when LINKS.welcomeVideo is set (hidden while it is a
 *   placeholder), and the community door. The button goes to the server's /community route, which
 *   redirects to the invite held in its COMMUNITY_INVITE env (server/community_link.py), so the invite
 *   never sits in the page. Until that is set the route answers 404, and the step says the invite is on
 *   its way instead of showing a broken link.
 * - startFinish, under the tasks: "I'm in", which checks every task on the step (the weekly time has to
 *   be picked first) and so marks the step done.
 */

import { el } from "../dom.js?v=6ba739d-202610272145";
import { btn, toast } from "../ui.js?v=6ba739d-202610272145";
import { LINKS, CHANNELS, PERSIST, link, isPlaceholder } from "../../../config.js?v=6ba739d-202610272145";
import { withSavedState, taskIsComplete } from "../task-state.js?v=6ba739d-202610272145";

export const START_ID = "s.start";
export const ON_ITS_WAY = "Your invite is on its way. The button shows up here once it's ready.";

/** The public community door: LINKS.community once set, else the server's own /community route. */
export function communityHref(links = LINKS, persist = PERSIST) {
  return isPlaceholder(links.community) ? `${persist.endpoint}/community` : links.community;
}

/**
 * Is the invite set? A 302 from /community (an opaque redirect to a manual-redirect fetch) means yes;
 * a 404, an error or no answer means not yet. Asked once per page load.
 */
let asked = null;
export function inviteReady(fetcher = globalThis.fetch, href = communityHref()) {
  if (!asked) {
    asked = Promise.resolve()
      .then(() => fetcher(href, { redirect: "manual", cache: "no-store", credentials: "omit" }))
      .then((res) => res?.type === "opaqueredirect" || (res?.status >= 300 && res?.status < 400))
      .catch(() => false);
  }
  return asked;
}
export function forgetInvite() {
  asked = null;
}

/** The rooms worth naming, from config CHANNELS, when it exists. */
export function roomLines(channels = CHANNELS) {
  return Object.values(channels ?? {})
    .filter((room) => room?.name && room?.purpose)
    .map((room) => `${room.name}: ${room.purpose}.`);
}

/**
 * What "I'm in" writes: every task on the step, done, with the weekly time kept. `picked` is the choice
 * on the page right now (it wins over a saved one). Returns { missing } when a required answer is empty.
 */
export function imInChanges(node, student, picked = {}) {
  const changes = [];
  for (const task of node?.tasks ?? []) {
    const saved = withSavedState(task, student);
    const answers = { ...saved.answers };
    for (const field of task.fields ?? []) {
      const value = String(picked[`${task.id}-${field.id}`] ?? answers[field.id] ?? "").trim();
      if (field.required && !value) return { missing: { task, field }, changes: [] };
      if (value) answers[field.id] = value;
    }
    if (!taskIsComplete(task, { state: saved.state, answers })) changes.push([task.id, answers]);
  }
  return { missing: null, changes };
}

export function isStartDone(node, student) {
  return (node?.tasks ?? []).every((task) => {
    const saved = withSavedState(task, student);
    return taskIsComplete(task, saved);
  });
}

export function startBlock(node, { free = false } = {}) {
  if (node?.id !== START_ID) return null;
  const video = link("welcomeVideo");
  const door = el("div.start__door", {}, el("p.start__wait", {}, "Checking your invite…"));
  inviteReady().then((ready) => {
    door.replaceChildren(
      ready
        ? btn({ label: "Join the community", variant: "solid", href: communityHref(), target: "_blank" })
        : el("p.start__wait", {}, ON_ITS_WAY)
    );
  });
  // The named rooms (config CHANNELS) are member rooms, so a free map doesn't list them.
  const rooms = free ? [] : roomLines();
  return el(
    "section.start",
    { "aria-label": "Start here" },
    video
      ? el(
          "div.start__film",
          {},
          el("b.eyebrow", {}, "A welcome from your coach"),
          el("iframe.start__video", { src: video, title: "A welcome from your coach", allow: "fullscreen; picture-in-picture", loading: "lazy" })
        )
      : null,
    el(
      "div.start__community",
      {},
      el("b.eyebrow", {}, "The community"),
      el("p", {}, "Fresh roles every morning, a weekly send day, and people at the same stage as you."),
      rooms.length ? el("ul.start__rooms", {}, rooms.map((line) => el("li", {}, line))) : null,
      door
    )
  );
}

export function startFinish(node, { student, store } = {}) {
  if (node?.id !== START_ID || !store) return null;
  if (isStartDone(node, student)) {
    return el("section.start__finish", {}, el("p.start__in", {}, "You're in. The Next bar at the bottom has your next step."));
  }
  const go = btn({
    label: "I'm in",
    variant: "solid",
    onclick: () => {
      const picked = {};
      for (const task of node.tasks ?? []) {
        for (const field of task.fields ?? []) {
          const input = document.getElementById(`task-${task.id}-${field.id}`);
          if (input?.value) picked[`${task.id}-${field.id}`] = input.value;
        }
      }
      const { missing, changes } = imInChanges(node, student, picked);
      if (missing) {
        toast(`Pick ${missing.field.label.toLowerCase()} first.`, "warn");
        document.querySelector(`[aria-label="${missing.field.label}"] button`)?.focus();
        return;
      }
      for (const [id, answers] of changes) store.setTaskState(id, "done", answers);
      toast("You're in. The Next bar has your next step.");
    },
  });
  return el(
    "section.start__finish",
    {},
    el("p", {}, "About 10 to 15 hours a week and one send every week. Ready?"),
    go
  );
}
