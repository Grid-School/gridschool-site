/**
 * Your companies (the walk's fourth screen), on the 2026-11-03 critique. Finding the right companies is our
 * work: the screen offers one company at a time as a yes or no, with the strongest true reason, and never a
 * posting the record says is a knockout (search.js knockout). The student's own company is a quiet link that
 * becomes the object when we have nothing. Once one company is in, the frame's Continue takes the solid.
 */

import { el, mount } from "../dom.js?v=3c8024f-202611042144";
import { toast } from "../ui.js?v=3c8024f-202611042144";
import { isProgressReadOnly } from "../store.js?v=3c8024f-202611042144";
import { matchedRoles, fetchPacks, radarReady, draftApproach } from "../roles-remote.js?v=3c8024f-202611042144";
import { loadResume } from "../resume-remote.js?v=3c8024f-202611042144";
import { targetCandidates, addTarget, closeTarget, activeTargets, targetsOf, searchOf, networkOf, packsOf, knockout, yearsOnRecord, patchTarget, MAX_ACTIVE_TARGETS } from "../search.js?v=3c8024f-202611042144";

const PASSED = (slug) => `gridschool.targets.passed.${slug}`;
const solid = (label, onclick) => el("button.sw__solid", { type: "button", onclick }, label);
const ghost = (label, onclick) => el("button.sw__ghost", { type: "button", onclick }, label);
const quiet = (label, onclick) => el("button.sw__quiet", { type: "button", onclick }, label);
const shortRole = (title) => String(title || "").split(/\s+-\s+|\s+\|\s+/)[0];

