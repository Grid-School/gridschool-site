import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHref, dayText, fullName, identity, resultHead, savedCheck, seatsLine, sourceFrom, stepAnswers, stepProblem } from "./sprint-model.mjs?v=c7fe5aa-202610310430";

test("dates read as calendar days, with the weekday when asked", () => {
  assert.equal(dayText("2026-11-04"), "November 4");
  assert.equal(dayText("2026-12-18", { weekday: true }), "Friday, December 18");
  assert.equal(dayText(""), "");
});

test("the seat counter: seats left, the waves, and full", () => {
  const status = { cap: 13, seatsLeft: 9, waves: [{ label: "Wave 1", starts: "2026-11-04" }, { label: "Wave 2", starts: "2026-11-11" }] };
  assert.deepEqual(seatsLine(status), { left: "9", words: "of 13 seats left", waves: "Wave 1 starts November 4 · Wave 2 starts November 11", full: false });
  assert.equal(seatsLine({ ...status, seatsLeft: 0 }).full, true);
  assert.match(seatsLine({ ...status, seatsLeft: 0 }).words, /waitlist/);
  assert.equal(seatsLine({ on: false, cap: 13, seatsLeft: null }).left, "13");
});

test("the source is carried from the page through the check", () => {
  assert.equal(sourceFrom("?from=meta:G-1"), "meta:G-1");
  assert.equal(sourceFrom("?from=<script>"), "script");
  assert.equal(sourceFrom(""), "sprint");
  assert.equal(checkHref("discord"), "../check/?sprint=1&from=discord");
});

test("who is asking: the account first, then the board, then the saved check", () => {
  assert.equal(identity({ account: { token: "ga_x" }, board: "gs_y", check: "ck_abcdefghijklmnop" }).headers.authorization, "Bearer ga_x");
  assert.equal(identity({ board: "gs_y" }).headers.authorization, "Bearer gs_y");
  const byCheck = identity({ check: "ck_abcdefghijklmnop" });
  assert.equal(byCheck.headers.authorization, undefined);
  assert.equal(byCheck.check, "ck_abcdefghijklmnop");
  assert.equal(identity({ check: "nope" }).check, "");
  assert.equal(savedCheck(JSON.stringify({ saved: { id: "ck_abcdefghijklmnop" } })), "ck_abcdefghijklmnop");
  assert.equal(savedCheck("not json"), "");
});

test("only the questions asked are sent, and nothing built is an answer", () => {
  const values = { auth: "no", hours: "5to10", hours8: "yes", school: "recent", shipped: " A thing ", link: "https://github.com/x", linkedin: "", title: "Backend Engineer", clinic: "async" };
  assert.deepEqual(stepAnswers(["auth", "hours", "hours8", "school", "built", "linkedin"], values), { auth: "no", hours: "5to10", hours8: "yes", school: "recent", shipped: "A thing", links: ["https://github.com/x"] });
  assert.deepEqual(stepAnswers(["built"], { nothing: true, shipped: "x" }), { nothing: true });
  assert.deepEqual(stepAnswers([], values), {});
});

test("the step says what is still needed, in plain words", () => {
  const ok = { auth: "no", hours: "gt20", school: "final", shipped: "x", title: "Backend Engineer", clinic: "weekday" };
  assert.equal(stepProblem(["auth", "hours", "school", "built", "linkedin"], ok), "");
  assert.match(stepProblem(["auth"], { ...ok, auth: "" }), /sponsorship/);
  assert.match(stepProblem(["built"], { ...ok, shipped: "" }), /built/);
  assert.equal(stepProblem(["built"], { ...ok, shipped: "", nothing: true }), "");
  assert.match(stepProblem([], { ...ok, clinic: "" }), /clinic/);
  assert.match(stepProblem([], { ...ok, title: " " }), /title/);
});

test("a full name is two words", () => {
  assert.equal(fullName("Sam Rivera"), true);
  assert.equal(fullName("Sam"), false);
  assert.equal(fullName("José López"), true);
});

test("the result headline for each decision", () => {
  assert.equal(resultHead({ decision: "member", starts: "2026-11-04" }).title, "You're in. Your sprint starts Wednesday, November 4.");
  assert.equal(resultHead({ decision: "waitlist", position: 2 }).title, "You're number 2 on the waitlist.");
  assert.equal(resultHead({ decision: "declined" }).tone, "no");
  for (const d of ["member", "waitlist", "declined"]) assert.doesNotMatch(JSON.stringify(resultHead({ decision: d, starts: "2026-11-04" })), /[–—]|Aden/);
});
