import test from "node:test";
import assert from "node:assert/strict";
import { spreadLabels, LABEL_GAP } from "./labels.js";

test("labels that already clear each other keep their positions", () => {
  const out = spreadLabels([{ label: "b", y: 100 }, { label: "a", y: 0 }]);
  assert.deepEqual(out.map((i) => [i.label, i.y]), [["a", 0], ["b", 100]]);
});

test("two labels on the same row are pushed apart by the gap, in order", () => {
  const out = spreadLabels([{ label: "Career", y: -320 }, { label: "The world", y: -320 }]);
  assert.equal(out[0].y, -320);
  assert.equal(out[1].y, -320 + LABEL_GAP);
});

test("a chain of collisions cascades so no pair overlaps", () => {
  const out = spreadLabels([{ y: 10 }, { y: 12 }, { y: 14 }, { y: 60 }], 20);
  for (let i = 1; i < out.length; i += 1) assert.ok(out[i].y - out[i - 1].y >= 20);
  assert.equal(out[3].y, 70);
});
