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
 * pipeline, and, quieter, the story Aden set, their resume, and a way to bring
 * in a posting they found anywhere.
 *
 * Persistent (boot.js): polls and saves update in place without wiping a
 * half-typed form. Aden sees it read-only from the desk.
 */

import { el, mount } from "../dom.js?v=5802f60-202610100134";
import { panel, btn, field, toast, copy } from "../ui.js?v=5802f60-202610100134";
import { isoDate, fmtDay } from "../time.js?v=5802f60-202610100134";
import { STATUS } from "../graph/model.js?v=5802f60-202610100134";
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
  dueTouches,
  nextTouch,
  targetCandidates,
  DAY0,
  FOLLOWUP_DAYS,
  MAX_ACTIVE_TARGETS,
} from "../search.js?v=5802f60-202610100134";
import { searchRoute, weekBlock, storyCard, appRow } from "./search-parts.js?v=5802f60-202610100134";
import { matchedRoles, radarReady, fetchPacks } from "../roles-remote.js?v=5802f60-202610100134";
import { createPackDrawer } from "./pack.js?v=5802f60-202610100134";
import { createCampaignDrawer } from "./campaign.js?v=5802f60-202610100134";

const RUN_FAMILIES = ["proof", "presence", "network", "interview"];
/** How many moves the day leads with. More than this reads as a wall, not a plan. */
const RUN_SHOWN = 7;

/** The next open step on their map in a lane that builds proof or presence. */
export function nextBuildStep(graph) {
  return (graph?.nodes ?? [])
    .filter((node) => RUN_FAMILIES.includes(node.family) && node.status === STATUS.OPEN)
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0))[0];
}

