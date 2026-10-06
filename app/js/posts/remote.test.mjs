import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchNextOpportunity,
  fetchPreviewOpportunity,
  markOpportunity,
  queueEnabled,
  queueMode,
  retireOpportunity,
} from "./remote.js?v=bb483b2-202610060747";

function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("demo and unsigned boards cannot call the live queue", () => {
  global.localStorage = storage();
  assert.equal(queueEnabled("demo"), false);
  assert.equal(queueEnabled("jane"), false);
  assert.equal(queueMode("demo", "localhost"), "off");
});

test("next and state use the signed-in student's bearer token", async () => {
  global.localStorage = storage({
    "gridschool.session.v2": JSON.stringify({ slug: "jane", persistToken: "gs_student_token" }),
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => ({ opportunity: null, ok: true }),
    };
  };
  await fetchNextOpportunity("jane", ["observability"]);
  await markOpportunity("jane", "post-1", "opened");
  assert.match(requests[0].url, /\/students\/jane\/opportunities\/next$/);
  assert.match(requests[1].url, /\/students\/jane\/opportunities\/state$/);
  assert.equal(requests[0].options.headers.Authorization, "Bearer gs_student_token");
  assert.doesNotMatch(JSON.stringify(requests), /SOCIALCRAWL/i);
});

test("developer preview runs only for the demo board on a local host with a saved token", async () => {
  global.localStorage = storage({ "gridschool.persist.token": "admin-token" });
  assert.equal(queueMode("demo", "localhost"), "preview");
  assert.equal(queueMode("demo", "127.0.0.1"), "preview");
  assert.equal(queueMode("demo", "gridschool.org"), "off");
  assert.equal(queueMode("jane", "localhost"), "live");

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ opportunity: null, preview: true }) };
  };
  await fetchPreviewOpportunity(["agents"], ["seen-1"]);
  await retireOpportunity("closed-1");
  assert.match(requests[0].url, /\/opportunities\/preview$/);
  assert.deepEqual(requests[0].body, { interests: ["agents"], exclude: ["seen-1"] });
  assert.match(requests[1].url, /\/opportunities\/retire$/);
  assert.deepEqual(requests[1].body, { id: "closed-1" });
});
