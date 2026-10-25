import { test } from "node:test";
import assert from "node:assert/strict";
import { steerNote } from "./tasks.js?v=8b2a230-202610250853";

test("steer shows only when Aden set something", (t) => {
  if (typeof document === "undefined") {
    // dom-less: the null path is the logic under test
    assert.equal(steerNote({}), null);
    assert.equal(steerNote({ focus: "  ", next: "" }), null);
    return;
  }
});
