import test from "node:test";
import assert from "node:assert/strict";
import {
  addApp,
  moveApp,
  closeApp,
  removeApp,
  editApp,
  normalizeApp,
  funnel,
  thisWeek,
  weeklySeries,
  followUps,
  active,
  diagnose,
  weeklyReport,
  currentResume,
  careerOf,
  titleTerms,
  roleScore,
  matchRoles,
} from "./search.js?v=8b71053-202610102102";

// Friday 2026-10-09; its week starts Monday 2026-10-05.
const now = new Date(2026, 9, 9, 15, 0);

function log(entries) {
  let apps = [];
  for (const entry of entries) apps = addApp(apps, entry, now);
  return apps;
}

test("normalizeApp: defaults, bad stage, bad date, clipping", () => {
  const app = normalizeApp({ company: "  Acme  ", stage: "hired", date: "yesterday", kind: "nope" }, now);
  assert.equal(app.company, "Acme");
  assert.equal(app.stage, "sent");
  assert.equal(app.kind, "apply");
  assert.equal(app.date, "2026-10-09");
  assert.equal(app.closed, false);
  assert.ok(app.id.startsWith("a"));
  assert.equal(normalizeApp({ company: "x".repeat(500) }, now).company.length, 120);
});

test("add, move, close, edit, remove keep the list consistent", () => {
  let apps = log([{ company: "A", date: "2026-10-06" }, { company: "B", kind: "warm", date: "2026-10-07" }]);
  assert.equal(apps.length, 2);
  assert.equal(apps[0].company, "B", "newest first");
  const a = apps.find((app) => app.company === "A");
  apps = moveApp(apps, a.id, "screen", now);
  assert.equal(apps.find((app) => app.id === a.id).stage, "screen");
  apps = closeApp(apps, a.id, true, now);
  assert.equal(apps.find((app) => app.id === a.id).closed, true);
  apps = moveApp(apps, a.id, "interview", now);
  assert.equal(apps.find((app) => app.id === a.id).closed, false, "moving forward reopens");
  apps = editApp(apps, a.id, { role: "FDE", stage: "nonsense" }, now);
  const edited = apps.find((app) => app.id === a.id);
  assert.equal(edited.role, "FDE");
  assert.equal(edited.stage, "sent", "an invalid stage in an edit falls back like any input");
  apps = removeApp(apps, a.id);
  assert.equal(apps.length, 1);
});

test("funnel counts every stage an application passed through", () => {
  let apps = log([{ company: "A" }, { company: "B" }, { company: "C" }]);
  apps = moveApp(apps, apps[0].id, "interview", now);
  apps = moveApp(apps, apps[1].id, "replied", now);
  assert.deepEqual(
    funnel(apps).map((stage) => stage.count),
    [3, 2, 1, 1, 0]
  );
});

test("thisWeek and weeklySeries use Monday-based weeks", () => {
  const apps = log([
    { company: "Mon", date: "2026-10-05" },
    { company: "Sun before", date: "2026-10-04" },
    { company: "Warm", kind: "warm", date: "2026-10-09" },
    { company: "Old", date: "2026-09-01" },
  ]);
  assert.deepEqual(thisWeek(apps, now), { start: "2026-10-05", apply: 1, warm: 1 });
  const series = weeklySeries(apps, now, 2);
  assert.deepEqual(series, [
    { week: "2026-09-28", apply: 1, warm: 0 },
    { week: "2026-10-05", apply: 1, warm: 1 },
  ]);
});

test("followUps: open, still at sent, 7+ days old", () => {
  let apps = log([
    { company: "Due", date: "2026-10-01" },
    { company: "Fresh", date: "2026-10-05" },
    { company: "Replied", date: "2026-09-20" },
    { company: "Closed", date: "2026-09-20" },
  ]);
  apps = moveApp(apps, apps.find((a) => a.company === "Replied").id, "replied", now);
  apps = closeApp(apps, apps.find((a) => a.company === "Closed").id, true, now);
  assert.deepEqual(followUps(apps, now).map((a) => a.company), ["Due"]);
  assert.deepEqual(active(apps).map((a) => a.company), ["Replied"]);
});

