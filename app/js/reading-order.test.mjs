import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bareReadingTitle,
  displayReadingTitle,
  numberCurriculumReadings,
  walkReadings,
} from "./reading-order.js?v=b6ca108-202610080352";

const site = join(dirname(fileURLToPath(import.meta.url)), "../..");
const curriculum = JSON.parse(readFileSync(join(site, "data/curriculum.json"), "utf8"));

test("the first readings follow the board, not the file prefix", () => {
  const { list } = walkReadings(curriculum);
  assert.deepEqual(list.slice(0, 4).map(row => row.id), [
    "readings/ai-and-foundations",
    "readings/your-machine",
    "readings/northline-baseline",
    "disciplines/00-the-agentic-systems-engineer",
  ]);
  assert.deepEqual(list.slice(0, 4).map(row => row.n), [1, 2, 3, 4]);
  assert.equal(list[6].id, "disciplines/15-how-a-system-runs");
  assert.equal(list[6].n, 7);
});

test("display titles use walk order and drop the file number", () => {
  const order = walkReadings(curriculum);
  assert.equal(
    displayReadingTitle(
      { id: "disciplines/15-how-a-system-runs", title: "15 · How a system runs, end to end" },
      order
    ),
    "07 · How a system runs, end to end"
  );
  assert.equal(bareReadingTitle("00 · The engineer this program is building"), "The engineer this program is building");
});

test("numbering a curriculum is stable if applied twice", () => {
  const once = numberCurriculumReadings(curriculum);
  const twice = numberCurriculumReadings(once);
  const first = once.nodes.find((node) => node.id === "fs.map").modules[0].title;
  const again = twice.nodes.find((node) => node.id === "fs.map").modules[0].title;
  assert.equal(first, "07 · How a system runs, end to end");
  assert.equal(again, first);
});
