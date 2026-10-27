/**
 * Hire: the student's home. One question, answered in five seconds: what do I
 * do today to get in front of people who hire?
 *
 * The run is ordered by what produces interviews (research in
 * ops/hire-engine.md): warm asks to people they know, follow-ups that are due,
 * fresh roles prepared one at a time (early and specific beats many and
 * generic), then the proof work on their map. Each row carries its own next
 * action, so nothing on this page needs instructions.
 *
 * Below the run: the route to a hire (where they stand), their people, their
 * pipeline, and, quieter, their story (drafted from their resume or set by their coach), their resume, and a way to bring
 * in a posting they found anywhere.
 *
 * Persistent (boot.js): polls and saves update in place without wiping a
 * half-typed form. Aden sees it read-only from the desk.
 */

import { el, mount } from "../dom.js?v=c78ea40-202610270657";
import { panel, btn, field, toast, copy } from "../ui.js?v=c78ea40-202610270657";
import { isoDate, fmtDay } from "../time.js?v=c78ea40-202610270657";
import { STATUS } from "../graph/model.js?v=c78ea40-202610270657";
import {
  STAGES,
  RELATIONS,
  PERSON_STATES,
  addApp,
  moveApp,
  closeApp,
  removeApp,
  markFollowed,
  followUps,
  active,
  searchOf,
  careerOf,
  cleanResume,
  peopleOf,
  addPerson,
  movePerson,
  removePerson,
  toAsk,
  dailyTargets,
  followUpText,
  referralText,
  packsOf,
  keepPack,
  ageLabel,
  diagnose,
  thisWeek,
  funnel,
  parseConnections,
  networkOf,
  insideConnections,
  insiderText,
  shortTitle,
  targetsOf,
  activeTargets,
  addTarget,
  patchTarget,
  touchTarget,
  seedTarget,
  dueTouches,
  nextTouch,
  targetCandidates,
  webLink,
  MAX_ACTIVE_TARGETS,
} from "../search.js?v=c78ea40-202610270657";
import { storyCard, appRow } from "./search-parts.js?v=c78ea40-202610270657";
import { TOOLS, moveRoute } from "../engine.js?v=c78ea40-202610270657";
import { currentMove, setLiveJobs } from "../next-live.js?v=c78ea40-202610270657";
import { PERSIST } from "../../../config.js?v=c78ea40-202610270657";
import { matchedRoles, radarReady, fetchPacks, winsState, shareWin, draftPositioning } from "../roles-remote.js?v=c78ea40-202610270657";
import { createPackDrawer } from "./pack.js?v=c78ea40-202610270657";
import { createCampaignDrawer } from "./campaign.js?v=c78ea40-202610270657";
import { NODES as CAMPAIGN_NODES, doneNodes, loomStatus } from "../campaign-steps.js?v=c78ea40-202610270657";

const RUN_FAMILIES = ["proof", "presence", "network", "interview"];
/** How many moves the day leads with. More than this reads as a wall, not a plan. */
const TOOL_IDS = ["today", "targets", "people", "applications", "profile"];
/** The map steps each tool works on (by module), listed on the tool's page. */
const TOOL_STEPS = {
  applications: ["application-engine", "title-cluster"],
  targets: ["target-campaign", "company-prep"],
  people: ["warm-path", "target-list", "network-sprint"],
  profile: ["resume-engine", "profile-rewrite", "title-cluster", "profile-images"],
  today: [],
};
const TOOL_WHY = {
  today: "Your next move first, the same one as the bar at the bottom. Then everything else for today: campaign sends, warm asks, fresh roles and your next build step.",
  targets: "Five companies where hiring, size and fit overlap, worked on every channel: an email with a Loom, a LinkedIn request, a call, and follow-ups on day 3, 7 and 14.",
  people: "Referrals turn into interviews far more often than applications. Former colleagues first, then people you've met, then people in the seat.",
  applications: "Fresh roles that match your titles, strongest fits first. Prepare reads each one against your record; any posting you find can be prepared too.",
  profile: "Recruiters search all day. Your story, headline, About and the titles you search under, drafted from your resume, and the resume and portfolio every tool reads.",
};

/** Which lane of the grid each kind of move works. */
const LANE_OF = { prep: "interview", inside: "network", target: "pipeline", profile: "presence", warm: "network", follow: "pipeline", apply: "pipeline" };


/** The next open step on their map in a lane that builds proof or presence. */
export function nextBuildStep(graph) {
  return (graph?.nodes ?? [])
    .filter((node) => RUN_FAMILIES.includes(node.family) && node.status === STATUS.OPEN)
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0))[0];
}

