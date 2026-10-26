import test from "node:test";
import assert from "node:assert/strict";
import { cropBox, shrinkTo, needsShrink, doneStages, firstOpen, sourceFor, allowanceLine } from "./image-crop.js?v=c18e1b4-202610261602";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("a banner crop takes a centred 4:1 strip of a 3:2 image", () => {
  const box = cropBox(1536, 1024, 1584, 396);
  near(box.sw, 1536);
  near(box.sh, 384);
  near(box.sx, 0);
  near(box.sy, 320);
});

test("a square crop of a portrait photo, slid to the top", () => {
  const box = cropBox(1000, 2000, 800, 800, { y: -1 });
  near(box.sw, 1000);
  near(box.sh, 1000);
  near(box.sy, 0);
  near(cropBox(1000, 2000, 800, 800, { y: 1 }).sy, 1000);
});

test("zoom crops tighter around the centre and x/y are clamped", () => {
  const box = cropBox(1000, 1000, 800, 800, { zoom: 2 });
  near(box.sw, 500);
  near(box.sx, 250);
  near(cropBox(1000, 1000, 800, 800, { zoom: 2, x: 9 }).sx, 500);
  near(cropBox(1000, 1000, 800, 800, { zoom: 0.2 }).sw, 1000);
});

test("phone photos are shrunk to 2048 on the long side", () => {
  assert.deepEqual(shrinkTo(4032, 3024), { width: 2048, height: 1536 });
  assert.equal(shrinkTo(1200, 900), null);
  assert.equal(needsShrink({ size: 1000, type: "image/jpeg" }, { width: 800, height: 600 }), false);
  assert.equal(needsShrink({ size: 6e6, type: "image/jpeg" }, { width: 800, height: 600 }), true);
  assert.equal(needsShrink({ size: 1000, type: "image/heic" }, { width: 800, height: 600 }), true);
});

test("steps are done from what is stored and picked", () => {
  assert.deepEqual(doneStages(null), []);
  const rec = { uploads: { face: [{ id: "up_a" }] }, picked: { headshot: "gen_1", banner: null } };
  assert.deepEqual(doneStages(rec), ["photos", "headshot"]);
  assert.equal(firstOpen(rec), "banner");
  assert.deepEqual(doneStages({ ...rec, picked: { headshot: "gen_1", banner: "gen_2" } }, { headshot: true, banner: true }), ["photos", "headshot", "banner", "post"]);
  assert.equal(firstOpen({ uploads: { face: [] }, picked: {} }), "photos");
});

test("a download uses the pick, else their own photo or banner", () => {
  const rec = { uploads: { face: [{ id: "up_f" }], photo_current: null, banner_current: { id: "up_b" } }, picked: { headshot: null, banner: null } };
  assert.deepEqual(sourceFor(rec, "headshot"), { id: "up_f", made: false });
  assert.deepEqual(sourceFor(rec, "banner"), { id: "up_b", made: false });
  assert.deepEqual(sourceFor({ ...rec, picked: { headshot: "gen_h" } }, "headshot"), { id: "gen_h", made: true });
  assert.equal(sourceFor({ uploads: {}, picked: {} }, "banner"), null);
});

test("the allowance line", () => {
  assert.equal(allowanceLine({ used: 3, limit: 12 }), "9 of 12 left this month");
  assert.equal(allowanceLine({ used: 0, limit: 0 }), null);
});
