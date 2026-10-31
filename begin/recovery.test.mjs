import test from "node:test";
import assert from "node:assert/strict";
import { sessionFrom, rememberSession, peekView, peek, fix, COPY } from "./recovery.js?v=fc7db25-202610310827";

const SESSION = "cs_test_a1B2c3D4e5F6g7H8i9J0";

test("the session comes from the after-payment link, or what this tab saw, and nothing else", () => {
  assert.equal(sessionFrom(`?session_id=${SESSION}`), SESSION);
  assert.equal(sessionFrom("", SESSION), SESSION);
  assert.equal(sessionFrom("?session_id={CHECKOUT_SESSION_ID}"), "");
  assert.equal(sessionFrom("?session_id=pi_test_a1B2c3D4e5F6g7H8"), "");
  assert.equal(sessionFrom("?session_id=cs_test_<script>", "nope"), "");
});

test("it is kept for this tab, and blocked storage never breaks the page", () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  assert.equal(rememberSession(`?session_id=${SESSION}`, storage), SESSION);
  assert.equal(rememberSession("", storage), SESSION);
  const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(rememberSession(`?session_id=${SESSION}`, blocked), SESSION);
  assert.equal(rememberSession("", blocked), "");
});

test("the card shows the masked email, and why when it can't be fixed here", () => {
  assert.deepEqual(peekView(null), { title: COPY.ask, lead: COPY.waiting, canFix: false, why: "" });
  const open = peekView({ email: "s•••@g•••.com", canFix: true });
  assert.equal(open.title, "We sent your sign-in to s•••@g•••.com.");
  assert.equal(open.canFix, true);
  const shut = peekView({ email: "s•••@g•••.com", canFix: false, why: "Reply to your receipt email." });
  assert.equal(shut.canFix, false);
  assert.equal(shut.why, "Reply to your receipt email.");
});

test("the copy law holds: your coach, never a name, no dashes", () => {
  const words = Object.values(COPY).map((v) => (typeof v === "function" ? v("x@y.co") : v)).join("\n");
  assert.doesNotMatch(words, /Aden|—/);
});

test("the two calls send the session and read our answers", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, JSON.parse(init.body)]);
    if (url.endsWith("/peek")) return { status: 404, ok: false, json: async () => ({ error: "not yet" }) };
    return { status: 409, ok: false, json: async () => ({ error: "That email already has a GridSchool map." }) };
  };
  assert.equal(await peek("http://api", SESSION), null);
  await assert.rejects(fix("http://api", SESSION, "a@b.co"), /already has a GridSchool map/);
  assert.deepEqual(calls, [["http://api/billing/checkout/peek", { session: SESSION }], ["http://api/billing/checkout/email", { session: SESSION, email: "a@b.co" }]]);
});
