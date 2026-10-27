/**
 * Send this week: the send loop's node (server/send_step.py). What a student sees, in order:
 *
 *   Locked    until the resume for the active title is ready (resume-stages.readiness): three checks,
 *             each a link to the step that clears it.
 *   The five  postings from the radar, each with its verdict and reason (send-verdict.js). Tap one.
 *   One job   the facts, which resume goes (versions alternate, search.pickVersion), applied-before,
 *             "Open the posting" and then "I sent it". The send is recorded with what went (search.sendTags).
 *   Asks      "Anything back from Acme?" three days later, then ten: one tap. Ignored, it becomes "no reply".
 *   Read-out  Monday's plain lines from the server (outcomes.readout) and the week's count.
 *
 * Nothing here needs history. The record starts with the first send through this node.
 */

import { el, mount } from "../dom.js?v=afd944f-202610271949";
import { btn, toast } from "../ui.js?v=afd944f-202610271949";
import { isProgressReadOnly } from "../store.js?v=afd944f-202610271949";
import { addApp, answerAsk, outcomeAsks, noReply, pickVersion, sentBefore, thisWeek, networkOf, insideConnections, careerOf, searchOf, ageLabel } from "../search.js?v=afd944f-202610271949";
import { verdict, pickWeek } from "../send-verdict.js?v=afd944f-202610271949";
import { readiness } from "../resume-stages.js?v=afd944f-202610271949";
import { matchedRoles, radarReady } from "../roles-remote.js?v=afd944f-202610271949";
import * as api from "../resume-remote.js?v=afd944f-202610271949";

const WEEK_TARGET = 5;
const LABEL = { apply: "Apply", reach: "Write first", skip: "Skip" };

