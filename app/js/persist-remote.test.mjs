import test from "node:test";
import assert from "node:assert/strict";
import { hydrateFromRemote, flushAfterLocalWrite, remoteEnabled, startPolling, stopPolling } from "./persist-remote.js";
import { replace, readDoc, clear } from "./persist.js";
import { setPersistToken } from "./session.js";

function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

installMemoryStorage();

test("demo never enables remote persist", () => {
  assert.equal(remoteEnabled("demo"), false);
  assert.equal(remoteEnabled(""), false);
});

test("hydrate and flush skip demo and skip missing token", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({}) };
  };
  setPersistToken("");
  assert.equal(await hydrateFromRemote("demo"), null);
  assert.deepEqual(await flushAfterLocalWrite("demo", "student"), { skipped: true });
  assert.equal(await hydrateFromRemote("aden"), null);
  assert.equal((await flushAfterLocalWrite("aden", "student")).reason, "no-token");
  assert.equal(calls.length, 0);
});

test("hydrate writes remote snapshot locally; flush posts student domain", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method, body: opts.body, auth: opts.headers.Authorization });
    if (opts.method === "GET") {
      return {
        ok: true,
        json: async () => ({
          student: { layout: { "or.start": { x: 1, y: 2 } } },
          instructor: { focus: "From postgres" },
          events: [{ id: "ev-9", kind: "evidence.submitted" }],
        }),
      };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  setPersistToken("test-admin");
  clear("aden");
  const snap = await hydrateFromRemote("aden");
  assert.equal(snap.instructor.focus, "From postgres");
  assert.equal(readDoc("aden").instructor.focus, "From postgres");
  replace("aden", {
    student: { tasks: { "or.start.law": { state: "done" } } },
    instructor: { focus: "From postgres" },
    events: [],
  });
  await flushAfterLocalWrite("aden", "student", { event: { kind: "task.toggled" } });
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[1].method, "PATCH");
  assert.match(calls[1].url, /\/students\/aden\/student$/);
  const sent = JSON.parse(calls[1].body);
  assert.equal(sent.patch.tasks["or.start.law"].state, "done");
  assert.equal(sent.event.kind, "task.toggled");
});

test("poll does not fire for demo and stopPolling is safe", () => {
  globalThis.document = { hidden: false, addEventListener() {} };
  startPolling("demo", () => {
    throw new Error("demo must not poll");
  });
  stopPolling();
});
