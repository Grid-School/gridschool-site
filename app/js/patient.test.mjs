import test from "node:test";
import assert from "node:assert/strict";
import { patient, replyLost } from "./patient.js?v=7288040-202610310409";

const noSleep = async () => {};
const netError = () => new TypeError("Failed to fetch");

test("a reply that arrives is returned as is", async () => {
  const out = await patient(async () => ({ version: 2, graph: {} }), { before: 1, load: async () => { throw new Error("not called"); } });
  assert.deepEqual(out, { version: 2, graph: {} });
});

test("a lost reply is recovered by re-reading until the version moves", async () => {
  let reads = 0;
  const load = async () => (++reads < 3 ? { version: 1 } : { version: 2, graph: { roles: [1] } });
  const waited = [];
  const out = await patient(async () => { throw netError(); }, { before: 1, load, sleep: noSleep, waiting: () => waited.push(1) });
  assert.equal(reads, 3);
  assert.equal(waited.length, 1);
  assert.equal(out.recovered, true);
  assert.equal(out.version, 2);
});

test("a proxy 504 counts as a lost reply; a 409 with the record does not", async () => {
  assert.equal(replyLost(Object.assign(new Error("gw"), { status: 504 })), true);
  assert.equal(replyLost(Object.assign(new Error("conflict"), { status: 409 })), false);
  const conflict = Object.assign(new Error("you already have a resume here"), { status: 409, payload: { graph: {} } });
  await assert.rejects(patient(async () => { throw conflict; }, { before: 1, load: async () => ({ version: 9 }), sleep: noSleep }), (e) => e === conflict);
});

test("a read that keeps failing gives up with a reload hint after the deadline", async () => {
  const out = patient(async () => { throw netError(); }, { before: 1, load: async () => ({ version: 1 }), sleep: noSleep, every: 1, upTo: 20 });
  await assert.rejects(out, /Reload the page/);
});

test("without a version to compare, the error passes through", async () => {
  await assert.rejects(patient(async () => { throw netError(); }, { load: async () => ({ version: 2 }) }), /Failed to fetch/);
});
