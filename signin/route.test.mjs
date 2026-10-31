import test from "node:test";
import assert from "node:assert/strict";
import { routeFor, fromStripe, sitePath } from "./route.mjs?v=72f2dd6-202610310710";

const me = (seat, checks = []) => ({ email: "sam@example.com", name: "", checks, seat });
const check = { id: "ck_aaaaaaaaaaaaaaaaaaaa", top: [], createdAt: "2026-10-27T00:00:00Z" };

test("signed out asks for an email", () => {
  assert.equal(routeFor(null), "signin");
  assert.equal(routeFor(undefined, { paying: true }), "signin");
});

test("a Complete map opens as itself, paying or not", () => {
  assert.equal(routeFor(me({ slug: "sam", plan: "complete" })), "paid");
  assert.equal(routeFor(me({ slug: "sam", plan: "complete" }, [check]), { paying: true }), "paid");
});

test("a free map opens the free board, never a payment wait (the 2026-10-27 bug)", () => {
  assert.equal(routeFor(me({ slug: "sam", plan: "free" })), "free");
  assert.equal(routeFor(me({ slug: "sam", plan: "free" }, [check])), "free");
});

test("a saved check with no board yet makes the free board", () => {
  assert.equal(routeFor(me(null, [check])), "free");
});

test("a payment on its way waits, whether the free board exists or not", () => {
  assert.equal(routeFor(me({ slug: "sam", plan: "free" }), { paying: true }), "wait");
  assert.equal(routeFor(me(null, [check]), { paying: true }), "wait");
  assert.equal(routeFor(me(null), { paying: true }), "wait");
});

test("a Residency board signs in with its password, and a payment never makes it wait", () => {
  assert.equal(routeFor(me({ slug: "dale", plan: "residency" })), "password");
  assert.equal(routeFor(me({ slug: "dale", plan: "residency" }), { paying: true }), "password");
});

test("nothing for the email yet", () => {
  assert.equal(routeFor(me(null)), "none");
  assert.equal(routeFor({ email: "x@example.com" }), "none");
});

test("only Stripe's own pages count as just paid", () => {
  assert.equal(fromStripe("https://checkout.stripe.com/c/pay/cs_live_x"), true);
  assert.equal(fromStripe("https://buy.stripe.com/abc"), true);
  assert.equal(fromStripe("https://stripe.com/"), true);
  assert.equal(fromStripe("https://notstripe.com/"), false);
  assert.equal(fromStripe("https://stripe.com.evil.example/"), false);
  assert.equal(fromStripe("https://gridschool.org/checkout/"), false);
  assert.equal(fromStripe(""), false);
});

test("site paths carry ?api= on localhost only", () => {
  const local = { href: "http://localhost:8080/signin/", hostname: "localhost" };
  const live = { href: "https://gridschool.org/signin/", hostname: "gridschool.org" };
  assert.equal(sitePath("../app/", local, "http://localhost:8787", { s: "sam" }), "http://localhost:8080/app/?s=sam&api=http%3A%2F%2Flocalhost%3A8787");
  assert.equal(sitePath("../app/", live, "https://lab.example", { s: "sam" }), "https://gridschool.org/app/?s=sam");
  assert.equal(sitePath("../check/", live, "x"), "https://gridschool.org/check/");
});
