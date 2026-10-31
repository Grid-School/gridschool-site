import test from "node:test";
import assert from "node:assert/strict";
import { rememberRoute, takeRoute } from "./return-to.js?v=f96b76b-202610312232";

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test("a route from an email survives sign-in, once", () => {
  const store = memory();
  rememberRoute("#/do/today/role/gh%3Aacme%3A1", 1000, store);
  assert.equal(takeRoute(2000, store), "#/do/today/role/gh%3Aacme%3A1");
  assert.equal(takeRoute(3000, store), "", "taken once");
});

test("stale or odd routes are dropped", () => {
  const store = memory();
  rememberRoute("#/map/b.resume", 0, store);
  assert.equal(takeRoute(31 * 60 * 1000, store), "", "older than 30 minutes");
  rememberRoute("javascript:alert(1)", 0, store);
  rememberRoute("", 0, store);
  assert.equal(takeRoute(1, store), "");
});
