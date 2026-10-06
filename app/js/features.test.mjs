import test from "node:test";
import assert from "node:assert/strict";
import { enabledViews, isViewEnabled, gateRoutes } from "./features.js";

test("coach and posts are off with a placeholder endpoint and no flag", () => {
  const flags = enabledViews({ coach: { endpoint: "REPLACE_ME_COACH_ENDPOINT" }, features: {} });
  assert.deepEqual(flags, { today: false, posts: false });
});

test("a real endpoint and the posts flag bring the doors back", () => {
  const flags = enabledViews({ coach: { endpoint: "https://coach.example" }, features: { posts: true } });
  assert.deepEqual(flags, { today: true, posts: true });
});

test("ungated views are always enabled", () => {
  const flags = { today: false, posts: false };
  assert.equal(isViewEnabled("map", flags), true);
  assert.equal(isViewEnabled("calendar", flags), true);
  assert.equal(isViewEnabled("today", flags), false);
});

test("gateRoutes drops switched-off views only", () => {
  const routes = { map: 1, tasks: 2, today: 3, posts: 4 };
  assert.deepEqual(Object.keys(gateRoutes(routes, { today: false, posts: true })), ["map", "tasks", "posts"]);
});

test("shipped config hides coach and posts", () => {
  assert.deepEqual(enabledViews(), { today: false, posts: false });
});