test("diagnose walks the funnel in order", () => {
  const story = { career: { headline: "SWE · AI integrations" } };
  assert.equal(diagnose({ student: {}, now }).id, "findable");
  assert.equal(diagnose({ student: { ...story }, now }).id, "start");

  const cold = log(Array.from({ length: 20 }, (_, i) => ({ company: `C${i}`, date: "2026-09-20" })));
  assert.equal(diagnose({ student: { ...story, search: { apps: cold } }, now }).id, "replies");

  let replies = log(Array.from({ length: 6 }, (_, i) => ({ company: `R${i}`, date: "2026-10-06" })));
  for (const app of replies.slice(0, 3)) replies = moveApp(replies, app.id, "replied", now);
  assert.equal(diagnose({ student: { ...story, search: { apps: replies } }, now }).id, "screens");

  const few = log([{ company: "One", date: "2026-10-06" }]);
  assert.equal(diagnose({ student: { ...story, search: { apps: few } }, now }).id, "volume");

  const paced = log(Array.from({ length: 15 }, (_, i) => ({ company: `P${i}`, date: "2026-10-06" })));
  const withReply = moveApp(paced, paced[0].id, "replied", now);
  assert.equal(diagnose({ student: { ...story, search: { apps: withReply } }, now }).id, "moving");

  const offer = moveApp(few, few[0].id, "offer", now);
  assert.equal(diagnose({ student: { ...story, search: { apps: offer } }, now }).id, "offer");
});

test("weeklyReport carries the numbers, the stall and the follow-ups", () => {
  const apps = log([{ company: "Acme", role: "FDE", date: "2026-09-28" }, { company: "Beta", date: "2026-10-06" }]);
  const text = weeklyReport({ student: { name: "Cal", career: { headline: "x", targets: { apply: 10 } }, search: { apps } }, now });
  assert.match(text, /^Cal · job search · week of 2026-10-05/);
  assert.match(text, /This week: 1 \/ 10 applications · 0 \/ 10 warm messages/);
  assert.match(text, /All time: 2 sent → 0 replied/);
  assert.match(text, /Acme, FDE \(sent 2026-09-28\)/);
});

test("currentResume picks the newer copy and says whose", () => {
  assert.equal(currentResume({}), null);
  const student = {
    search: { resume: { text: "mine", at: "2026-10-09T10:00:00Z" } },
    career: { resume: { link: "https://x", at: "2026-10-08T10:00:00Z" } },
  };
  assert.equal(currentResume(student).from, "student");
  student.career.resume.at = "2026-10-10T00:00:00Z";
  assert.equal(currentResume(student).from, "aden");
});

test("careerOf fills defaults, targets merge", () => {
  const career = careerOf({ career: { targets: { apply: 20 } } });
  assert.deepEqual(career.targets, { apply: 20, warm: 10 });
  assert.deepEqual(career.story, { who: "", what: "", next: "" });
});

test("roles: title terms, scoring and matching", () => {
  const titles = ["Forward Deployed Engineer", "Applied AI Engineer", "Solutions Engineer (AI)"];
  assert.deepEqual(titleTerms(titles), ["forward deployed", "applied", "ai", "solutions"]);
  assert.equal(roleScore({ title: "Forward Deployed Engineer, Enterprise" }, titles), 2);
  assert.equal(roleScore({ title: "Applied AI Engineer" }, titles), 3);
  assert.equal(roleScore({ title: "Software Engineer, Backend" }, titles), 1);
  assert.equal(roleScore({ title: "Staff Forward Deployed Engineer" }, titles), 0, "out-of-level titles drop");
  assert.equal(roleScore({ title: "Account Executive" }, titles), 0);
  const roles = [
    { key: "a", title: "Account Executive" },
    { key: "b", title: "Software Engineer", published_at: "2026-10-08" },
    { key: "c", title: "Forward Deployed Engineer", published_at: "2026-10-01" },
    { key: "d", title: "Applied AI Engineer", published_at: "2026-10-02" },
  ];
  assert.deepEqual(matchRoles(roles, titles).map((r) => r.key), ["d", "c", "b"]);
  assert.deepEqual(matchRoles(roles, titles, { appliedKeys: new Set(["d"]) }).map((r) => r.key), ["c", "b"]);
});

import { addPerson, movePerson, toAsk, peopleLinks, followUpText, referralText, dailyTargets, weekdaysLeft, markFollowed, keepPack, ageLabel, MAX_PACKS } from "./search.js?v=8b71053-202610102102";

test("people: warm first, then met, then cold; moving out of todo drops them", () => {
  let people = [];
  people = addPerson(people, { name: "Cold One", relation: "cold" }, now);
  people = addPerson(people, { name: "Old Colleague", relation: "colleague" }, now);
  people = addPerson(people, { name: "Met Once", relation: "met" }, now);
  assert.deepEqual(toAsk(people).map((p) => p.name), ["Old Colleague", "Met Once", "Cold One"]);
  people = movePerson(people, people.find((p) => p.name === "Old Colleague").id, "asked", now);
  assert.deepEqual(toAsk(people).map((p) => p.name), ["Met Once", "Cold One"]);
  assert.equal(addPerson([], { name: "X", relation: "boss" }, now)[0].relation, "cold");
});

