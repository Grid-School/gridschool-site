import test from "node:test";
import assert from "node:assert/strict";
import { plainMessage, plainError } from "./plain-error.js?v=fc7db25-202610310827";

test("messages written for students pass through", () => {
  assert.equal(plainMessage(400, "That image is over 5 MB. Use a smaller one."), "That image is over 5 MB. Use a smaller one.");
  assert.equal(plainMessage(500, "Your answers are saved. The map couldn't rebuild just now; try again in a minute."), "Your answers are saved. The map couldn't rebuild just now; try again in a minute.");
  assert.equal(plainMessage(503, "Making new images isn't switched on yet."), "Making new images isn't switched on yet.");
});

test("internal messages and bare statuses become one plain line that says what to do", () => {
  assert.match(plainMessage(500, "intake unavailable"), /^Something went wrong on our side\. Your work is still here\./);
  assert.match(plainMessage(502, ""), /^Something went wrong on our side/);
  assert.match(plainMessage(403, "token cannot read this seat"), /ask your coach/);
  assert.match(plainMessage(403, "the intake is for GridSchool Complete seats"), /^This isn't open on your account/);
  assert.match(plainMessage(400, "styleShots: upload refs only"), /^That didn't save\. Check what you entered/);
  assert.match(plainMessage(409, "this resume changed in another tab; reload it"), /Reload the page/);
  assert.match(plainMessage(401), /Sign in again/);
  for (const status of [400, 401, 403, 404, 409, 429, 500, 502]) {
    const line = plainMessage(status, "x");
    assert.ok(!/server answered|token|seat|unavailable|—/.test(line), `${status}: ${line}`);
  }
});

test("the error keeps the status, the payload and the original for the console", () => {
  const error = plainError(500, { error: "maps unavailable" });
  assert.equal(error.status, 500);
  assert.equal(error.detail, "maps unavailable");
  assert.deepEqual(error.payload, { error: "maps unavailable" });
  assert.equal(plainError(502, {}).detail, "status 502");
});
