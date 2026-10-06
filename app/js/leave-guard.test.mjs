import test from "node:test";
import assert from "node:assert/strict";
import { registerLeaveGuard, clearLeaveGuard, allowLeave, isLeaveDirty } from "./leave-guard.js?v=e80d53a-202610060435";

test("allowLeave confirms only when a registered form is dirty", () => {
  let dirty = false;
  const asked = [];
  globalThis.window = {
    confirm: (message) => {
      asked.push(message);
      return false;
    },
    addEventListener() {},
  };
  registerLeaveGuard("t", () => dirty, "This link is not saved.");
  assert.equal(isLeaveDirty(), false);
  assert.equal(allowLeave(), true);
  dirty = true;
  assert.equal(isLeaveDirty(), true);
  assert.equal(allowLeave(), false);
  assert.equal(asked[0], "This link is not saved.");
  clearLeaveGuard("t");
  assert.equal(isLeaveDirty(), false);
  assert.equal(allowLeave(), true);
});