export function renderTargetsPick(ctx, options = {}) {
  const root = el("div.sw.tp");
  let current = ctx;
  let slug = ctx.state.slug;
  let roles = null; // null until the postings answer; [] when there are none
  let packs = {};
  let titles = [];
  let years = null;
  let error = "";
  let passed = new Set();
  let dropped = 0; // postings the knockout rule removed
  let showOwn = false;
  let ownError = "";
  const drafts = new Map();

  const readOnly = () => isProgressReadOnly();
  const student = () => current.state.student;
  const save = (change, event = null) => current.store.updateSearch(change, event);

  try { passed = new Set(JSON.parse(localStorage.getItem(PASSED(slug)) || "[]")); } catch { /* fine */ }
  const remember = () => { try { localStorage.setItem(PASSED(slug), JSON.stringify([...passed])); } catch { /* fine */ } };

  async function load() {
    if (!radarReady()) { roles = []; error = ""; return render(); }
    try {
      const rec = await loadResume(slug).catch(() => null);
      titles = (rec?.targets || []).map((t) => t.title).filter(Boolean);
      if (!titles.length) titles = ["Software Engineer"];
      years = yearsOnRecord(rec?.graph);
      const [out, p] = await Promise.all([matchedRoles({ titles, days: 21, limit: 60 }), fetchPacks(slug).catch(() => ({}))]);
      const all = out.roles || [];
      const kept = all.filter((r) => !knockout(r, { years }));
      dropped = all.length - kept.length;
      roles = kept;
      packs = p || {};
      error = "";
    } catch (e) {
      roles = [];
      error = e.message;
    }
    render();
  }

  /** One company at a time, warmest first, never one already picked or skipped. */
  function offers() {
    const s = student();
    const ranked = targetCandidates({ roles: (roles || []).filter((r) => !passed.has(r.key)), packs: { ...packsOf(s), ...packs }, network: networkOf(s), apps: searchOf(s).apps, targets: targetsOf(s) }, 40);
    const seen = new Set();
    const out = [];
    for (const c of ranked) {
      const key = String(c.role.company || "").trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }

  /** The strongest true fact about this company for this student, in their terms. Never a string match. */
  function reason(c) {
    const r = c.role;
    const pack = packs[r.key]?.pack || packsOf(student())[r.key]?.pack;
    if (c.insider) return `You know ${c.insider} there.`;
    if (r.min_years != null && years != null) {
      if (r.min_years <= years) return `They ask for ${r.min_years} years. You have ${years}.`;
      return `They ask for ${r.min_years} years. You have ${years}. Close enough to ask.`;
    }
    if (pack?.fit && pack.fit_level === "strong") return pack.fit;
    if (r.min_years != null) return `They ask for ${r.min_years} years.`;
    return "";
  }

  function facts(c) {
    const r = c.role;
    const bits = [shortRole(r.title)];
    if (r.workplace === "remote") bits.push("remote");
    else if (r.location) bits.push(String(r.location).split(",")[0]);
    return bits.filter(Boolean).join(" · ");
  }

  /** The company is worked out in the background the moment it's picked, so the next screen opens on a move. */
  function workOut(target) {
    if (!target || target.approach || readOnly()) return;
    const req = target.roleKey ? { roleKey: target.roleKey } : { role: { company: target.company, title: target.role, url: target.link, description: target.posting || target.why } };
    draftApproach(slug, req).then((result) => {
      save((x) => ({ targets: patchTarget(x.targets, target.id, { approach: result.approach }) }), { kind: "search.approach", payload: { company: target.company } });
    }).catch(() => null);
  }

  function pick(c) {
    if (activeTargets(student()).length >= MAX_ACTIVE_TARGETS) return;
    const r = c.role;
    save((x) => ({ targets: addTarget(x.targets, { company: r.company, role: r.title, roleKey: r.key, link: r.apply_url || r.url, insider: c.insider, why: reason(c), posting: r.description || "" }) }), { kind: "search.target", payload: { company: r.company } });
    const made = activeTargets(student()).find((t) => t.company === r.company);
    workOut(made);
    openOn(made);
  }

  /** A picked company opens on its own first move on the notes screen, never on an older company's wait. */
  function openOn(target) {
    options.next?.settle?.();
    try { if (target) { sessionStorage.setItem("gridschool.sends.focus", target.id); sessionStorage.removeItem("gridschool.sends.person"); } } catch { /* fine */ }
    location.hash = "#/walk/send";
  }

  function skip(c) {
    passed.add(c.role.key);
    remember();
    render();
    toast(`Skipped ${c.role.company}.`, "ok");
  }

  function remove(t) {
    save((x) => ({ targets: closeTarget(x.targets, t.id) }), { kind: "search.target.closed", payload: { company: t.company } });
    render();
  }

  function ownForm({ heading = "Which company do you have in mind?", lead = "We'll find the team and the people." } = {}) {
    const company = el("input.sw__input", { id: "tp-company", "aria-label": "Company name", value: drafts.get("company") || "", "aria-invalid": ownError ? "true" : null });
    company.addEventListener("input", () => { drafts.set("company", company.value); if (ownError) { ownError = ""; render(); } });
    const submit = () => {
      if (!company.value.trim()) { ownError = "Enter a company name"; render(); return; }
      save((x) => ({ targets: addTarget(x.targets, { company: company.value.trim(), role: "", link: "", why: "You named it.", posting: "" }) }), { kind: "search.target", payload: { company: company.value.trim() } });
      const made = activeTargets(student()).find((t) => t.company === company.value.trim());
      workOut(made);
      drafts.clear();
      showOwn = false;
      ownError = "";
      openOn(made);
    };
    return el("div.sw__main", {},
      el("h3.sw__move", {}, heading),
      el("p.sw__lead", {}, lead),
      el("label.sw__label", { for: company.id }, el("span", {}, "Company name"), company, ownError ? el("span.sw__fielderr", {}, ownError) : null),
      el("div.sw__acts", {}, solid("Add this company", submit), roles?.length ? quiet("Back to our pick", () => { showOwn = false; ownError = ""; render(); }) : null));
  }

  function pickedRows(active) {
    return el("ul.sw__queue", {}, ...active.map((t) => el("li.sw__qrow", {},
      el("b", {}, t.company),
      el("span", {}, shortRole(t.role)))));
  }

  /** The margin, on the sweep of 2026-11-03: one line of what happens next, the next company as a line with a
   * quiet door once one is in, the way to name a company, and the way to take one back. Nothing here is the move. */
  function margin(active, next) {
    const n = active.length;
    return el("aside.sw__aside", {},
      el("section.sw__note", {}, el("span.sw__eyebrow", {}, "What happens next"),
        el("p.is-first", {}, n ? "We find who to write to at the company you add." : "You write the first note this week.")),
      null,
      readOnly() ? null : el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Know a company?"),
        el("p", {}, quiet("Add a company you know", () => { showOwn = true; render(); }))),
      n && !readOnly() ? el("section.sw__note", {}, el("span.sw__eyebrow", {}, "Changed your mind?"),
        ...active.map((t) => el("p", {}, quiet(`Remove ${t.company}`, () => remove(t))))) : null);
  }

  /** The one question: the heading asks it, the lead is the strongest fact, the buttons answer it. */
  function offerBlock(c, active = []) {
    const r = c.role;
    const why = reason(c);
    const n = active.length;
    return el("div.sw__main", {},
      el("h3.sw__move", {}, n ? `Add ${r.company}?` : `Start with ${r.company}?`),
      why ? el("p.sw__lead.is-reason", {}, why) : null,
      el("p.tp__facts", {}, facts(c), " · from this month's postings for your title", r.url ? [" · ", el("a.sw__quiet", { href: r.url, target: "_blank", rel: "noopener" }, "Read the posting")] : null),
      readOnly() ? null : el("div.sw__acts", {}, solid(n ? `Add ${r.company}` : "Start here", () => pick(c)), ghost("Show another company", () => skip(c))),
      n ? el("section.tp__have", {}, el("span.sw__eyebrow", {}, n === 1 ? "Your company" : "Your companies"), pickedRows(active),
        options.next && !readOnly() ? el("p", {}, quiet(n === 1 ? `Keep going with ${active[0].company} only` : "Keep going with these", () => options.next.go())) : null) : null);
  }

  function render() {
    const active = activeTargets(student());
    const n = active.length;
    const title = titles[0] || "Software Engineer";
    let main;
    if (showOwn) {
      main = ownForm();
    } else if (roles === null) {
      main = el("div.sw__main", {}, el("h3.sw__move", {}, "Finding companies for you."), el("p.sw__lead", {}, `From this month's ${title} postings.`));
    } else if (error) {
      main = el("div.sw__main", {}, el("h3.sw__move", {}, "We couldn't load this week's postings."), el("p.sw__lead", {}, n ? "That's on our side. Your companies are saved." : "That's on our side. Nothing is lost."),
        el("div.sw__acts", {}, solid("Try again", () => { roles = null; render(); load(); }), quiet("Add a company you know", () => { showOwn = true; render(); })));
    } else if (n >= MAX_ACTIVE_TARGETS) {
      main = el("div.sw__main", {}, el("h3.sw__move", {}, "Your five companies are set."), el("p.sw__lead", {}, "Next, we find who to write to at each one."), pickedRows(active),
        options.next ? el("div.sw__acts", {}, solid(options.next.label, () => options.next.go())) : null);
    } else {
      const next = offers()[0] || null;
      if (!n) {
        if (!next) {
          main = ownForm({
            heading: dropped && !roles.length ? `This week's postings all ask for more than ${years ?? "your"} years.` : `No new ${title} postings yet.`,
            lead: "We check every night. Name a company and we'll do the rest.",
          });
        } else main = offerBlock(next);
      } else if (next) {
        main = offerBlock(next, active);
      } else {
        // Finished the moment one is in: the heading says so and the row is the record. More is a margin line.
        main = el("div.sw__main", {},
          el("h3.sw__move", {}, n === 1 ? `Your first company is ${active[0].company}.` : `You're starting with ${["", "one", "two", "three", "four"][n] || n} companies.`),
          el("p.sw__lead", {}, n === 1 ? "One is enough to start." : "Next, we find who to write to at each one."),
          pickedRows(active),
          options.next ? el("div.sw__acts", {}, solid(options.next.label, () => options.next.go())) : null);
      }
    }
    const nextOffer = roles ? offers()[0] || null : null;
    mount(root, el("section.sw__target", {}, el("div.sw__cols", {}, main, showOwn || error ? null : margin(active, nextOffer))));
  }

  render();
  load();
  return {
    node: root,
    update(next) {
      current = next;
      if (next.state.slug !== slug) {
        slug = next.state.slug;
        roles = null;
        load();
        return;
      }
      render();
    },
  };
}
