import test from "node:test";
import assert from "node:assert/strict";
import {
  hydrateFromRemote,
  flushAfterLocalWrite,
  persistStatus,
  remoteEnabled,
  startPolling,
  stopPolling,
  fetchSnapshot,
} from "./persist-remote.js";
import { replace, readDoc, clear, patchStudent, hasPending } from "./persist.js";
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

test("failed flush then hydrate does not replace local evidence", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push(opts.method);
    if (opts.method === "PATCH") {
      return { ok: false, status: 503, json: async () => ({ error: "down" }) };
    }
    return {
      ok: true,
      json: async () => ({ student: { evidence: {} }, instructor: {}, events: [] }),
    };
  };
  setPersistToken("test-admin");
  clear("aden");
  patchStudent("aden", {
    evidence: { "or.start": { url: "https://example.com/keep", at: "2026-08-31" } },
  });
  const result = await hydrateFromRemote("aden", { force: true });
  assert.equal(result.reason, "pending-unflushed");
  assert.equal(readDoc("aden").student.evidence["or.start"].url, "https://example.com/keep");
  assert.equal(hasPending("aden"), true);
  assert.equal(persistStatus().state, "local-only");
  assert.equal(calls.includes("GET"), false);
});

test("hydrate flushes pending then applies the server echo", async () => {
  globalThis.fetch = async (_url, opts) => {
    if (opts.method === "PATCH") {
      return { ok: true, json: async () => ({ ok: true, student_updated_at: "2" }) };
    }
    return {
      ok: true,
      json: async () => ({
        student: { evidence: { "or.start": { url: "https://example.com/keep", at: "2026-08-31" } } },
        instructor: {},
        events: [],
        student_updated_at: "2",
      }),
    };
  };
  setPersistToken("test-admin");
  clear("aden");
  patchStudent("aden", {
    evidence: { "or.start": { url: "https://example.com/keep", at: "2026-08-31" } },
  });
  const snap = await hydrateFromRemote("aden", { force: true });
  assert.equal(snap.skipped, undefined);
  assert.equal(readDoc("aden").student.evidence["or.start"].url, "https://example.com/keep");
  assert.equal(hasPending("aden"), false);
  assert.equal(persistStatus().state, "ok");
});

test("fetchSnapshot GETs without writing the local cache", async () => {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url, method: opts.method });
    return {
      ok: true,
      json: async () => ({ slug: "aden", identity: { name: "Aden", public: false } }),
    };
  };
  setPersistToken("test-admin");
  clear("aden");
  const snap = await fetchSnapshot("aden");
  assert.equal(snap.slug, "aden");
  assert.equal(readDoc("aden").student.evidence, undefined);
  assert.equal(calls[0].method, "GET");
  assert.match(calls[0].url, /\/students\/aden$/);
});

test("poll does not fire for demo and stopPolling is safe", () => {
  globalThis.document = { hidden: false, addEventListener() {} };
  startPolling("demo", () => {
    throw new Error("demo must not poll");
  });
  stopPolling();
});
