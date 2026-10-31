import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as F from "./profile-flow.js?v=fc7db25-202610310827";

const catalog = JSON.parse(readFileSync(new URL("../../data/intake/questions.json", import.meta.url)));
const q = (id) => catalog.questions.find((item) => item.id === id);

const STAGES = [
  { id: "you", chunk: "c0", ids: ["stage", "role"] },
  { id: "taste", chunk: "c7", ids: ["styleWords", "styleShots"] },
  { id: "empty", chunk: "c7", ids: [] },
  { id: "linkedin", chunk: "c4", ids: ["photo"] },
  { id: "finish" },
];
const questionsOf = (st) => st.ids.map((id) => ({ id }));
const flow = F.flowOf(STAGES, questionsOf);

test("the flow is every question in order, across stages", () => {
  assert.deepEqual(flow.map((f) => `${f.stage}.${f.q}`), ["you.stage", "you.role", "taste.styleWords", "taste.styleShots", "linkedin.photo"]);
});

test("Back goes to the question before, even in the stage before, and never past the first", () => {
  assert.equal(F.backFrom(flow, { stage: "you", q: "stage" }), null);
  assert.deepEqual(F.backFrom(flow, { stage: "you", q: "role" }), { stage: "you", q: "stage" });
  assert.deepEqual(F.backFrom(flow, { stage: "taste", q: "styleWords" }), { stage: "you", q: "role" }, "crosses into the stage before");
  assert.deepEqual(F.backFrom(flow, { stage: "taste" }), { stage: "taste", q: "styleShots" }, "a summary goes to its last question");
  assert.deepEqual(F.backFrom(flow, { stage: "finish" }), { stage: "linkedin", q: "photo" }, "Finish goes to the last question");
  assert.deepEqual(F.backFrom(flow, { stage: "empty" }, STAGES.map((st) => st.id)), { stage: "taste", q: "styleShots" }, "a stage with nothing asked goes to the one before");
  assert.equal(F.backFrom([], { stage: "finish" }), null);
});

test("Next walks forward, and the place says where you are in the whole step", () => {
  assert.deepEqual(F.forwardFrom(flow, { stage: "you", q: "role" }), { stage: "taste", q: "styleWords" });
  assert.equal(F.forwardFrom(flow, { stage: "linkedin", q: "photo" }), null);
  assert.deepEqual(F.placeOf(flow, { stage: "taste", q: "styleShots" }), { n: 4, total: 5 });
});

test("the rule under an upload says how many, which formats and how big", () => {
  assert.equal(F.uploadRule(q("styleShots")), "Up to 6 images, added together or one at a time. JPEG, PNG or WebP, up to 5 MB each. Bigger photos are made smaller for you.");
  assert.match(F.uploadRule(q("photo")), /^One image\. JPEG, PNG or WebP, up to 5 MB each\./);
  assert.match(F.uploadRule(q("facePhotos")), /^Up to 3 images/);
  assert.equal(F.formatsOf({ accept: ["image/png"] }), "PNG");
  assert.equal(F.formatsOf({ accept: ["image/png", "image/jpeg"] }), "JPEG or PNG");
});

test("the instruction text matches the input for every upload the step asks", () => {
  // Several-image questions say a number above one; single-image ones say "One image".
  assert.match(q("styleShots").prompt, /up to 6/i);
  assert.match(q("facePhotos").prompt, /1 to 3/);
  assert.match(q("photo").prompt, /One image/);
  assert.match(q("banner").prompt, /One image/);
  for (const id of ["styleShots", "photo", "banner", "facePhotos"]) assert.ok(q(id).accept.includes("image/webp"), `${id} takes WebP like the server does`);
});

