import test from "node:test";
import assert from "node:assert/strict";
import { registerLeaveGuard, clearLeaveGuard, allowLeave, isLeaveDirty } from "./leave-guard.js";

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
