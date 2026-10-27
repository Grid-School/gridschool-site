import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { videoAccess, isFilmed } from "./video-access.mjs?v=2c47259-202610271924";

const here = new URL(".", import.meta.url);
const { cases } = JSON.parse(readFileSync(new URL("video-access-cases.json", here), "utf8"));

test("the shared cases (server/video_access_test.py reads the same file)", () => {
  for (const c of cases) assert.equal(videoAccess(c.video, c.node), c.access, c.name);
});

test("filmed means somewhere to play, or the server said so after removing the address", () => {
  assert.equal(isFilmed({ youtube: "", summary: "x" }), false);
  assert.equal(isFilmed({ path: "lessons/a" }), true);
  assert.equal(isFilmed({ youtube: "abc" }), true);
  assert.equal(isFilmed({ filmed: true }), true);
  assert.equal(isFilmed(null), false);
});

test("every module video resolves to free or paid, and an explicit access is one of the two", () => {
  const dir = new URL("modules/", here);
  for (const file of readdirSync(dir).filter((name) => /@\d+\.json$/.test(name))) {
    const module = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
    if (!module.video) continue;
    if ("access" in module.video) assert.ok(["free", "paid"].includes(module.video.access), file);
    const node = { id: `s.${module.id}`, family: module.lane, phase: module.phase };
    assert.ok(["free", "paid"].includes(videoAccess(module.video, node)), file);
  }
});