test("the count beside the thumbnails, and the limit said plainly", () => {
  assert.equal(F.countLine(2, q("styleShots")), "2 of up to 6 added");
  assert.match(F.countLine(6, q("styleShots")), /^6 of 6 added\. That's the most you can add; use Replace/);
  assert.equal(F.countLine(1, q("photo")), "Added");
  assert.equal(F.countLine(0, q("photo")), "");
  assert.equal(F.countLine(0, q("styleShots")), "", "no count before the first image; the rule above says the limit");
});

test("adding several at once takes only what fits, and says what didn't", () => {
  const files = ["a", "b", "c", "d"];
  assert.deepEqual(F.planAdd(0, files, q("styleShots")), { take: files, left: 0, room: 6 });
  assert.deepEqual(F.planAdd(4, files, q("styleShots")), { take: ["a", "b"], left: 2, room: 2 });
  assert.deepEqual(F.planAdd(6, files, q("styleShots")), { take: [], left: 4, room: 0 });
  assert.deepEqual(F.planAdd(1, files, q("photo")), { take: ["a"], left: 3, room: 1 }, "a one-image question replaces with the first");
  assert.equal(F.addedLine({ added: 2, left: 2 }, q("styleShots")), "Added 2 images. 2 more weren't added: the limit is 6. Remove or replace one to add a different one.");
  assert.equal(F.addedLine({ added: 1, left: 0, failed: ["That image is over 5 MB. Use a smaller one."] }, q("styleShots")), "Added 1 image. 1 didn't upload: That image is over 5 MB. Use a smaller one.");
  assert.equal(F.addedLine({ added: 0, left: 0 }, q("styleShots")), "");
  assert.ok(F.isImageFile({ type: "image/heic" }));
  assert.ok(!F.isImageFile({ type: "application/pdf" }));
  assert.ok(!F.isImageFile(null));
});

test("a stale output becomes one sentence and one button, and AI work is never remade by itself", () => {
  const banner = F.staleItem({ output: "banner", made_at: "2026-10-30T10:00:00+00:00", changed: ["styleWords", "styleRefs"] });
  assert.equal(banner.text, "Your style changed after your banner options were made. Make new banner options?");
  assert.equal(banner.do, "make-banner");
  assert.ok(banner.costs);
  assert.equal(F.staleItem({ output: "headshot", changed: ["facePhotos", "styleWords"] }).text.startsWith("Your photos and style changed"), true);
  assert.equal(F.changedLine(["role", "techInterests", "voiceSample"]), "Your target, interests and writing sample changed");
  assert.equal(F.staleItem({ output: "voice", changed: ["voiceSample"], edited: true }).do, "open-studio", "a voice doc they edited is left alone");
  assert.equal(F.staleItem({ output: "voice", changed: ["voiceSample"] }).do, "voice");
  assert.equal(F.staleItem({ output: "mystery", changed: [] }), null);
});

test("Not now hides a stale item until something else changes", () => {
  const stale = [
    { output: "banner", made_at: "t1", changed: ["styleWords"] },
    { output: "position", made_at: "t2", changed: ["role"] },
  ];
  assert.deepEqual(F.staleToShow(stale).map((s) => s.id), ["banner", "position"]);
  const dismissed = { banner: "t1|styleWords" };
  assert.deepEqual(F.staleToShow(stale, dismissed).map((s) => s.id), ["position"]);
  const later = [{ output: "banner", made_at: "t1", changed: ["styleWords", "styleRefs"] }];
  assert.deepEqual(F.staleToShow(later, dismissed).map((s) => s.id), ["banner"], "a new change shows it again");
});

test("only answers the map is built from update the map", () => {
  for (const id of ["stage", "role", "level", "months", "apps", "stop"]) assert.ok(F.touchesMap(id), id);
  for (const id of ["styleShots", "styleWords", "voiceSample", "photo"]) assert.ok(!F.touchesMap(id), id);
});

test("cardGaps: a skipped role is named, with the question that fills it", () => {
  const gaps = F.cardGaps({ target: false, interests: true, taste: true, voice: true }, { answers: { stage: "grad" }, skipped: ["role", "headshot"] });
  assert.deepEqual(gaps, [{ key: "target", stage: "you", q: "role", label: "The role you want next", why: "You skipped this one. Your card needs it." }]);
});

test("cardGaps: 'Not sure yet' and a short sample each say why", () => {
  const gaps = F.cardGaps({ target: false, interests: true, taste: true, voice: false }, { answers: { role: "unsure", voiceSample: "Hi there, short note." }, skipped: [] });
  assert.equal(gaps.length, 2);
  assert.match(gaps[0].why, /Not sure yet/);
  assert.equal(gaps[1].q, "voiceSample");
  assert.match(gaps[1].why, /21 characters\. It needs 200/);
});

test("cardGaps: parts fed by several questions ask for one of them; a full card has no gaps", () => {
  const [gap] = F.cardGaps({ target: true, interests: false, taste: true, voice: true }, { answers: {}, skipped: ["techInterests", "personalInterests"] });
  assert.equal(gap.q, "techInterests");
  assert.match(gap.why, /at least one/);
  assert.deepEqual(F.cardGaps({ target: true, interests: true, taste: true, voice: true }, { answers: {}, skipped: [] }), []);
});