test("peopleLinks are search links the student opens; nothing for no company", () => {
  assert.deepEqual(peopleLinks(""), []);
  const links = peopleLinks("Acme AI");
  assert.equal(links.length, 4);
  assert.ok(links.every((l) => /^https:\/\//.test(l.href)));
  assert.match(decodeURIComponent(links[1].href), /site:linkedin.com\/in "Acme AI"/);
});

test("drafts: follow-up and referral read naturally and sign with a first name", () => {
  const student = { name: "Calixte Simeon", career: { story: { what: "Gets into old code and ships." }, titles: ["Forward Deployed Engineer", "Applied AI Engineer"] } };
  const follow = followUpText({ company: "Acme", role: "FDE", date: "2026-10-01" }, student);
  assert.match(follow, /the FDE role at Acme \(sent 2026-10-01\)/);
  assert.match(follow, /building gets into old code and ships,/);
  assert.match(follow, /\n\nCalixte$/);
  const ask = referralText({ name: "Jordan Lee", company: "Beta" }, student);
  assert.match(ask, /^Hi Jordan,/);
  assert.match(ask, /Forward Deployed Engineer or Applied AI Engineer/);
  assert.match(ask, /you're at Beta/);
});

test("daily targets spread what's left over the weekdays, capped", () => {
  assert.equal(weekdaysLeft(new Date(2026, 9, 5)), 5);
  assert.equal(weekdaysLeft(new Date(2026, 9, 9)), 1);
  assert.equal(weekdaysLeft(new Date(2026, 9, 10)), 1);
  const monday = dailyTargets({ student: { search: { apps: [] } }, now: new Date(2026, 9, 5, 9) });
  assert.deepEqual([monday.apply.target, monday.warm.target], [3, 2]);
  const friday = dailyTargets({ student: { search: { apps: [] } }, now: new Date(2026, 9, 9, 9) });
  assert.deepEqual([friday.apply.target, friday.warm.target], [5, 4], "catch-up is capped");
  const busy = log(Array.from({ length: 15 }, (_, i) => ({ company: `B${i}`, date: "2026-10-06" })));
  assert.equal(dailyTargets({ student: { search: { apps: busy } }, now: new Date(2026, 9, 9, 9) }).apply.target, 0);
});

test("follow-ups restart after a nudge and stop after two", () => {
  let apps = log([{ company: "Due", date: "2026-09-20" }]);
  assert.equal(followUps(apps, now).length, 1);
  apps = markFollowed(apps, apps[0].id, now);
  assert.equal(followUps(apps, now).length, 0, "just nudged");
  const later = new Date(2026, 9, 20);
  assert.equal(followUps(apps, later).length, 1, "a week later, again");
  apps = markFollowed(apps, apps[0].id, later);
  assert.equal(followUps(apps, new Date(2026, 10, 10)).length, 0, "two nudges is enough");
});

test("packs keep the newest MAX_PACKS; ages read plainly", () => {
  let packs = {};
  for (let i = 0; i < MAX_PACKS + 5; i += 1) packs = keepPack(packs, `k${i}`, { pack: {} }, new Date(2026, 9, 1, 0, i));
  assert.equal(Object.keys(packs).length, MAX_PACKS);
  assert.ok(packs[`k${MAX_PACKS + 4}`] && !packs.k0);
  assert.equal(ageLabel(new Date(2026, 9, 9, 10).toISOString(), now), "today");
  assert.equal(ageLabel(new Date(2026, 9, 6, 10).toISOString(), now), "3 days old");
  assert.equal(ageLabel(null, now), "");
});

import { parseConnections, companyKey, insideConnections, insiderText } from "./search.js?v=8b71053-202610102102";

test("LinkedIn connections export: notes preamble, quoted commas, missing companies dropped", () => {
  const csv = [
    "Notes:",
    '"When exporting your connection data, you may notice that some of the email addresses are missing."',
    "",
    "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
    'Jordan,Lee,https://www.linkedin.com/in/jlee,,"Rebar, Inc.",Engineering Manager,01 Jan 2024',
    "Sam,Park,https://www.linkedin.com/in/spark,,,Student,02 Feb 2023",
    "Ana,Ruiz,https://www.linkedin.com/in/aruiz,,Column,Software Engineer,03 Mar 2022",
  ].join("\r\n");
  const rows = parseConnections(csv);
  assert.deepEqual(rows, [
    ["Jordan Lee", "Rebar, Inc.", "Engineering Manager", "https://www.linkedin.com/in/jlee"],
    ["Ana Ruiz", "Column", "Software Engineer", "https://www.linkedin.com/in/aruiz"],
  ]);
  assert.deepEqual(parseConnections("nothing here"), []);
});

test("companyKey and insideConnections match a role to the people there", () => {
  assert.equal(companyKey("Rebar, Inc."), companyKey("rebar"));
  assert.equal(companyKey("Acme Labs (YC W25)"), "acme");
  const rows = [["Jordan Lee", "Rebar, Inc.", "EM", "u1"], ["Ana Ruiz", "Column", "SWE", "u2"]];
  const roles = [{ key: "a", company: "Rebar", title: "Applied AI Engineer" }, { key: "b", company: "Nobody", title: "SWE" }];
  const hits = insideConnections(roles, rows);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].people[0].name, "Jordan Lee");
  const text = insiderText(hits[0].people[0], hits[0].role, { name: "Cal Simeon", career: { story: { what: "Ships AI into old systems." } } });
  assert.match(text, /^Hi Jordan, I saw Rebar is hiring for Applied AI Engineer and I'm applying\./);
  assert.match(text, /My work is ships AI into old systems\./);
});

import { shortTitle } from "./search.js?v=8b71053-202610102102";
test("shortTitle keeps parentheses whole", () => {
  assert.equal(shortTitle("Software Engineers (Product, Applied AI), Designers"), "Software Engineers (Product, Applied AI)");
  assert.equal(shortTitle("Forward Deployed Engineer"), "Forward Deployed Engineer");
});

import { addTarget, touchTarget, patchTarget, dueTouches, nextTouch, targetCandidates, fillLinks, MAX_ACTIVE_TARGETS } from "./search.js?v=8b71053-202610102102";

test("targets: one active per company, day 0 first, then the cadence", () => {
  const day0 = new Date(2026, 9, 5, 9);
  let targets = addTarget([], { company: "Rebar", role: "Applied AI", roleKey: "hn:x:1" }, day0);
  targets = addTarget(targets, { company: "Rebar, Inc.", role: "Other" }, day0);
  assert.equal(targets.length, 1, "same company once");
  const id = targets[0].id;
  assert.deepEqual(dueTouches(targets, day0).map((d) => [d.kind, d.channels.join("+")]), [["day0", "email+linkedin+call"]]);
  targets = touchTarget(targets, id, "email", day0);
  targets = touchTarget(targets, id, "linkedin", day0);
  assert.equal(nextTouch(targets[0], day0), "Day 0: Call");
  targets = touchTarget(targets, id, "call", day0);
  assert.equal(dueTouches(targets, new Date(2026, 9, 7)).length, 0, "day 2: nothing due");
  assert.equal(nextTouch(targets[0], new Date(2026, 9, 7)), "Day 3 follow-up in 1 day");
  assert.equal(dueTouches(targets, new Date(2026, 9, 8))[0].day, 3);
  targets = touchTarget(targets, id, "d3", new Date(2026, 9, 8));
  assert.equal(dueTouches(targets, new Date(2026, 9, 12))[0].day, 7);
  targets = patchTarget(targets, id, { state: "replied" });
  assert.equal(dueTouches(targets, new Date(2026, 9, 30)).length, 0);
  assert.equal(nextTouch(targets[0]), "Replied");
  assert.equal(MAX_ACTIVE_TARGETS, 5);
});

test("targetCandidates: strong fits and insiders first, weak and taken left out", () => {
  const roles = [
    { key: "a", company: "Alpha", title: "FDE", score: 2 },
    { key: "b", company: "Beta", title: "FDE", score: 2 },
    { key: "c", company: "Gamma", title: "FDE", score: 3 },
    { key: "d", company: "Delta", title: "FDE", score: 2, ats: "hn" },
  ];
  const packs = { a: { pack: { fit_level: "strong" } }, c: { pack: { fit_level: "weak" } } };
  const network = [["Jo Insider", "Beta", "EM", "u"]];
  const out = targetCandidates({ roles, packs, network, targets: [{ company: "Delta", state: "active" }] });
  assert.deepEqual(out.map((c) => c.role.key), ["a", "b"]);
  assert.deepEqual(out[1].reasons, ["you know Jo Insider"]);
  assert.equal(out[1].insider, "Jo Insider");
});

test("fillLinks puts in the Loom and drops an unused portfolio line", () => {
  const body = "Here's a 90-second walkthrough: [Loom link]\nPortfolio: [portfolio link]\nThanks";
  assert.equal(fillLinks(body, { loom: "https://loom.com/share/x" }), "Here's a 90-second walkthrough: https://loom.com/share/x\nThanks");
  assert.match(fillLinks(body, { loom: "L", portfolio: "P" }), /Portfolio: P/);
});

test("a target made by hand keeps what they pasted for the campaign", () => {
  const [t] = addTarget([], { company: "Acme", role: "FDE", posting: "We build agents for claims. ".repeat(20) }, now);
  assert.equal(t.roleKey, undefined);
  assert.match(t.posting, /^We build agents for claims\./);
  assert.equal(addTarget([], { company: "X", posting: "y".repeat(20000) }, now)[0].posting.length, 12000);
});
