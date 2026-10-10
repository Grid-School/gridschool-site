import test from "node:test";
import assert from "node:assert/strict";
import { nextMove, doneForYou, movesAfterNext, READY_SHOWN } from "./engine.js?v=8b71053-202610102102";

const now = new Date(2026, 9, 9, 10);
const graph = { nodes: [{ id: "p.rewrite", status: "open", n: 1, family: "presence", title: "Headline", why: "w" }], byId: new Map() };
graph.byId.set("p.rewrite", graph.nodes[0]);
const role = (key, company, title = "Forward Deployed Engineer") => ({ key, company, title });

test("nextMove walks the rules in order, each with a lane and a plain reason", () => {
  const screen = { search: { apps: [{ id: "a", kind: "apply", company: "Acme", stage: "screen", date: "2026-10-01" }] } };
  assert.deepEqual([nextMove({ student: screen, graph, now }).title, nextMove({ student: screen, graph, now }).lane], ["Prepare for your Acme screen", "interview"]);

  const insider = { search: { apps: [] }, network: { rows: [["Jamie Lee", "Column", "PE", "u"]] } };
  const m = nextMove({ student: insider, graph, now, roles: [role("k1", "Column")] });
  assert.equal(m.title, "Ask Jamie Lee at Column");
  assert.equal(m.fed, "insider");
  assert.equal(m.lane, "network");

  const profile = { career: { headline: "SWE" }, search: { apps: [] } };
  assert.equal(nextMove({ student: profile, graph, now }).lane, "presence");

  const prepared = { career: { headline: "SWE" }, search: { profileAt: "x", apps: [] } };
  const p = nextMove({ student: prepared, graph, now, packs: { k1: { role: { company: "Rebar" }, pack: { fit_level: "strong" } } } });
  assert.deepEqual([p.title, p.fed, p.lane], ["Apply: Rebar", "prepared", "pipeline"]);

  const done = { career: { headline: "SWE", targets: { apply: 0 } }, search: { profileAt: "x", apps: [] } };
  const step = nextMove({ student: done, graph, now });
  assert.deepEqual([step.kind, step.stepId], ["step", "p.rewrite"]);
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
  assert.deepEqual(col.onIt.map((o) => o.label), ["Aden is on: Finding the hiring manager"]);
  assert.equal(col.ready.length, 4, "weak fit left out");
  assert.equal(col.readyShown.length, READY_SHOWN);
  assert.equal(col.readyMore, 1);
});

test("movesAfterNext counts what waits behind the next move", () => {
  const student = { career: { headline: "SWE" }, search: { apps: [], people: [{ id: "p", name: "Jo", relation: "met", state: "todo" }] } };
  assert.equal(movesAfterNext({ student, now }), 1);
});
