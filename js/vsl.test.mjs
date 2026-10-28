import test from "node:test";
import assert from "node:assert/strict";
import { vslEmbed, checkSource } from "./vsl.mjs?v=e1b1240-202610280516";

test("the video shows as a file or an embed, and nothing until it's a real https link", () => {
  assert.deepEqual(vslEmbed("https://dn1lktb897fdd.cloudfront.net/lessons/v.vsl/mp4/1080.mp4"), { kind: "file", src: "https://dn1lktb897fdd.cloudfront.net/lessons/v.vsl/mp4/1080.mp4" });
  assert.deepEqual(vslEmbed("https://www.youtube.com/embed/abc123"), { kind: "embed", src: "https://www.youtube.com/embed/abc123" });
  assert.equal(vslEmbed(null), null);
  assert.equal(vslEmbed("REPLACE_ME"), null);
  assert.equal(vslEmbed("http://example.com/v.mp4"), null);
});

test("the check hears that they watched, and which ad brought them", () => {
  assert.equal(checkSource(null), "vsl");
  assert.equal(checkSource("vsl"), "vsl");
  assert.equal(checkSource("meta-silence"), "vsl:meta-silence");
  assert.equal(checkSource("<script>"), "vsl:script");
  assert.equal(checkSource("meta:P-TABLE-01-TH"), "vsl:meta:P-TABLE-01-TH");
});
