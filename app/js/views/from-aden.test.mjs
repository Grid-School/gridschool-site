import test from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseNotes, dueLabel, dueTone, daysUntil, safeLinks, fromAdenModel, fromAdenCard } from "./from-aden.js?v=8b71053-202610102102";
import { dueSoon } from "./tasks.js?v=8b71053-202610102102";

test("the card is null when Aden left nothing (or the node is free-form)", () => {
  assert.equal(fromAdenModel({}), null);
  assert.equal(fromAdenModel({ fromAden: { notes: null, links: [], due: null } }), null);
  assert.equal(fromAdenModel({ fromAden: { notes: "   ", links: [{ label: "x", url: "javascript:alert(1)" }], due: "soon" } }), null);
  assert.equal(fromAdenCard({ fromAden: { notes: null, links: [], due: null } }), null); // no DOM needed for the empty path
});

test("bold is the only inline mark; an unclosed ** stays literal", () => {
  assert.deepEqual(parseInline("a **b** c"), [
    { text: "a ", bold: false },
    { text: "b", bold: true },
    { text: " c", bold: false },
  ]);
  assert.deepEqual(parseInline("**open"), [{ text: "**open", bold: false }]);
});

test("notes parse into paragraphs, bullets and quotes; HTML and links stay literal text", () => {
  const blocks = parseNotes(
    "From Saturday:\nkeep it short.\n\n**Draft 1** is ready.\n- fill the brackets\n- post it\n> I filled out a form\n> at <b>Uber</b> [link](https://x.example)\n\n<script>alert(1)</script>"
  );
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["p", "p", "ul", "quote", "p"]
  );
  assert.equal(blocks[0].spans[0].text, "From Saturday: keep it short.");
  assert.deepEqual(blocks[1].spans[0], { text: "Draft 1", bold: true });
  assert.deepEqual(blocks[2].items.map((item) => item[0].text), ["fill the brackets", "post it"]);
  assert.equal(blocks[3].lines[1][0].text, "at <b>Uber</b> [link](https://x.example)");
  assert.equal(blocks[4].spans[0].text, "<script>alert(1)</script>");
});

test("links: only labelled http(s) links survive", () => {
  assert.deepEqual(
    safeLinks([
      { label: "Recording", url: "https://example.com/r" },
      { label: "Plain", url: "http://example.com" },
      { label: "Bad", url: "javascript:alert(1)" },
      { label: "", url: "https://example.com" },
      { label: "Data", url: "data:text/html,hi" },
      null,
    ]),
    [
      { label: "Recording", url: "https://example.com/r" },
      { label: "Plain", url: "http://example.com" },
    ]
  );
});

test("due reads as a calendar day: Due Fri Oct 9, never shifted by time zone", () => {
  assert.equal(dueLabel("2026-10-09"), "Due Fri Oct 9");
  assert.equal(dueLabel("2026-10-10"), "Due Sat Oct 10");
  assert.equal(dueLabel("2026-02-30"), null);
  assert.equal(dueLabel(null), null);
  const today = new Date(2026, 9, 8); // Thu Oct 8, local
  assert.equal(daysUntil("2026-10-10", today), 2);
  assert.equal(dueTone("2026-10-10", today), "soon");
  assert.equal(dueTone("2026-10-07", today), "late");
  assert.equal(dueTone("2026-10-20", today), "later");
});

test("the model carries notes, links and the due label", () => {
  const model = fromAdenModel({ fromAden: { notes: "Hi **you**", links: [{ label: "A", url: "https://a.example" }], due: "2026-10-10" } });
  assert.equal(model.due, "Due Sat Oct 10");
  assert.equal(model.dueIso, "2026-10-10");
  assert.equal(model.links.length, 1);
  assert.equal(model.blocks.length, 1);
});

test("Tasks lists dated, unfinished steps soonest first", () => {
  const graph = {
    nodes: [
      { id: "a", n: 1, title: "A", status: "open", fromAden: { due: "2026-10-12" } },
      { id: "b", n: 2, title: "B", status: "lit", fromAden: { due: "2026-10-01" } },
      { id: "c", n: 3, title: "C", status: "locked", fromAden: { due: "2026-10-09" } },
      { id: "d", n: 4, title: "D", status: "open", fromAden: { due: null } },
      { id: "e", n: 5, title: "E", status: "open" },
    ],
  };
  assert.deepEqual(
    dueSoon(graph).map((row) => [row.id, row.label]),
    [
      ["c", "Due Fri Oct 9"],
      ["a", "Due Mon Oct 12"],
    ]
  );
  assert.deepEqual(dueSoon({ nodes: [] }), []);
});
