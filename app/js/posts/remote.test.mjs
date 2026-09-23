import test from "node:test";
import assert from "node:assert/strict";
import { fetchNextOpportunity, markOpportunity, queueEnabled } from "./remote.js";

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
