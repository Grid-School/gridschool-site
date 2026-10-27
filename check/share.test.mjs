import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { arrivedFrom, filterLine, isAd, lineKey, randomRef, refFromCheck, shareUrl, sourceLine } from "./share.mjs?v=22c446e-202610271853";

const SOURCES = JSON.parse(readFileSync(new URL("../data/intake/sources.json", import.meta.url), "utf8"));

test("from= wins, utm tags join as source:campaign, and both are cleaned like the server", () => {
  assert.equal(arrivedFrom("?from=meta-silence&utm_source=facebook"), "meta-silence");
  assert.equal(arrivedFrom("?utm_source=facebook&utm_campaign=meta-laidoff"), "facebook:meta-laidoff");
  assert.equal(arrivedFrom("?from=share:<script>ab12"), "share:scriptab12");
  assert.equal(arrivedFrom(`?from=${"x".repeat(80)}`).length, 60);
  assert.equal(arrivedFrom(""), "");
});

test("each Meta ad lands on its own line, by from= or by utm campaign", () => {
  for (const key of ["meta-silence", "meta-laidoff", "meta-map"]) {
    assert.ok(SOURCES.lines[key], key);
    assert.equal(sourceLine(key, SOURCES), SOURCES.lines[key]);
    assert.equal(sourceLine(`facebook:${key}`, SOURCES), SOURCES.lines[key]);
    assert.equal(sourceLine(`instagram:${key}`, SOURCES), SOURCES.lines[key]);
  }
  assert.equal(lineKey("facebook:nope", SOURCES.lines), "");
  assert.equal(sourceLine("nope", SOURCES), "");
  assert.equal(sourceLine("", SOURCES), "");
});

test("a shared link gets the friend line; a bare prefix does not", () => {
  assert.match(sourceLine("share:k3j9x0a1b2", SOURCES), /^A friend shared their scan/);
  assert.equal(sourceLine("share:", SOURCES), "");
  assert.equal(sourceLine("share:x", { lines: {} }), "");
});

test("the filter line shows for paid ads only, and goes away when emptied", () => {
  assert.ok(isAd("meta-map") && isAd("ad-grad") && isAd("instagram:meta-silence"));
  assert.ok(!isAd("share:abc") && !isAd("vsl") && !isAd("") && !isAd("facebook:spring"));
  assert.equal(filterLine("meta-silence", SOURCES), SOURCES.filter);
  assert.equal(filterLine("share:abc", SOURCES), "");
  assert.equal(filterLine("meta-silence", { ...SOURCES, filter: "" }), "");
  assert.equal(filterLine("meta-silence", { lines: {} }), "");
});

test("a saved check's ref is a hash, never the check id, and matches the server's", async () => {
  const ref = await refFromCheck("ck_example");
  assert.match(ref, /^[0-9a-f]{10}$/);
  assert.equal(ref, "bcfd477840"); // server/events_test.py checks events.share_ref gives the same
  assert.equal(await refFromCheck(""), "");
  assert.equal(shareUrl(ref), "https://gridschool.org/check/?from=share:bcfd477840");
});

test("an unsaved ref is short and clean", () => {
  let n = 0;
  assert.equal(randomRef(() => (n++ % 36) / 36), "0123456789");
  assert.match(randomRef(), /^[0-9a-z]{10}$/);
});

test("someone who watched the video gets the video's line, or the line of the ad that brought them", () => {
  assert.match(sourceLine("vsl", SOURCES), /^You watched the video/);
  assert.match(sourceLine("vsl:some-new-ad", SOURCES), /^You watched the video/);
  assert.equal(sourceLine("vsl:meta-silence", SOURCES), SOURCES.lines["meta-silence"]);
});
