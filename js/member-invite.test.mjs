import test from "node:test";
import assert from "node:assert/strict";
import { canRevealMemberInvite, isLocalHost } from "./member-invite.js";

test("localhost can see the invite, including on the demo slug", () => {
  assert.equal(isLocalHost("localhost"), true);
  assert.equal(canRevealMemberInvite({ slug: "demo", hostname: "localhost" }), true);
});

test("a notebook token reveals the invite on the live host", () => {
  assert.equal(
    canRevealMemberInvite({ slug: "jane", token: "gs_test", hostname: "gridschool.org" }),
    true
  );
  assert.equal(
    canRevealMemberInvite({ slug: "demo", token: "gs_test", hostname: "gridschool.org" }),
    true
  );
});

test("the public demo on the live site cannot see the invite", () => {
  assert.equal(canRevealMemberInvite({ slug: "demo", hostname: "gridschool.org" }), false);
  assert.equal(canRevealMemberInvite({ slug: "jane", hostname: "gridschool.org" }), false);
});