export function renderSend(ctx, options = {}) {
  let node = options.node || null;
  const root = el("div.view.view--resume.view--send");
  let current = ctx;
  let slug = ctx.state.slug;
  let rec = null;
  let saves = [];
  let roles = null;
  let readout = null;
  let open = null; // the posting they're looking at
  let busy = "";
  let error = "";

  const readOnly = () => isProgressReadOnly();
  const student = () => current.state.student;
  const apps = () => searchOf(student()).apps ?? [];
  const title = () => rec?.graph?.targets?.[0]?.titles?.[0] || "";
  const targetId = () => rec?.graph?.targets?.[0]?.id || null;
  const needs = () => (rec?.needs || []).filter((n) => n.state !== "off");
  const insidersOf = (role) => insideConnections([role], networkOf(student()))[0]?.people ?? [];
  const portfolio = () => Boolean(searchOf(student()).portfolio || careerOf(student()).portfolio);

  async function load() {
    if (!api.resumeReady()) {
      error = "Sign in to send from the board.";
      return render();
    }
    try {
      const [r, s] = await Promise.all([api.loadResume(slug), api.listSaves(slug).catch(() => ({ saves: [] }))]);
      rec = r;
      saves = s.saves || [];
      render();
      api.loadReadout(slug).then((out) => { readout = out; render(); }).catch(() => {});
      if (radarReady() && readiness({ rec, saves }).ready) {
        roles = await matchedRoles({ titles: [title()], days: 21, limit: 60 });
        render();
      }
    } catch (e) {
      error = e.message;
      render();
    }
  }

  /* ---------- locked ---------- */
  function lockedBody(ready) {
    return el("section.sd__card", {},
      el("h2", {}, "Send this week"),
      el("p.rz__now", {}, `Opens when your resume for ${title() || "the job you want"} is ready. Three things, no feelings:`),
      el("ul.sd__checks", {}, ready.checks.map((c) =>
        el(`li.sd__check${c.ok ? ".is-ok" : ""}`, {},
          el("span.sd__tick", { "aria-hidden": "true" }, c.ok ? "✓" : ""),
          el("span", {}, c.label),
          c.ok ? null : btn({ label: "Go →", variant: "quiet", onclick: () => current.navigate("map", "b.resume") })))));
  }

  /* ---------- the five ---------- */
  function week() {
    const done = thisWeek(apps()).apply;
    return el("header.sd__head", {},
      el("h2", {}, `Send this week: ${done} of ${WEEK_TARGET}`),
      el("p.rz__now", {}, done >= WEEK_TARGET ? "Five out. Anything more this week is a bonus; the asks come on their own."
        : `${WEEK_TARGET - done} to go. Each one here was picked for you, with the reason. About ${Math.max(4, (WEEK_TARGET - done) * 4)} minutes.`));
  }

  function fiveBody() {
    if (roles === null) return el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, radarReady() ? "Looking at this week's postings." : "The job radar isn't on for this account yet."));
    const picks = pickWeek(roles.roles || [], { apps: apps(), needs: needs(), insidersOf });
    if (!picks.length) return el("p.rz__empty", {}, `Nothing fresh for ${title()} this week that you haven't already sent to. Check again in a day or two, or add another title on your resume.`);
    return el("ol.sd__five", {}, picks.map(({ role, v }) =>
      el("li.sd__pick", { "data-verdict": v.label },
        el("button.sd__pickbtn", { type: "button", onclick: () => { open = { role, v }; render(); root.scrollIntoView?.({ block: "start" }); } },
          el("span.sd__who", {}, el("b", {}, role.company), " · ", role.title),
          el("span.sd__why", {}, v.reasons.slice(0, 2).join(" · ")),
          el("span.sd__label", {}, LABEL[v.label])))));
  }

  /* ---------- one job ---------- */
  function jobBody() {
    const { role, v } = open;
    const before = sentBefore(apps(), { company: role.company, roleKey: role.key });
    const version = pickVersion(saves, apps(), targetId());
    const hit = needs().filter((n) => (n.terms || []).some((t) => `${role.title} ${role.description || ""}`.toLowerCase().includes(String(t).toLowerCase())));
    let beforeAnswer = before ? "yes" : null;
    const beforeRow = before ? el("p.sd__fact", {}, `You sent to ${role.company} on ${before.date}.`)
      : el("div.sd__before", {}, el("span", {}, "Applied here before we started counting?"),
          ["no", "yes", "unsure"].map((k) => el("button.rz__chip", { type: "button", "aria-pressed": "false", onclick: (e) => { beforeAnswer = k; [...e.target.parentNode.querySelectorAll("button")].forEach((b) => b.setAttribute("aria-pressed", b === e.target ? "true" : "false")); } }, { no: "No", yes: "Yes", unsure: "Not sure" }[k])));
    const send = () => {
      if (readOnly()) return toast("View only.", "warn");
      const age = Math.max(0, Math.floor((Date.now() - new Date(role.published_at || role.first_seen_at)) / 86400000));
      const people = insidersOf(role);
      current.store.updateSearch(
        (s) => ({ apps: addApp(s.apps, { kind: "apply", company: role.company, role: role.title, link: role.apply_url || role.url, roleKey: role.key,
          resume: version ? { saveId: version.id, name: version.name, targetId: targetId() || undefined, title: title() || undefined } : undefined,
          portfolio: portfolio(), named: people.length > 0, age, before: beforeAnswer || undefined }) }),
        { kind: "search.logged", payload: { kind: "apply", company: role.company, from: "send" } });
      toast(`Sent: ${role.company}. We'll ask in 3 days what came back.`, "ok");
      open = null;
      if (thisWeek(apps()).apply >= WEEK_TARGET && node?.tasks?.[0]) current.store.setTaskState(node.tasks[0].id, "done");
      render();
    };
    return el("section.sd__job", {},
      btn({ label: "← The five", variant: "quiet", onclick: () => { open = null; render(); } }),
      el("h2", {}, role.company, el("small", {}, ` · ${role.title}`)),
      el("p.sd__verdict", { "data-verdict": v.label }, `${LABEL[v.label]}: ${v.reasons.join("; ")}.`),
      el("ul.sd__facts", {},
        el("li", {}, `Posted ${ageLabel(role.published_at || role.first_seen_at)}${role.ats ? ` · ${role.ats}` : ""}${role.workplace ? ` · ${role.workplace}` : ""}${(role.locations || []).length ? ` · ${role.locations[0]}` : ""}`),
        hit.length ? el("li", {}, `This posting mentions ${hit.length} of the ${needs().length} things your title is screened for: ${hit.map((n) => n.label).join(", ")}.`) : null,
        v.insiders?.length ? el("li", {}, `You know ${v.insiders.map((p) => p.name).join(", ")} there. Write first; the message is on your board.`) : null),
      el("div.sd__with", {}, el("b", {}, "Send with: "), version ? `${version.name} (saved ${new Date(version.created_at).toLocaleDateString()})` : "no saved version yet: save one on your resume first",
        saves.length > 1 ? el("small", {}, " · versions alternate so they can be compared") : null),
      beforeRow,
      el("div.rz__row", {},
        btn({ label: "Open the posting ↗", variant: "solid", href: role.apply_url || role.url, target: "_blank" }),
        btn({ label: "I sent it", variant: "ghost", disabled: !version || Boolean(busy), onclick: send })),
      el("p.rz__hint", {}, "On their site, copy from your resume field by field. Come back and press \"I sent it\"; that's what we remember."));
  }

  /* ---------- asks ---------- */
  function asksBody() {
    const due = outcomeAsks(apps());
    if (!due.length) return null;
    return el("section.sd__asks", {}, el("b.eyebrow", {}, "Anything back?"),
      due.slice(0, 3).map((app) => el("div.sd__ask", {},
        el("span", {}, `${app.company}${app.role ? ` · ${app.role}` : ""} · sent ${app.date}`),
        el("div.rz__row", {}, [["nothing", "Nothing"], ["replied", "A reply"], ["screen", "A screen"], ["interview", "An interview"]].map(([k, label]) =>
          btn({ label, variant: k === "nothing" ? "quiet" : "ghost", onclick: () => { current.store.updateSearch((s) => ({ apps: answerAsk(s.apps, app.id, k) })); render(); } }))))));
  }

  /* ---------- read-out ---------- */
  function readoutBody() {
    const quiet = apps().filter((a) => noReply(a)).length;
    return el("section.sd__readout", {}, el("b.eyebrow", {}, "What's worked"),
      readout ? el("ul", {}, readout.lines.map((line) => el("li", {}, line))) : el("p.rz__muted", {}, "Reading…"),
      quiet ? el("p.rz__muted", {}, `${quiet} send${quiet === 1 ? "" : "s"} with no reply after three weeks. That's normal: most cold sends get nothing, which is why the warm ones matter.`) : null);
  }

  function render() {
    if (error && !rec) return mount(root, el("div.rz", {}, el("p.rz__empty", {}, error)));
    if (!rec) return mount(root, el("div.rz", {}, el("div.pack__wait", {}, el("span.pack__spinner", { "aria-hidden": "true" }), el("p", {}, "Opening."))));
    const ready = readiness({ rec, saves });
    if (!ready.ready) return mount(root, el("div.rz.rz--embedded", {}, lockedBody(ready)));
    mount(root, el("div.rz.rz--embedded", {},
      asksBody(),
      open ? jobBody() : el("section.sd__card", {}, week(), fiveBody()),
      readoutBody()));
  }

  render();
  load();
  return {
    node: root,
    update(next, nextOptions = {}) {
      current = next;
      if (nextOptions.node) node = nextOptions.node;
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        rec = null;
        load();
      } else if (rec) {
        render();
      }
    },
  };
}
