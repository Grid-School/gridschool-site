import test from "node:test";
import assert from "node:assert/strict";
import { coachUrl } from "./client.js?v=6ba739d-202610272145";

const coach = { hosted: true, endpoint: "persist" };
const persist = { endpoint: "https://lab.example/" };

test("a signed-in student talks to the coach route on the notebook server", () => {
  assert.equal(coachUrl("cal", { coach, persist, token: "t" }), "https://lab.example/students/cal/coach");
});

test("the demo board, no token, or no server stays on practice replies", () => {
  assert.equal(coachUrl("demo", { coach, persist, token: "t" }), null);
  assert.equal(coachUrl("cal", { coach, persist, token: "" }), null);
  assert.equal(coachUrl("cal", { coach, persist: { endpoint: "REPLACE_ME_X" }, token: "t" }), null);
  assert.equal(coachUrl("", { coach, persist, token: "t" }), null);
});

test("a placeholder or unhosted coach is off; a full URL is used as is", () => {
  assert.equal(coachUrl("cal", { coach: { hosted: true, endpoint: "REPLACE_ME_COACH_ENDPOINT" }, persist, token: "t" }), null);
  assert.equal(coachUrl("cal", { coach: { hosted: false, endpoint: "persist" }, persist, token: "t" }), null);
  assert.equal(coachUrl("cal", { coach: { hosted: true, endpoint: "http://localhost:9/coach" }, persist, token: "" }), "http://localhost:9/coach");
});

test("the slug is encoded", () => {
  assert.equal(coachUrl("a b", { coach, persist, token: "t" }), "https://lab.example/students/a%20b/coach");
});