export function renderHire(ctx) {
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
    onPatch: (id, patch) => save((x) => ({ targets: patchTarget(x.targets, id, patch) })),
    onTouch: (id, channel, entry) =>
      save((x) => ({ targets: touchTarget(x.targets, id, channel), apps: addApp(x.apps, entry) }), { kind: "search.logged", payload: { kind: "warm", company: entry.company, from: `target:${channel}` } }),
  });

  function makeTarget({ role, reasons = [], insider = "" }) {
    if (activeTargets(student()).length >= MAX_ACTIVE_TARGETS) return toast(`Five active targets is the most that get real attention. Close one first.`, "warn");
    if (!String(role.company ?? "").trim()) return toast("A target needs the company.", "warn");
    save((x) => ({ targets: addTarget(x.targets, { company: role.company, role: role.title, roleKey: role.key, link: role.apply_url || role.url, insider, why: reasons.join(", "), posting: role.description ?? "" }) }), { kind: "search.target", payload: { company: role.company } });
    const made = activeTargets(student()).find((t) => (role.key && t.roleKey === role.key) || t.company === role.company);
    if (made) camp.open(made.id);
  }

  function logApplied(role) {
    save(
      (s) => ({ apps: addApp(s.apps, { kind: "apply", company: role.company, role: role.title, link: role.url, roleKey: role.key }) }),
      { kind: "search.logged", payload: { kind: "apply", company: role.company, from: role.key ? "radar" : "pasted" } }
    );
    toast(`Logged: ${role.company}. Now find one person there.`);
  }

  async function loadRadar() {
    if (!radarReady()) return;
    fetchPacks(ctx.state.slug)
      .then((packs) => {
        serverPacks = packs;
        draw();
      })
      .catch(() => {});
    const career = careerOf(student());
    try {
      radar = { ...(await matchedRoles({ titles: career.titles.length ? career.titles : ["Software Engineer"], years: career.years ?? null, limit: 60 })), loading: false };
    } catch (error) {
      radar = { roles: [], off: false, loading: false, error: error.message };
    }
    draw();
  }

  /* ---------- the run ---------- */

  function runItem({ kind, title, sub, actions, done = false }) {
    return el(
      "li.run__item",
      { class: done ? "is-done" : null, "data-kind": kind },
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
          title: `Prepare for your ${app.company} ${app.stage === "screen" ? "screen" : "interview"}`,
          sub: "The questions this loop asks, your two-minute story, and one thing about their product to bring up.",
          actions: [
            btn({ label: "Prep", variant: "solid", onclick: () => drawer.open(target) }),
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
          title: touch.kind === "day0" ? `${t.company}: ${touch.label}` : `${t.company}: ${touch.label}`,
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
          actions: [btn({ label: "Choose", variant: "ghost", onclick: () => document.querySelector(".hire__targets")?.scrollIntoView({ behavior: "smooth" }) })],
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
          title: step.title,
          sub: "Your map's next build step. Proof is what makes the messages land.",
          actions: [btn({ label: "Open step", variant: "ghost", onclick: () => current.navigate("map", step.id) })],
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
  const tLink = field({ label: "Link", id: "tg-link", type: "url", placeholder: "Their posting or their site" });
  const tText = field({ label: "What you know (paste the posting, or a few lines on what they build)", id: "tg-text", textarea: true });
  tText.input.rows = 5;
  const targetForm = el(
    "form.slog",
    {
      onsubmit: (event) => {
        event.preventDefault();
        const company = tCompany.input.value.trim();
        if (!company) return toast("Add the company.", "warn");
        makeTarget({ role: { company, title: tRole.input.value.trim(), url: tLink.input.value.trim(), description: tText.input.value.trim() } });
        for (const f of [tCompany, tRole, tLink, tText]) f.input.value = "";
      },
    },
    el("div.slog__grid", {}, tCompany.node, tRole.node, tLink.node),
    tText.node,
    el("div.row", {}, el("button.b.b--solid", { type: "submit" }, "Make it a target"))
  );

  const targetAny = el("details.hire__more.tany", {}, el("summary", {}, "Target any company"), el("p.muted", {}, "A company you found yourself, or simply want to work for. The campaign is written from what you paste here."), targetForm);

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
        el(
          "div.tcard__dots",
          { "aria-label": "Touches sent" },
          [...DAY0.map((c) => [c.id, c.label.split(" ")[0]]), ...FOLLOWUP_DAYS.map((d) => [`d${d}`, `D${d}`])].map(([key, label]) => el("span.tcard__dot", { class: t.touches?.[key] ? "is-on" : null, title: t.touches?.[key] ? `${label}: ${t.touches[key]}` : label }, label))
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
      cards.length ? el("div.tcards", {}, cards) : el("p.muted", {}, "No targets yet. Pick up to five below: the overlap of hiring for your titles, a strong fit, and a way in."),
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

  /* ---------- pipeline rows ---------- */

  function controls(app) {
    if (readOnly()) return null;
    const select = el(
      "select.sel.sel--small",
      { "aria-label": `How far ${app.company} got`, onchange: () => save((s) => ({ apps: moveApp(s.apps, app.id, select.value) }), { kind: "search.moved", payload: { stage: select.value } }) },
      STAGES.map((stage) => el("option", { value: stage.id, selected: stage.id === app.stage ? "" : null }, stage.label))
    );
    return el(
      "div.sapp__acts",
      {},
      select,
      btn({ label: app.closed ? "Reopen" : "Close", variant: "quiet", onclick: () => save((s) => ({ apps: closeApp(s.apps, app.id, !app.closed) })) }),
      btn({ label: "Delete", variant: "quiet", onclick: () => confirm(`Delete ${app.company || "this"} from your log?`) && save((s) => ({ apps: removeApp(s.apps, app.id) })) })
    );
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

  const headTitle = el("h1.hire__title");
  const headSub = el("p.hire__sub");
  const adenOn = el("div.hire__aden");
  const runBox = el("div");
  const runCount = el("span.hire__count");
  const routeBox = el("div");
  const weekBox = el("div");
  const peopleBox = el("div");
  const targetsBox = el("div");
  const liveBox = el("div");
  const allBox = el("div");
  const storyBox = el("div");

  function draw() {
    const s = student();
    const now = new Date();
    const { items, doneToday, targets } = runList();
    const stall = diagnose({ student: s, now });
    const toDo = items.filter((i) => !i.classList.contains("is-done")).length;
    // The run is ordered by leverage; the first few are the day. The rest wait one click away.
    headTitle.textContent = !toDo ? "Today's run is done" : toDo > RUN_SHOWN ? `${RUN_SHOWN} moves first, ${toDo - RUN_SHOWN} if you have time` : `${toDo} moves today`;
    headSub.textContent = stall.text;
    headSub.className = `hire__sub hire__sub--${stall.tone}`;
    runCount.textContent = doneToday ? `${doneToday} sent today` : "";

    const working = (careerOf(s).working ?? []).filter((w) => !w.done && w.text);
    mount(adenOn, working.length ? [el("b", {}, "Aden is on"), el("ul", {}, working.slice(0, 4).map((w) => el("li", {}, w.text)))] : null);
    adenOn.hidden = !working.length;

    const first = items.slice(0, RUN_SHOWN);
    const later = items.slice(RUN_SHOWN);
    mount(
      runBox,
      items.length
        ? [
            el("ol.run", {}, first),
            later.length ? el("details.run__more", {}, el("summary", {}, `${later.length} more if you have time`), el("ol.run.run--later", { start: String(RUN_SHOWN + 1) }, later)) : null,
          ]
        : el("p.muted", {}, "Nothing left for today. Rest is part of a long search.")
    );
    mount(routeBox, searchRoute({ student: s, graph: current.state.graph, now }));
    mount(weekBox, weekBlock({ student: s, now }));
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
  }

  const node = el(
    "div.view.view--hire",
    {},
    el(
      "header.hire__head",
      {},
      el("b.eyebrow", {}, `Today · ${fmtDay(new Date())}`),
      headTitle,
      headSub,
      adenOn
    ),
    el("section.hire__run", {}, el("header.hire__runhead", {}, el("h2", {}, "The run"), runCount), runBox),
    el("section.hire__targets", {}, el("header.hire__runhead", {}, el("h2", {}, "Targets"), el("span.hire__count.hire__count--quiet", {}, "Email with a Loom · LinkedIn · a call · day 3, 7, 14")), targetsBox),
    el("section.hire__route", {}, el("header.hire__runhead", {}, el("h2", {}, "Where you stand")), routeBox, weekBox),
    el(
      "div.hire__cols",
      {},
      panel({ eyebrow: "Your way in", title: "People", note: "Former colleagues first. Mark someone Sent from the run and it's logged." }, peopleBox, el("details.hire__more", {}, el("summary", {}, "Add someone"), peopleForm), importSlot),
      panel({ eyebrow: "Moving", title: "Live conversations" }, liveBox)
    ),
    el(
      "div.hire__quiet",
      {},
      el("details.hire__fold", {}, el("summary", {}, "Bring a posting from anywhere"), el("p.muted", {}, "Found a role on a company site, a Discord or a Who's Hiring thread? Paste it and Prepare reads it against your record."), pasteForm),
      el("details.hire__fold", {}, el("summary", {}, "Log something you sent"), logForm),
      el("details.hire__fold", {}, el("summary", {}, "Your story, from Aden"), storyBox),
      el("details.hire__fold", {}, el("summary", {}, "Your resume"), el("div.sresume", {}, rLink.node, rPortfolio.node, rText.node, el("div.row", {}, rSave, rStamp))),
      el("details.hire__fold", {}, el("summary", {}, "Everything you've sent"), allBox)
    ),
    drawer.layer,
    camp.layer
  );

  draw();
  void loadRadar();

  return {
    node,
    update(next) {
      current = next;
      draw();
      camp.refresh();
    },
  };
}