export function renderHire(ctx, initialTool, campaignId) {
  let current = ctx;
  const readOnly = () => current.store.isProgressReadOnly?.() ?? false;
  const save = (change, event = null) => current.store.updateSearch(change, event);
  const student = () => current.state.student;

  let radar = { roles: [], off: !radarReady(), loading: radarReady() };
  // Prepared roles live on the server (Prepare, and the overnight run); the
  // student's own record keeps a copy so a reopen is instant even offline.
  let serverPacks = {};
  const packFor = (key) => serverPacks[key] ?? packsOf(student())[key];
  const drawer = createPackDrawer({
    slug: ctx.state.slug,
    readOnly,
    getPack: packFor,
    savePack: (key, entry) => save((s) => ({ packs: keepPack(s.packs, key, entry) })),
    onApplied: (role) => logApplied(role),
    onTarget: (role) => makeTarget({ role }),
  });

  const portfolio = () => searchOf(student()).portfolio || careerOf(student()).portfolio || "";
  const camp = createCampaignDrawer({
    slug: ctx.state.slug,
    readOnly,
    getPortfolio: portfolio,
    getTarget: (id) => targetsOf(student()).find((t) => t.id === id),
    onBusy: () => redraw(), // a campaign started or finished writing: the target cards say so
    onPatch: (id, patch) => save((x) => ({ targets: patchTarget(seedTarget(x.targets, student(), id), id, patch) })),
    onTouch: (id, channel, entry) =>
      save((x) => ({ targets: touchTarget(seedTarget(x.targets, student(), id), id, channel), apps: addApp(x.apps, entry) }), { kind: "search.logged", payload: { kind: "warm", company: entry.company, from: `target:${channel}` } }),
  });

  function makeTarget({ role, reasons = [], insider = "" }) {
    if (activeTargets(student()).length >= MAX_ACTIVE_TARGETS) return toast(`Five active targets is the most that get real attention. Close one first.`, "warn");
    if (!String(role.company ?? "").trim()) return toast("A target needs the company.", "warn");
    save((x) => ({ targets: addTarget(x.targets, { company: role.company, role: role.title, roleKey: role.key, link: role.apply_url || role.url, insider, why: reasons.join(", "), posting: role.description ?? "" }) }), { kind: "search.target", payload: { company: role.company } });
    const made = activeTargets(student()).find((t) => (role.key && t.roleKey === role.key) || t.company === role.company);
    // Land on Targets under the drawer, so closing it shows the new target in the list, not some other screen.
    if (focus !== "targets") current.navigate("do", "targets");
    if (made) camp.open(made.id);
  }

  function logApplied(role) {
    save(
      (s) => ({ apps: addApp(s.apps, { kind: "apply", company: role.company, role: role.title, link: role.url, roleKey: role.key }) }),
      { kind: "search.logged", payload: { kind: "apply", company: role.company, from: role.key ? "radar" : "pasted" } }
    );
    toast(`Logged: ${role.company}. Now find one person there.`);
  }

  /** How the radar is doing, in words: the place for "how", off the map. */
  async function loadRadarNote() {
    try {
      const health = await (await fetch(`${String(PERSIST.endpoint).replace(/\/$/, "")}/health`, { cache: "no-store" })).json();
      const r = health?.roles;
      if (!r || r.state === "off") radarNote.textContent = "The job radar is off right now";
      else if (!r.last_poll) radarNote.textContent = "The job radar is starting";
      else {
        const mins = Math.max(0, Math.round((Date.now() - new Date(r.last_poll)) / 60000));
        radarNote.textContent = mins > 15 ? "The job radar is paused" : `Watching employer job boards for your titles · checked ${mins ? `${mins} min ago` : "just now"}`;
      }
    } catch {
      radarNote.textContent = "";
    }
  }

  async function loadRadar(titles = null) {
    if (!radarReady()) return;
    void loadRadarNote();
    fetchPacks(ctx.state.slug)
      .then((packs) => {
        serverPacks = packs;
        setLiveJobs({ packs });
        draw();
      })
      .catch(() => {});
    const career = careerOf(student());
    const search = titles?.length ? titles : career.titles;
    try {
      radar = { ...(await matchedRoles({ titles: search.length ? search : ["Software Engineer"], years: career.years ?? null, limit: 60 })), loading: false };
    } catch (error) {
      radar = { roles: [], off: false, loading: false, error: error.message };
    }
    setLiveJobs({ roles: radar.roles ?? [] });
    draw();
  }

  /* ---------- the run ---------- */

  /** Is this Today row the same thing as the engine's next move? */
  function sameMove(move, item) {
    if (move.kind === "step") return item.stepId === move.stepId;
    if (move.targetId) return item.targetId === move.targetId;
    if (move.kind === "follow") return item.kind === "follow" && move.title === `Follow up with ${item.company}`;
    if (move.kind === "today") return item.kind === "prep" && Boolean(item.company) && move.title.includes(item.company);
    const kinds = { insider: "inside", people: "warm", profile: "profile", applications: "apply" };
    return kinds[move.kind] ? item.kind === kinds[move.kind] : false;
  }

  /** A move: what to do, why, the buttons, and the lane of the grid it belongs to. */
  function runItem(move) {
    return { lane: LANE_OF[move.kind], ...move };
  }

  function renderMove({ kind, title, sub, actions }) {
    return el(
      "li.run__item",
      { "data-kind": kind },
      el("span.run__dot", { "aria-hidden": "true" }),
      el("div.run__text", {}, el("b.run__title", {}, title), sub ? el("span.run__sub", {}, sub) : null),
      el("div.run__acts", {}, actions)
    );
  }

  function runList() {
    const s = student();
    const { apps } = searchOf(s);
    const now = new Date();
    const targets = dailyTargets({ student: s, now });
    const items = [];
    const ro = readOnly();

    // 0. A screen or an interview on the calendar outranks everything.
    for (const app of active(apps).filter((a) => a.stage === "screen" || a.stage === "interview").slice(0, 3)) {
      const target = app.roleKey && packFor(app.roleKey) ? { key: app.roleKey, title: app.role, company: app.company, url: app.link } : { pasted: { title: app.role, company: app.company, url: app.link, description: "" } };
      items.push(
        runItem({
          kind: "prep",
          company: app.company,
          title: `Prepare for your ${app.company} ${app.stage === "screen" ? "screen" : "interview"}`,
          sub: "The questions this loop asks, your two-minute story, and one thing about their product to bring up.",
          actions: [
            btn({ label: "Prep", variant: "solid", onclick: () => drawer.open(target, { node: "ready" }) }),
            app.link ? btn({ label: "Posting ↗", variant: "quiet", href: app.link, target: "_blank" }) : null,
          ],
        })
      );
    }

    // 0b. Someone they're connected to works where a matching role is open.
    const asked = new Set(peopleOf(s).map((p) => `${p.name}|${p.company}`.toLowerCase()));
    const insiders = insideConnections(radar.roles.filter((r) => !apps.some((a) => a.roleKey === r.key)), networkOf(s))
      .map(({ role, people }) => ({ role, person: people.find((p) => !asked.has(`${p.name}|${p.company}`.toLowerCase())) }))
      .filter((hit) => hit.person)
      .slice(0, 3);
    for (const { role, person } of insiders) {
      const text = insiderText(person, role, s);
      items.push(
        runItem({
          kind: "inside",
          title: `You know ${person.name} at ${role.company}`,
          sub: `${role.company} is hiring for ${shortTitle(role.title)}. ${person.role ? `${person.name.split(" ")[0]} is ${person.role}. ` : ""}A referral is the strongest way in.`,
          actions: [
            btn({ label: "Copy ask", variant: "ghost", onclick: () => copy(text, "Copied. Send it on LinkedIn yourself.") }),
            person.link ? btn({ label: "Profile ↗", variant: "quiet", href: person.link, target: "_blank" }) : null,
            ro ? null : btn({ label: "Sent", variant: "solid", onclick: () => insiderSent(person, role) }),
          ],
        })
      );
    }

    // 0b2. Target campaigns: today's touches, then the nudge to pick targets.
    for (const touch of dueTouches(targetsOf(s), now)) {
      const t = touch.target;
      items.push(
        runItem({
          kind: "target",
          targetId: t.id,
          title: `${t.company}: ${touch.label}`,
          sub: touch.kind === "day0" ? "Day 0 of your campaign. The drafts are written around what they need owned; record the Loom in your words." : "One new thing on the same thread. The drafts are ready.",
          actions: [btn({ label: "Open campaign", variant: "solid", onclick: () => camp.open(t.id) })],
        })
      );
    }
    const activeCount = activeTargets(s).length;
    if (activeCount < MAX_ACTIVE_TARGETS && !targetsOf(s).length) {
      items.push(
        runItem({
          kind: "target",
          title: "Choose your five targets",
          sub: "Where hiring, size and fit overlap, stop applying and start a campaign: email with a Loom, LinkedIn, a call, and follow-ups.",
          // The target form lives on the Targets tool, not Today: open that tool, then bring the form up with the
          // cursor in it (on Today the form isn't on the page, so scrolling to it did nothing).
          actions: [btn({ label: "Choose", variant: "ghost", onclick: openTargetForm })],
        })
      );
    }

    // 0c. Once: the story on their profile, so recruiter search can find them.
    const career = careerOf(s);
    if (career.headline && !searchOf(s).profileAt) {
      items.push(
        runItem({
          kind: "profile",
          title: "Put your new headline and About on LinkedIn",
          sub: "Then Open to Work, visible to recruiters only, with your titles. Recruiters search all day; this is how they find you.",
          actions: [
            btn({ label: "Copy headline", variant: "ghost", onclick: () => copy(career.headline, "Headline copied.") }),
            career.about ? btn({ label: "Copy About", variant: "quiet", onclick: () => copy(career.about, "About copied.") }) : null,
            ro ? null : btn({ label: "Done", variant: "solid", onclick: () => save(() => ({ profileAt: new Date().toISOString() }), { kind: "search.profile", payload: {} }) }),
          ],
        })
      );
    }

    // 1. Warm asks: people they already know first.
    const asks = toAsk(peopleOf(s)).slice(0, Math.max(0, targets.warm.target - targets.warm.done));
    for (const person of asks) {
      const text = referralText(person, s);
      items.push(
        runItem({
          kind: "warm",
          title: `Ask ${person.name || "someone"}${person.company ? ` at ${person.company}` : ""}`,
          sub: `${RELATIONS[person.relation]}${person.role ? ` · ${person.role}` : ""}. Referrals turn into interviews far more often than applications.`,
          actions: [
            btn({ label: "Copy message", variant: "ghost", onclick: () => copy(text, "Message copied. Send it from LinkedIn or email yourself.") }),
            person.link ? btn({ label: "Open ↗", variant: "quiet", href: person.link, target: "_blank" }) : null,
            ro ? null : btn({ label: "Sent", variant: "solid", onclick: () => askedPerson(person) }),
          ],
        })
      );
    }
    const warmLeft = Math.max(0, targets.warm.target - targets.warm.done - asks.length);
    if (peopleOf(s).length && warmLeft > 0) {
      items.push(
        runItem({
          kind: "warm",
          title: `${warmLeft} more ${warmLeft === 1 ? "person" : "people"} to reach today`,
          sub: "Everyone on your list is asked. Add the next ones: a former colleague, someone in the seat at a company you applied to.",
          actions: [btn({ label: "Add people", variant: "ghost", onclick: () => { const more = document.querySelector(".hire__more"); if (more) more.open = true; document.getElementById("pp-name")?.focus(); } })],
        })
      );
    }
    if (!peopleOf(s).length) {
      items.push(
        runItem({
          kind: "warm",
          title: "List 10 people you've worked with",
          sub: "Every past job is a list of people who now work somewhere else. That list is your fastest way in.",
          actions: [btn({ label: "Add people", variant: "ghost", onclick: () => { const more = document.querySelector(".hire__more"); if (more) more.open = true; document.getElementById("pp-name")?.focus(); } })],
        })
      );
    }

    // 2. Follow-ups that are due.
    for (const app of followUps(apps, now).slice(0, 3)) {
      const text = followUpText(app, s);
      items.push(
        runItem({
          kind: "follow",
          company: app.company,
          title: `Follow up: ${app.company}`,
          sub: `${app.role || "Application"} · sent ${app.date}, no reply yet`,
          actions: [
            btn({ label: "Copy follow-up", variant: "ghost", onclick: () => copy(text, "Follow-up copied.") }),
            ro ? null : btn({ label: "Sent", variant: "solid", onclick: () => save((x) => ({ apps: markFollowed(x.apps, app.id) })) }),
          ],
        })
      );
    }

    // 3. Fresh roles, prepared one at a time.
    const applied = new Set(apps.map((a) => a.roleKey).filter(Boolean));
    // Prepared roles carry a fit level: strong first, unprepared next, weak fits out of the daily slots.
    const rank = (role) => ({ strong: 0, possible: 1, weak: 3 })[packFor(role.key)?.pack?.fit_level] ?? 2;
    const fresh = radar.roles
      .filter((r) => !applied.has(r.key) && rank(r) < 3)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
      .map(({ r }) => r)
      .slice(0, Math.max(0, targets.apply.target - targets.apply.done));
    for (const role of fresh) {
      const prepared = Boolean(packFor(role.key));
      const level = packFor(role.key)?.pack?.fit_level;
      items.push(
        runItem({
          kind: "apply",
          title: `${role.company} · ${role.title.length > 72 ? `${role.title.slice(0, 70).replace(/[,\s]+\S*$/, "")}…` : role.title}`,
          sub: [level === "strong" ? "Strong fit" : level === "possible" ? "Possible fit" : null, role.ats === "hn" ? "Posted on HN Who's hiring, often by the founder" : null, ageLabel(role.published_at || role.first_seen_at, now), role.workplace, (role.locations ?? []).slice(0, 1).join(""), role.min_years ? `${role.min_years}+ yrs asked` : null].filter(Boolean).join(" · "),
          actions: [
            btn({ label: prepared ? "Open prep" : "Prepare", variant: prepared ? "ghost" : "solid", onclick: () => drawer.open(role) }),
            btn({ label: "Posting ↗", variant: "quiet", href: role.apply_url || role.url, target: "_blank" }),
            ro ? null : btn({ label: "Applied", variant: "quiet", onclick: () => logApplied(role) }),
          ],
        })
      );
    }
    if (!fresh.length) {
      const why = radar.loading ? "Looking for fresh roles…" : radar.off ? "Sign in to see fresh roles." : radar.error ? `The radar didn't answer (${radar.error}).` : "No fresh roles match your titles right now. Bring one in below: any posting you find can be prepared.";
      if (targets.apply.target > targets.apply.done)
        items.push(runItem({ kind: "apply", title: `${targets.apply.target - targets.apply.done} application${targets.apply.target - targets.apply.done === 1 ? "" : "s"} today`, sub: why, actions: [btn({ label: "Bring a posting", variant: "ghost", onclick: () => document.getElementById("pz-title")?.focus() })] }));
    }

    // 4. The proof work on their map.
    const step = nextBuildStep(current.state.graph);
    if (step) {
      items.push(
        runItem({
          kind: "build",
          lane: step.family,
          stepId: step.id,
          title: step.title,
          sub: "Your map's next build step. Proof is what makes the messages land.",
          actions: [btn({ label: "Open step", variant: "ghost", onclick: () => current.navigate("map", step.id) })],
        })
      );
    }

    // The Next bar's move is always the first row, so Today and the bar never disagree (views/next-bar.js).
    const move = currentMove(current.state, now);
    const at = items.findIndex((item) => sameMove(move, item));
    if (at >= 0) {
      const [first] = items.splice(at, 1);
      items.unshift(move.kind === "step" ? { ...first, title: move.title, sub: move.why } : first);
    } else if (move.kind !== "rest") {
      items.unshift(
        runItem({
          kind: move.stepId ? "build" : "next",
          stepId: move.stepId,
          lane: move.lane,
          title: move.title,
          sub: move.why,
          actions: [btn({ label: move.kind === "review" ? "Read the notes" : "Open", variant: "solid", onclick: () => current.navigate(...moveRoute(move)) })],
        })
      );
    }

    const doneToday = targets.apply.done + targets.warm.done;
    return { items, doneToday, targets };
  }

  function insiderSent(person, role) {
    save(
      (x) => ({
        people: addPerson(x.people, { name: person.name, company: person.company, role: person.role, link: person.link, relation: "met", state: "asked", note: `About ${role.title}` }),
        apps: addApp(x.apps, { kind: "warm", company: role.company, role: role.title, contact: person.name, link: person.link, note: "Connection inside" }),
      }),
      { kind: "search.logged", payload: { kind: "warm", company: role.company, from: "network" } }
    );
    toast(`Logged. Apply to ${role.company} too, and mention ${person.name.split(" ")[0]}.`);
  }

  function askedPerson(person) {
    save(
      (s) => ({
        people: movePerson(s.people, person.id, "asked"),
        apps: addApp(s.apps, { kind: "warm", company: person.company, role: person.role, contact: person.name, link: person.link, note: RELATIONS[person.relation] }),
      }),
      { kind: "search.logged", payload: { kind: "warm", company: person.company } }
    );
    toast(`Logged. ${person.name || "They"} moved to Asked.`);
  }

  /* ---------- targets ---------- */

  // Any company they choose: found on a site, a Discord, a friend's tip, or a place they simply want to work.
  const tCompany = field({ label: "Company", id: "tg-company", placeholder: "Acme AI" });
  const tRole = field({ label: "Role (or the team you want)", id: "tg-role", placeholder: "Forward Deployed Engineer" });
  // Plain text, not type="url": the browser refused "acme.com" with only its own tooltip, so the button seemed dead.
  const tLink = field({ label: "Link", id: "tg-link", placeholder: "acme.com/careers, or their posting" });
  tLink.input.inputMode = "url";
  tLink.input.autocapitalize = "off";
  const tText = field({ label: "What you know (paste the posting, or a few lines on what they build)", id: "tg-text", textarea: true });
  tText.input.rows = 5;
  const targetForm = el(
    "form.slog",
    {
      onsubmit: (event) => {
        event.preventDefault();
        const company = tCompany.input.value.trim();
        if (!company) return toast("Add the company.", "warn");
        const url = webLink(tLink.input.value);
        if (url === null) return toast("That link doesn't look like a web address. Try something like acme.com/careers, or leave it empty.", "warn");
        makeTarget({ role: { company, title: tRole.input.value.trim(), url, description: tText.input.value.trim() } });
        for (const f of [tCompany, tRole, tLink, tText]) f.input.value = "";
      },
    },
    el("div.slog__grid", {}, tCompany.node, tRole.node, tLink.node),
    tText.node,
    el("div.row", {}, el("button.b.b--solid", { type: "submit" }, "Make it a target"))
  );

  // Always open: with the radar off, this is how most targets are added.
  const targetAny = el(
    "section.tany",
    {},
    el("b.tany__h", {}, "Add a company"),
    el("p.muted", {}, "One you found yourself or simply want to work for. Paste their posting or what they build: the campaign, the Loom ideas and the email are written from it, so the more specific, the better."),
    targetForm
  );

  function targetsBlock() {
    const s = student();
    const active = activeTargets(s);
    const others = targetsOf(s).filter((t) => t.state !== "active");
    const cards = active.map((t) =>
      el(
        "button.tcard",
        { type: "button", onclick: () => camp.open(t.id) },
        el("div.tcard__top", {}, el("b", {}, t.company), el("span.tcard__next", {}, nextTouch(t))),
        el("span.tcard__role", {}, [shortTitle(t.role), t.campaign?.size].filter(Boolean).join(" · ")),
        t.campaign?.problem ? el("span.tcard__problem", {}, t.campaign.problem) : t.why ? el("span.tcard__problem", {}, t.why) : null,
        t.campaign ? null : el("span.tcard__camp", { class: camp.isWriting(t.id) ? "is-writing" : null }, camp.isWriting(t.id) ? "Campaign: writing…" : "Campaign: not written yet. Open to write it."),
        loomStatus(t) ? el("span.tcard__loom", { class: loomStatus(t).done ? "is-sent" : null }, `Loom: ${loomStatus(t).done ? "✓ " : ""}${loomStatus(t).label}`) : null,
        el(
          "div.tcard__dots",
          { "aria-label": "Campaign steps" },
          // The same seven steps the campaign opens on; green means that step is done.
          CAMPAIGN_NODES.map((n) => el("span.tcard__dot", { class: doneNodes(t).includes(n.id) ? "is-on" : null, title: doneNodes(t).includes(n.id) ? `${n.label}: done` : n.label }, n.label))
        )
      )
    );
    const pick =
      active.length < MAX_ACTIVE_TARGETS && !readOnly()
        ? targetCandidates({ roles: radar.roles, packs: { ...packsOf(s), ...serverPacks }, network: networkOf(s), apps: searchOf(s).apps, targets: targetsOf(s) }, 6)
        : [];
    return el(
      "div",
      {},
      looms(),
      cards.length
        ? el("div.tcards", {}, cards)
        : el("p.muted", {}, pick.length ? "No targets yet. Pick up to five below: the overlap of hiring for your titles, a strong fit, and a way in." : "No targets yet. Add your first company below. Up to five at a time get a full campaign."),
      pick.length
        ? el(
            "div.tpick",
            {},
            el("b.tpick__h", {}, active.length ? `Add a target (${active.length} of ${MAX_ACTIVE_TARGETS})` : "Best overlap right now"),
            pick.map((c) =>
              el(
                "div.tpick__row",
                {},
                el("div.tpick__main", {}, el("b", {}, c.role.company), el("span", {}, shortTitle(c.role.title)), c.reasons.length ? el("span.tpick__why", {}, c.reasons.join(" · ")) : null),
                btn({ label: "Make target", variant: "ghost", onclick: () => makeTarget(c) })
              )
            )
          )
        : null,
      others.length ? el("p.tpick__done", {}, `${others.filter((t) => t.state === "replied").length} replied · ${others.filter((t) => t.state === "closed").length} closed`) : null,
      active.length < MAX_ACTIVE_TARGETS && !readOnly() ? targetAny : null
    );
  }

  /**
   * Every company the student has written or sent a Loom for, active or not:
   * where it stands (sent, recorded, script ready, script in progress), the
   * Loom itself, and the campaign it belongs to.
   */
  /** Looms already sent, and those from campaigns that ended: a record to rewatch. Active ones show on their card. */
  function looms() {
    const rows = targetsOf(student())
      .map((t) => ({ t, status: loomStatus(t) }))
      .filter((row) => row.status && (row.status.done || row.t.state !== "active"))
      .sort((a, b) => Number(b.status.done) - Number(a.status.done) || String(b.t.touches?.email ?? b.t.at ?? "").localeCompare(String(a.t.touches?.email ?? a.t.at ?? "")));
    if (!rows.length) return null;
    const sent = rows.filter((row) => row.status.done).length;
    return el(
      "section.looms",
      { "aria-label": "Your Looms" },
      el("header.looms__head", {}, el("b", {}, "Your Looms"), el("span", {}, `${sent} sent`)),
      el(
        "ul.looms__list",
        {},
        rows.map(({ t, status }) =>
          el(
            "li.looms__row",
            { class: status.done ? "is-sent" : null },
            el("div.looms__who", {}, el("b", {}, t.company), el("span", {}, [shortTitle(t.role), t.state === "replied" ? "Replied" : t.state === "closed" ? "Closed" : null].filter(Boolean).join(" · "))),
            el("span.looms__status", {}, status.done ? "✓ " : "", status.label),
            t.loomUrl ? el("a.looms__link", { href: t.loomUrl, target: "_blank", rel: "noopener" }, "Watch ↗") : el("span"),
            btn({ label: "Open campaign", variant: "quiet", onclick: () => camp.open(t.id) })
          )
        )
      )
    );
  }

  /* ---------- people ---------- */

  const pName = field({ label: "Name", id: "pp-name", placeholder: "Jordan Lee" });
  const pCompany = field({ label: "Where they work now", id: "pp-company", placeholder: "Acme AI" });
  const pRole = field({ label: "Their role", id: "pp-role", placeholder: "Engineering Manager" });
  const pLink = field({ label: "LinkedIn or email", id: "pp-link", placeholder: "linkedin.com/in/…" });
  const pRelation = el("select.sel", { id: "pp-rel", "aria-label": "How you know them" }, Object.entries(RELATIONS).map(([id, label]) => el("option", { value: id }, label)));
  const peopleForm = el(
    "form.pform",
    {
      onsubmit: (event) => {
        event.preventDefault();
        if (!pName.input.value.trim()) return toast("Add a name.", "warn");
        save((s) => ({ people: addPerson(s.people, { name: pName.input.value, company: pCompany.input.value, role: pRole.input.value, link: pLink.input.value, relation: pRelation.value }) }));
        for (const f of [pName, pCompany, pRole, pLink]) f.input.value = "";
        pName.input.focus();
      },
    },
    el("div.pform__grid", {}, pName.node, pCompany.node, pRole.node, pLink.node, el("label.field", {}, el("span.field__label", {}, "How you know them"), pRelation)),
    el("div.row", {}, el("button.b.b--ghost", { type: "submit" }, "Add person"))
  );

  const importStatus = el("p.pimport__status");
  const importInput = el("input", {
    type: "file",
    accept: ".csv,text/csv",
    id: "pp-import",
    onchange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const rows = parseConnections(await file.text());
      event.target.value = "";
      if (!rows.length) return toast("That file has no connections in it. Use Connections.csv from LinkedIn's data export.", "warn");
      current.store.setNetwork(rows);
      toast(`${rows.length} connections imported. Anyone at a hiring company shows up in your run.`);
    },
  });
  function importBox() {
    const rows = networkOf(student());
    const inside = insideConnections(radar.roles, rows);
    importStatus.textContent = rows.length
      ? `${rows.length.toLocaleString()} connections · ${inside.length} at ${inside.length === 1 ? "a company" : "companies"} hiring for your titles right now`
      : "Not imported yet.";
    return el(
      "div.pimport",
      {},
      el("b", {}, "Your LinkedIn connections"),
      el("p.muted", {}, "On LinkedIn: Me → Settings → Data privacy → Get a copy of your data → Connections. You'll get an email with Connections.csv. Bring it here and the run tells you who you already know at companies that are hiring. Your own export; nothing touches your LinkedIn."),
      importStatus,
      readOnly() ? null : el("label.b.b--ghost.pimport__btn", { for: "pp-import" }, rows.length ? "Import a newer export" : "Import Connections.csv", importInput)
    );
  }
  const importSlot = el("div");

  function peopleList() {
    const people = peopleOf(student());
    if (!people.length) return el("p.muted", {}, "Start with former colleagues from every job, then people you've met, then strangers in the seat you want.");
    return el(
      "div.plist",
      {},
      people.map((p) =>
        el(
          "div.pperson",
          { class: `pperson--${p.state}` },
          el("div.pperson__main", {}, el("b", {}, p.link ? el("a", { href: /^https?:/.test(p.link) ? p.link : `https://${p.link}`, target: "_blank", rel: "noopener" }, p.name) : p.name), el("span", {}, [p.role, p.company].filter(Boolean).join(" · ")), el("span.pperson__rel", {}, RELATIONS[p.relation])),
          readOnly()
            ? el("span.chip2", {}, PERSON_STATES.find((s) => s.id === p.state)?.label)
            : el(
                "div.pperson__acts",
                {},
                el(
                  "select.sel.sel--small",
                  { "aria-label": `Where things are with ${p.name}`, onchange: (event) => save((s) => ({ people: movePerson(s.people, p.id, event.target.value) })) },
                  PERSON_STATES.map((s) => el("option", { value: s.id, selected: s.id === p.state ? "" : null }, s.label))
                ),
                btn({ label: "×", variant: "quiet", title: "Remove", onclick: () => confirm(`Remove ${p.name}?`) && save((s) => ({ people: removePerson(s.people, p.id) })) })
              )
        )
      )
    );
  }

  /* ---------- sharing a win (only ever on their own tap) ---------- */

  // #wins shows nothing until Aden sets it up; then a send they can be glad about gets a quiet
  // "Share to #wins" on its own row. The text comes from the server, so the preview is exactly
  // what posts: first name, the stage, and the company only if they tick it.
  let wins = { on: false, shared: new Set() };
  let sharing = null; // { appId, stage, include, text, busy }

  async function loadWins() {
    if (!radarReady() || readOnly()) return;
    try {
      const state = await winsState(ctx.state.slug);
      wins = { on: Boolean(state.on), shared: new Set(state.shared ?? []) };
      draw();
    } catch {
      /* no #wins today: the rows stay as they were */
    }
  }

  /** A reply or later, any time; a send only on the day they sent it. */
  function shareable(app) {
    return !app.closed && (app.stage !== "sent" || app.date === isoDate(new Date()));
  }

  async function previewWin(app, include) {
    sharing = { appId: app.id, stage: app.stage, include, text: sharing?.appId === app.id ? sharing.text : "", busy: true };
    draw();
    try {
      const out = await shareWin(ctx.state.slug, { appId: app.id, includeCompany: include, dryRun: true });
      if (sharing?.appId === app.id) sharing = { ...sharing, text: out.text, busy: false };
    } catch (error) {
      sharing = null;
      toast(error.message, "warn");
    }
    draw();
  }

  async function postWin(app) {
    if (!sharing || sharing.busy) return;
    sharing = { ...sharing, busy: true };
    draw();
    try {
      await shareWin(ctx.state.slug, { appId: app.id, includeCompany: sharing.include });
      wins.shared.add(`${app.id}:${app.stage}`);
      sharing = null;
      toast("Posted to #wins.");
    } catch (error) {
      if (error.status === 409) wins.shared.add(`${app.id}:${app.stage}`);
      sharing = error.status === 409 ? null : { ...sharing, busy: false };
      toast(error.message, "warn");
    }
    draw();
  }

  function shareControl(app) {
    if (!wins.on || !shareable(app)) return null;
    if (wins.shared.has(`${app.id}:${app.stage}`)) return el("span.swin__done", {}, "Shared to #wins");
    if (sharing?.appId === app.id) return null;
    return btn({ label: "Share to #wins", variant: "quiet", onclick: () => previewWin(app, false) });
  }

  function shareBox(app) {
    if (!sharing || sharing.appId !== app.id || sharing.stage !== app.stage) return null;
    const box = el("input", { type: "checkbox", checked: sharing.include, disabled: sharing.busy, onchange: (event) => previewWin(app, event.target.checked) });
    return el(
      "div.swin",
      { role: "group", "aria-label": "Share to #wins" },
      el("p.swin__label", {}, "This posts in #wins on the GridSchool Discord:"),
      el("blockquote.swin__preview", { "aria-live": "polite" }, sharing.text || "…"),
      app.company ? el("label.swin__opt", {}, box, ` Include the company (${app.company})`) : null,
      el(
        "div.swin__acts",
        {},
        btn({ label: sharing.busy ? "One moment…" : "Post it", variant: "solid", disabled: sharing.busy || !sharing.text, onclick: () => postWin(app) }),
        btn({ label: "Cancel", variant: "quiet", onclick: () => { sharing = null; draw(); } })
      )
    );
  }

  /* ---------- pipeline rows ---------- */

  function controls(app) {
    if (readOnly()) return null;
    const select = el(
      "select.sel.sel--small",
      { "aria-label": `How far ${app.company} got`, onchange: () => save((s) => ({ apps: moveApp(s.apps, app.id, select.value) }), { kind: "search.moved", payload: { stage: select.value } }) },
      STAGES.map((stage) => el("option", { value: stage.id, selected: stage.id === app.stage ? "" : null }, stage.label))
    );
    return [
      el(
        "div.sapp__acts",
        {},
        select,
        btn({ label: app.closed ? "Reopen" : "Close", variant: "quiet", onclick: () => save((s) => ({ apps: closeApp(s.apps, app.id, !app.closed) })) }),
        btn({ label: "Delete", variant: "quiet", onclick: () => confirm(`Delete ${app.company || "this"} from your log?`) && save((s) => ({ apps: removeApp(s.apps, app.id) })) }),
        shareControl(app)
      ),
      shareBox(app),
    ];
  }

  /* ---------- bring a posting from anywhere ---------- */

  const zTitle = field({ label: "Role", id: "pz-title", placeholder: "Forward Deployed Engineer" });
  const zCompany = field({ label: "Company", id: "pz-company", placeholder: "Acme AI" });
  const zUrl = field({ label: "Link", id: "pz-url", type: "url", placeholder: "https://…" });
  const zText = field({ label: "The posting (paste the text)", id: "pz-text", textarea: true });
  zText.input.rows = 6;
  const pasteForm = el(
    "form.slog",
    {
      onsubmit: (event) => {
        event.preventDefault();
        if (!zTitle.input.value.trim() && !zText.input.value.trim()) return toast("Paste the posting or at least the title.", "warn");
        drawer.open({ pasted: { title: zTitle.input.value.trim(), company: zCompany.input.value.trim(), url: zUrl.input.value.trim(), description: zText.input.value } });
      },
    },
    el("div.slog__grid", {}, zTitle.node, zCompany.node, zUrl.node),
    zText.node,
    el("div.row", {}, el("button.b.b--solid", { type: "submit" }, "Prepare it"))
  );

  /* ---------- log anything else ---------- */

  const lCompany = field({ label: "Company", id: "lg-company" });
  const lRole = field({ label: "Role or person", id: "lg-role" });
  const lKind = el("select.sel", { id: "lg-kind", "aria-label": "What you sent" }, el("option", { value: "apply" }, "Application"), el("option", { value: "warm" }, "Warm message"));
  const lDate = field({ label: "Sent", id: "lg-date", type: "date", value: isoDate(new Date()) });
  const logForm = el(
    "form.slog",
    {
      onsubmit: (event) => {
        event.preventDefault();
        if (!lCompany.input.value.trim()) return toast("Add the company.", "warn");
        save((s) => ({ apps: addApp(s.apps, { kind: lKind.value, company: lCompany.input.value, role: lRole.input.value, date: lDate.input.value }) }), { kind: "search.logged", payload: { kind: lKind.value, company: lCompany.input.value.trim() } });
        lCompany.input.value = "";
        lRole.input.value = "";
        toast("Logged.");
      },
    },
    el("div.slog__grid", {}, lCompany.node, lRole.node, el("label.field", {}, el("span.field__label", {}, "What"), lKind), lDate.node),
    el("div.row", {}, el("button.b.b--ghost", { type: "submit" }, "Log it"))
  );

  /* ---------- resume ---------- */

  const rLink = field({ label: "Resume link", id: "s-resume-link", type: "url", placeholder: "Google Drive or Dropbox link to the PDF" });
  const rText = field({ label: "Resume text", id: "s-resume-text", textarea: true, placeholder: "Paste the whole resume. Prepare reads it for every role." });
  rText.input.rows = 8;
  const rPortfolio = field({ label: "Portfolio link (optional)", id: "s-portfolio", type: "url", placeholder: "Your site or the project page that proves it" });
  const rStamp = el("span.muted.sresume__stamp");
  const rSave = btn({ label: "Save resume", variant: "ghost", onclick: () => { save(() => ({ resume: cleanResume({ text: rText.input.value, link: rLink.input.value }), portfolio: rPortfolio.input.value.trim().slice(0, 300) }), { kind: "search.resume", payload: {} }); toast("Resume saved."); } });

  /* ---------- layout ---------- */

  const adenOn = el("div.hire__aden");
  const runBox = el("div");
  const runCount = el("span.hire__count");
  const peopleBox = el("div");
  const targetsBox = el("div");
  const liveBox = el("div");
  const allBox = el("div");
  const storyBox = el("div");
  const freshBox = el("div");
  const radarNote = el("span.hire__count.hire__count--quiet");
  const headBox = el("div");

  /** Which tool this page is (#/do/<tool>). */
  let focus = TOOL_IDS.includes(initialTool) ? initialTool : "today";

  /** The node's own header, like a step page: back to the map, what this is, why, and the steps it powers. */
  function nodeHead(doneToday) {
    const tool = TOOLS[focus];
    const modules = TOOL_STEPS[focus] ?? [];
    const steps = (current.state.graph?.nodes ?? []).filter((node) => modules.includes(String(node.moduleRef ?? "").split("@")[0]));
    return el(
      "header.tool__head",
      {},
      el("div.row.tool__nav", {}, btn({ label: "← Map", variant: "quiet", onclick: () => current.navigate("map") }), el("span.tool__crumb", {}, "Every day · in parallel")),
      el("h1.tool__title", {}, tool.label),
      el("p.tool__why", {}, TOOL_WHY[focus]),
      steps.length
        ? el(
            "div.tool__steps",
            {},
            el("span", {}, "Works on these map steps:"),
            steps.map((node) => el("button.chip2.tool__step", { type: "button", class: node.status === STATUS.LIT ? "is-lit" : null, onclick: () => current.navigate("map", node.id) }, `${String(node.n).padStart(2, "0")} ${node.title}`))
          )
        : null,
      focus === "today" && doneToday ? el("p.tool__count", {}, `${doneToday} sent today`) : null
    );
  }

  function draw() {
    const s = student();
    const now = new Date();
    const { items: moves, doneToday } = runList();
    mount(headBox, nodeHead(doneToday));

    const working = (careerOf(s).working ?? []).filter((w) => !w.done && w.text);
    mount(adenOn, working.length ? [el("b", {}, "Your coach is on"), el("ul", {}, working.slice(0, 4).map((w) => el("li", {}, w.text)))] : null);
    adenOn.hidden = !working.length || focus !== "today";

    // Today: every move, in order, the first one is the next move the map marks.
    mount(
      runBox,
      moves.length
        ? el("ol.run", {}, moves.map((m, i) => { const item = renderMove(m); if (!i) item.classList.add("is-first"); return item; }))
        : el("p.muted", {}, "Nothing left for today. Rest is part of a long search.")
    );
    runCount.textContent = doneToday ? `${doneToday} sent today` : "";

    // Applications: the fresh roles from the run, then everything in flight.
    const fresh = moves.filter((m) => m.kind === "apply");
    mount(freshBox, fresh.length ? el("ol.run", {}, fresh.map(renderMove)) : el("p.muted", {}, radar.loading ? "Looking for fresh roles…" : "No fresh roles match your titles right now. Bring one in below: any posting can be prepared."));

    mount(peopleBox, peopleList());
    mount(targetsBox, targetsBlock());
    mount(importSlot, importBox());
    const { apps } = searchOf(s);
    const live = active(apps);
    mount(liveBox, live.length ? el("div.sapps", {}, live.map((a) => appRow(a, { actions: controls(a), now }))) : el("p.muted", {}, "No replies yet. They come from warm asks and early, specific applications."));
    mount(allBox, apps.length ? el("div.sapps", {}, apps.map((a) => appRow(a, { actions: controls(a), now }))) : el("p.muted", {}, "Everything you send shows up here."));
    mount(storyBox, storyCard(s));
    const resume = searchOf(s).resume;
    if (document.activeElement !== rLink.input) rLink.input.value = resume?.link ?? "";
    if (document.activeElement !== rText.input) rText.input.value = resume?.text ?? "";
    if (document.activeElement !== rPortfolio.input) rPortfolio.input.value = searchOf(s).portfolio ?? "";
    rStamp.textContent = resume?.at ? `Saved ${new Date(resume.at).toLocaleDateString()}` : "";
    for (const form of [peopleForm, pasteForm, logForm]) form.querySelectorAll("input, select, textarea, button").forEach((n) => n.toggleAttribute("disabled", readOnly()));
    rSave.disabled = readOnly();
    for (const [tool, section] of Object.entries(sections)) section.hidden = tool !== focus;
    document.title = `${TOOLS[focus].label} · ${s.name} · GridSchool`;
  }

  /* ---------- positioning: headline, About and titles, drafted from their resume (positioning_api.py) ---------- */

  let positioning = { busy: false, result: null, error: "" };
  async function runPositioning() {
    if (positioning.busy || readOnly()) return;
    positioning = { busy: true, result: null, error: "" };
    redraw();
    try {
      const result = await draftPositioning(ctx.state.slug);
      positioning = { busy: false, result, error: "" };
      toast(result.saved ? "Your headline and About are ready." : "Your draft is ready to compare.");
      if (result.titles?.length) void loadRadar(result.titles);
    } catch (error) {
      positioning = { busy: false, result: null, error: error.message };
    }
    redraw();
  }

  const profileStep = () => {
    const career = careerOf(student());
    const result = positioning.result;
    const mine = Boolean(student()?.career?.auto?.positioning) || Boolean(result?.saved);
    const headline = result?.saved ? result.draft.headline : career.headline;
    const about = result?.saved ? result.draft.about : career.about;
    const status = positioning.busy
      ? el("p.muted", {}, "Drafting from your resume. This takes up to a minute.")
      : positioning.error
        ? el("p.muted", {}, positioning.error)
        : result
          ? el("p.muted", {}, result.note)
          : null;
    const draftBtn = readOnly() || !radarReady()
      ? null
      : btn({
          label: positioning.busy ? "Drafting…" : !headline ? "Draft my headline and About" : mine ? "Draft again" : "Draft my own to compare",
          variant: headline ? "quiet" : "solid",
          onclick: () => runPositioning(),
        });
    const compare =
      result && !result.saved
        ? el(
            "div.sstory",
            {},
            el("b", {}, "Your draft"),
            result.draft.headline ? el("p.sstory__headline", {}, result.draft.headline) : null,
            el(
              "div.row",
              {},
              result.draft.headline ? btn({ label: "Copy headline", variant: "ghost", onclick: () => copy(result.draft.headline, "Headline copied.") }) : null,
              result.draft.about ? btn({ label: "Copy About", variant: "quiet", onclick: () => copy(result.draft.about, "About copied.") }) : null
            )
          )
        : null;
    const confirm = (result?.draft?.confirm ?? (mine ? career.confirm : [])).filter(Boolean);
    const check = confirm.length ? el("div.sstory__part", {}, el("b", {}, "Answer these for yourself before you post"), el("ul", {}, confirm.map((q) => el("li", {}, q)))) : null;
    if (!headline)
      return el(
        "div",
        {},
        el("p.muted", {}, "Draft your headline, your About and the titles to search under from the resume you built. Your coach can sharpen it with you on a call."),
        el("div.row", {}, draftBtn),
        status
      );
    return el(
      "div",
      {},
      el(
        "div.row",
        {},
        btn({ label: "Copy headline", variant: "ghost", onclick: () => copy(headline, "Headline copied.") }),
        about ? btn({ label: "Copy About", variant: "ghost", onclick: () => copy(about, "About copied.") }) : null,
        readOnly() || searchOf(student()).profileAt ? null : btn({ label: "It's live on LinkedIn", variant: "solid", onclick: () => save(() => ({ profileAt: new Date().toISOString() }), { kind: "search.profile", payload: {} }) }),
        draftBtn
      ),
      status,
      check,
      compare
    );
  };
  const profileActions = el("div");

  const sections = {
    today: el("section.tool__body", {}, adenOn, el("header.hire__runhead", {}, el("h2", {}, "In order"), runCount), runBox),
    targets: el("section.tool__body", {}, targetsBox),
    people: el("section.tool__body", {}, el("div.hire__cols", {}, panel({ eyebrow: "Your way in", title: "People" }, peopleBox, el("details.hire__more", {}, el("summary", {}, "Add someone"), peopleForm)), panel({ eyebrow: "Who you already know", title: "Connections" }, importSlot))),
    applications: el(
      "section.tool__body",
      {},
      el("header.hire__runhead", {}, el("h2", {}, "Fresh roles for your titles"), radarNote),
      freshBox,
      el("div.hire__quiet", {}, el("details.hire__fold", { open: "" }, el("summary", {}, "Bring a posting from anywhere"), pasteForm), el("details.hire__fold", {}, el("summary", {}, "Live conversations"), liveBox), el("details.hire__fold", {}, el("summary", {}, "Log something you sent"), logForm), el("details.hire__fold", {}, el("summary", {}, "Everything you've sent"), allBox))
    ),
    profile: el("section.tool__body", {}, panel({ eyebrow: "Your positioning", title: "Your story" }, storyBox, profileActions), panel({ eyebrow: "Keep it current", title: "Resume and portfolio" }, el("div.sresume", {}, rLink.node, rPortfolio.node, rText.node, el("div.row", {}, rSave, rStamp)))),
  };

  const node = el("div.view.view--hire.view--tool", {}, headBox, ...Object.values(sections), drawer.layer, camp.layer);

  /** Open the Targets tool and put the cursor in its "any company" form, once the route has drawn it. */
  function openTargetForm() {
    if (focus !== "targets") current.navigate("do", "targets");
    let tries = 0;
    const land = () => {
      const form = document.querySelector(".tany");
      if (form && form.offsetParent) {
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("tg-company")?.focus({ preventScroll: true });
      } else if (++tries < 30) requestAnimationFrame(land);
    };
    requestAnimationFrame(land);
  }

  function redraw() {
    mount(profileActions, profileStep());
    draw();
  }

  redraw();
  void loadRadar();
  void loadWins();
  // #/do/targets/<campaign id> opens that campaign (a campaign node on the map links here).
  let openedFor = null;
  const openFromRoute = (id) => {
    if (!id || id === openedFor || !targetsOf(student()).some((t) => t.id === id)) return;
    openedFor = id;
    camp.open(id);
  };
  openFromRoute(campaignId);

  return {
    node,
    update(next, tool, id) {
      current = next;
      if (TOOL_IDS.includes(tool)) focus = tool;
      redraw();
      camp.refresh();
      if (!id) openedFor = null;
      openFromRoute(id);
    },
  };
}
