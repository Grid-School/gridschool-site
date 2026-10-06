import test from "node:test";
import assert from "node:assert/strict";
import { loadDesk, rememberSeen, saveDesk, todayKey } from "./desk.js?v=bb483b2-202610060747";

function memory() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

test("a new day keeps interests and drops yesterday's displayed post", () => {
  const store = memory();
  saveDesk(store, "demo", {
    keywords: "observability",
    day: "2026-09-21",
    current: { id: "urn:li:activity:1" },
  });
  const next = loadDesk(store, "demo", "2026-09-22");
  assert.equal(next.keywords, "observability");
  assert.equal(next.current, null);
  assert.equal(todayKey(new Date(2026, 8, 22)), "2026-09-22");
});

test("posts opened in developer preview are remembered across days, once each", () => {
  const store = memory();
  let seen = rememberSeen([], "p1");
  seen = rememberSeen(seen, "p2");
  seen = rememberSeen(seen, "p1");
  assert.deepEqual(seen, ["p1", "p2"]);
  saveDesk(store, "demo", { keywords: "", day: "2026-09-21", current: null, seen });
  assert.deepEqual(loadDesk(store, "demo", "2026-09-22").seen, ["p1", "p2"]);
});
