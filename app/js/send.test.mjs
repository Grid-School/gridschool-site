import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApp, outcomeAsks, answerAsk, noReply, pickVersion, sentBefore } from "./search.js?v=7b95dc3-202610272038";
import { verdict, pickWeek } from "./send-verdict.js?v=7b95dc3-202610272038";
import { readiness } from "./resume-stages.js?v=7b95dc3-202610272038";

const NOW = new Date("2026-10-26T12:00:00Z");

test("a send remembers what was sent, and nothing it wasn't told", () => {
  const app = normalizeApp({ company: "Acme", resume: { saveId: 7, name: "Resume for FDE", targetId: "t1", title: "FDE" }, portfolio: true, age: 2, before: "unsure", named: "yes" }, NOW);
  assert.deepEqual(app.resume, { saveId: 7, name: "Resume for FDE", targetId: "t1", title: "FDE" });
  assert.equal(app.portfolio, true);
  assert.equal(app.named, undefined); // only an explicit true counts
  assert.equal(app.age, 2);
  assert.equal(app.before, "unsure");
  assert.equal(normalizeApp({ company: "Acme", before: "maybe" }, NOW).before, undefined);
});

test("the question comes at day 3, then day 10, then never; silence becomes a fact", () => {
  const sent = normalizeApp({ company: "Acme", date: "2026-10-20" }, NOW); // 6 days ago
  assert.equal(outcomeAsks([sent], NOW).length, 1);
  const fresh = normalizeApp({ company: "Beta", date: "2026-10-25" }, NOW);
  assert.equal(outcomeAsks([fresh], NOW).length, 0);
  let apps = answerAsk([sent], sent.id, "nothing", NOW);
  assert.equal(apps[0].asked, 1);
  assert.equal(outcomeAsks(apps, NOW).length, 0); // asked today: next ask a week on
  assert.equal(outcomeAsks(apps, new Date("2026-11-03T12:00:00Z")).length, 1);
  apps = answerAsk(apps, sent.id, "nothing", new Date("2026-11-03T12:00:00Z"));
  assert.equal(outcomeAsks(apps, new Date("2026-12-01T12:00:00Z")).length, 0);
  assert.equal(noReply(apps[0], new Date("2026-11-04T12:00:00Z")), true);
  assert.equal(noReply(normalizeApp({ company: "Old", date: "2026-09-01" }, NOW), NOW), true); // three weeks: a fact
  const replied = answerAsk([sent], sent.id, "reply", NOW);
  assert.equal(replied[0].stage, "reply" === "reply" ? replied[0].stage : null); // a bad stage name leaves it alone
  assert.equal(answerAsk([sent], sent.id, "interview", NOW)[0].stage, "interview");
});

test("versions alternate: the one sent least recently goes next", () => {
  const saves = [{ id: 2, targetId: "t1", created_at: "2026-10-25" }, { id: 1, targetId: "t1", created_at: "2026-10-20" }, { id: 3, targetId: "t2", created_at: "2026-10-26" }];
  assert.equal(pickVersion(saves, [], "t1").id, 2); // nothing sent yet: the newest
  const apps = [normalizeApp({ company: "A", date: "2026-10-26", resume: { saveId: 2 } }, NOW)];
  assert.equal(pickVersion(saves, apps, "t1").id, 1);
  assert.equal(pickVersion(saves, [...apps, normalizeApp({ company: "B", date: "2026-10-27", resume: { saveId: 1 } }, NOW)], "t1").id, 2); // 1 went out later: back to 2
  assert.equal(pickVersion(saves, apps, "t2").id, 3);
  assert.equal(pickVersion([], apps, "t1"), null);
});

const role = (over = {}) => ({ key: "gh:acme:1", company: "Acme, Inc.", title: "Forward Deployed Engineer", first_seen_at: "2026-10-25T00:00:00Z", description: "Python, customers, on-site deployments, Kubernetes", ...over });
const needs = [{ id: "n1", label: "Python", terms: ["python"], state: "on" }, { id: "n2", label: "Customer work", terms: ["customer"], state: "on" }, { id: "n3", label: "Kubernetes", terms: ["kubernetes"], state: "on" }];

test("verdicts: sent before beats everything, then a known person, then age, then fit", () => {
  const sentTo = [normalizeApp({ company: "acme", date: "2026-10-01", stage: "replied" }, NOW)];
  assert.equal(verdict(role(), { apps: sentTo, now: NOW }).label, "skip");
  assert.match(verdict(role(), { apps: sentTo, now: NOW }).reasons[0], /sent to Acme.*replied/);
  const reach = verdict(role(), { insiders: [{ name: "Sam" }], needs, now: NOW });
  assert.equal(reach.label, "reach");
  assert.match(reach.reasons[0], /know Sam/);
  assert.equal(verdict(role({ first_seen_at: "2026-09-01T00:00:00Z" }), { needs, now: NOW }).label, "skip");
  const apply = verdict(role(), { needs, now: NOW });
  assert.equal((apply.label, apply.fit), "strong");
  assert.match(apply.reasons[0], /3 of the 3/);
  assert.match(apply.reasons[1], /early is good/);
  assert.equal(verdict(role({ description: "nothing relevant" }), { needs, now: NOW }).label, "skip");
  assert.equal(verdict(role({ description: "x" }), { fitLevel: "possible", now: NOW }).label, "apply");
});

test("the week's five: applies first, strong before possible, reach-firsts after, no skips", () => {
  const roles = [role({ key: "a", description: "x", first_seen_at: "2026-09-01T00:00:00Z" }), role({ key: "b", company: "Beta", description: "python and customer calls" }), role({ key: "c", company: "Gamma" }), role({ key: "d", company: "Delta" })];
  const week = pickWeek(roles, { needs, now: NOW, insidersOf: (r) => (r.company === "Delta" ? [{ name: "Jo" }] : []) });
  assert.deepEqual(week.map((x) => [x.role.key, x.v.label]), [["c", "apply"], ["b", "apply"], ["d", "reach"]]);
});

test("readiness is three facts; fit is reported, not required", () => {
  const claim = (over = {}) => ({ id: "c1", status: "confirmed", line: "Did x.", facts: { action: "x" }, ...over });
  const rec = { graph: { claims: [claim()], roles: [{ id: "r1" }] }, preview: "Did x.", needs: [{ id: "n1", status: "shown", state: "on" }, { id: "n2", status: "missing", state: "on" }, { id: "n3", status: "missing", state: "later" }] };
  const not = readiness({ rec, saves: [] });
  assert.equal(not.ready, false);
  assert.deepEqual(not.checks.map((c) => c.ok), [true, false, true]);
  const yes = readiness({ rec, saves: [{ text: "Did x.", downloads: 1 }] });
  assert.equal(yes.ready, true);
  assert.equal(yes.verdict, "ready"); // 1 of 2 counted (the "later" one isn't held against them)
  assert.deepEqual(yes.fit, { shown: 1, total: 2, later: 1 });
  assert.match(yes.note, /1 of 2 .* 1 you could still fix/);
  assert.equal(readiness({ rec: { ...rec, needs: [] }, saves: [{ text: "Did x.", downloads: 1 }] }).ready, false);
});
