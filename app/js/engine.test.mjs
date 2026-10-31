import test from "node:test";
import assert from "node:assert/strict";
import { nextMove, moveRoute, isHere, doneForYou, movesAfterNext, READY_SHOWN } from "./engine.js?v=fc7db25-202610310827";

const now = new Date(2026, 9, 9, 10);
const graph = { nodes: [{ id: "p.rewrite", status: "open", n: 1, family: "presence", title: "Headline", why: "w" }], byId: new Map() };
graph.byId.set("p.rewrite", graph.nodes[0]);
const role = (key, company, title = "Forward Deployed Engineer") => ({ key, company, title });

const noStep = { nodes: [{ id: "p.rewrite", status: "lit", n: 1, family: "presence", title: "Headline" }], byId: new Map() };

test("nextMove: a clock first, then the step you're on, then the routine, then rest", () => {
  // 1. A clock beats the open step: notes came back, a conversation is booked, a follow-up is due.
  const review = { reviews: [{ id: "r1", title: "Headline", state: "returned", nodeId: "p.rewrite", verdict: "Tighten line 2." }], search: { apps: [] } };
  const r = nextMove({ student: review, graph, now });
  assert.deepEqual([r.kind, r.title, r.stepId], ["review", "Your coach's notes on Headline came back", "p.rewrite"]);
  assert.equal(nextMove({ student: { ...review, readReviews: ["r1"] }, graph, now }).kind, "step", "read notes no longer win");

  const screen = { search: { apps: [{ id: "a", kind: "apply", company: "Acme", stage: "screen", date: "2026-10-01" }] } };
  assert.deepEqual([nextMove({ student: screen, graph, now }).title, nextMove({ student: screen, graph, now }).lane], ["Prepare for your Acme screen", "interview"]);

  const followUp = { search: { apps: [{ id: "a", kind: "apply", company: "Oldco", stage: "sent", date: "2026-09-20" }] } };
  assert.equal(nextMove({ student: followUp, graph, now }).title, "Follow up with Oldco");

  // 2. The step you're on beats the routine, in the words its own page gave (detail).
  const insider = { search: { apps: [] }, network: { rows: [["Jamie Lee", "Column", "PE", "u"]] } };
  const step = nextMove({ student: insider, graph, now, roles: [role("k1", "Column")] });
  assert.deepEqual([step.kind, step.stepId, step.title], ["step", "p.rewrite", "Headline"]);
  const said = nextMove({ student: insider, graph, now, detail: (id) => (id === "p.rewrite" ? { title: "Answer 6 questions", why: "About 6 minutes." } : null) });
  assert.deepEqual([said.title, said.why, said.stepTitle], ["Answer 6 questions", "About 6 minutes.", "Headline"]);

  // 3. With no step open, the routine in its order.
  const m = nextMove({ student: insider, graph: noStep, now, roles: [role("k1", "Column")] });
  assert.deepEqual([m.title, m.fed, m.lane], ["Ask Jamie Lee at Column", "insider", "network"]);
  const profile = { career: { headline: "SWE" }, search: { apps: [] } };
  assert.equal(nextMove({ student: profile, graph: noStep, now }).lane, "presence");
  const prepared = { career: { headline: "SWE" }, search: { profileAt: "x", apps: [] } };
  const p = nextMove({ student: prepared, graph: noStep, now, packs: { k1: { role: { company: "Rebar" }, pack: { fit_level: "strong" } } } });
  assert.deepEqual([p.title, p.fed, p.lane], ["Apply: Rebar", "prepared", "pipeline"]);

  // 4. Rest.
  const done = { career: { headline: "SWE", targets: { apply: 0 } }, search: { profileAt: "x", apps: [] } };
  assert.equal(nextMove({ student: done, graph: noStep, now }).kind, "rest");
});

test("a campaign's day 0 is routine; its day 3 follow-up is a clock", () => {
  const target = (touches, openedAt = "2026-10-01") => ({ id: "t1", company: "Re:Build", state: "active", openedAt, touches, campaign: { email: {} } });
  const day0 = { search: { apps: [], targets: [target({})] } };
  assert.equal(nextMove({ student: day0, graph, now }).kind, "step", "the step you're on beats a day-0 send");
  const m = nextMove({ student: day0, graph: noStep, now });
  assert.deepEqual([m.targetId, m.fed], ["t1", "campaign"]);
  const sent = { email: "2026-10-01", loom: "2026-10-01", linkedin: "2026-10-01", call: "2026-10-01" };
  const d3 = { search: { apps: [], targets: [target(sent)] } };
  assert.equal(nextMove({ student: d3, graph, now }).title, "Re:Build: Day 3 follow-up");
});

test("moveRoute and isHere: where the Next bar goes, and when you're already there", () => {
  assert.deepEqual(moveRoute({ kind: "step", stepId: "b.resume" }), ["map", "b.resume"]);
  assert.deepEqual(moveRoute({ kind: "targets", tool: "targets", targetId: "t1" }), ["do", "targets", "t1"]);
  assert.deepEqual(moveRoute({ kind: "follow", tool: "today" }), ["do", "today"]);
  assert.deepEqual(moveRoute({ kind: "review", stepId: null }), ["today"]);
  assert.equal(isHere({ name: "map", args: ["b.resume"] }, ["map", "b.resume"]), true);
  assert.equal(isHere({ name: "map", args: [] }, ["map", "b.resume"]), false);
  assert.equal(isHere({ name: "do", args: ["targets", "t1", "x"] }, ["do", "targets", "t1"]), true);
  assert.equal(isHere({ name: "do", args: ["today"] }, ["do", "targets"]), false);
});

test("doneForYou: found is matched but not prepared or applied; ready is capped; Aden's open items are on it", () => {
  const student = {
    career: { working: [{ text: "Finding the hiring manager", done: false }, { text: "old", done: true }] },
    search: { apps: [{ id: "a", kind: "apply", company: "X", roleKey: "k3", date: "2026-10-01", stage: "sent" }] },
  };
  const roles = [role("k1", "A"), role("k2", "B"), role("k3", "C"), role("k4", "D")];
  const packs = {
    k1: { role: { company: "A" }, pack: { fit_level: "strong" } },
    k2: { role: { company: "B" }, pack: { fit_level: "weak" } },
    k5: { role: { company: "E" }, pack: { fit_level: "possible" } },
    k6: { role: { company: "F" }, pack: {} },
    k7: { role: { company: "G" }, pack: {} },
  };
  const col = doneForYou({ student, roles, packs });
  assert.equal(col.found, 1, "k4 only: k1/k2 prepared, k3 applied");
  assert.deepEqual(col.onIt.map((o) => o.label), ["Your coach is on: Finding the hiring manager"]);
  assert.equal(col.ready.length, 4, "weak fit left out");
  assert.equal(col.readyShown.length, READY_SHOWN);
  assert.equal(col.readyMore, 1);
});

test("movesAfterNext counts what waits behind the next move", () => {
  const student = { career: { headline: "SWE" }, search: { apps: [], people: [{ id: "p", name: "Jo", relation: "met", state: "todo" }] } };
  assert.equal(movesAfterNext({ student, now }), 1);
});
