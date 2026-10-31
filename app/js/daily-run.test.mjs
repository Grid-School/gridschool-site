import test from "node:test";
import assert from "node:assert/strict";
import { SOURCE, fromDailyRun, withoutFrom, roleKeyFromRoute, emailSetting } from "./daily-run.js?v=b58674a-202610310432";

test("fromDailyRun: only the email's own tag counts", () => {
  assert.equal(SOURCE, "daily-run");
  assert.equal(fromDailyRun("?s=cal&from=daily-run"), true);
  assert.equal(fromDailyRun("?from=meta-silence"), false);
  assert.equal(fromDailyRun(""), false);
  assert.equal(fromDailyRun(undefined), false);
});

test("withoutFrom: the tag leaves, the seat stays", () => {
  assert.equal(withoutFrom("?s=cal&from=daily-run"), "?s=cal");
  assert.equal(withoutFrom("?from=daily-run"), "");
  assert.equal(withoutFrom("?s=cal&dev=1&from=daily-run"), "?s=cal&dev=1");
});

test("roleKeyFromRoute: the key the server put in the link (daily_run.role_url), decoded", () => {
  // Python: quote("greenhouse:acme:41", safe="") == "greenhouse%3Aacme%3A41"
  assert.equal(roleKeyFromRoute("role", "greenhouse%3Aacme%3A41"), "greenhouse:acme:41");
  assert.equal(roleKeyFromRoute("role", "hn%3A12%2F3"), "hn:12/3");
  assert.equal(roleKeyFromRoute("role", "%E0%A4%A"), "", "a broken link opens nothing");
  assert.equal(roleKeyFromRoute("cmp-123", "x"), "", "a campaign id is not a role");
  assert.equal(roleKeyFromRoute("role", undefined), "");
});

test("emailSetting: what the profile says, and the one button", () => {
  assert.equal(emailSetting(true).action, "Stop these emails");
  assert.equal(emailSetting(false).action, "Turn them back on");
  for (const on of [true, false]) {
    const { status } = emailSetting(on);
    assert.doesNotMatch(status, /Aden|—/);
  }
});
