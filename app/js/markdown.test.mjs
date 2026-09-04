import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, splitTitle } from "./markdown.js";

test("splitTitle takes the leading H1 and leaves the body", () => {
  const { title, body } = splitTitle("# 05 · Agentic workflow\n\n*Series: disciplines.*\n\n## First\n");
  assert.equal(title, "05 · Agentic workflow");
  assert.equal(body, "*Series: disciplines.*\n\n## First\n");
});

test("splitTitle leaves a file with no leading H1 alone", () => {
  const src = "Plain opening.\n\n## Later heading\n";
  assert.deepEqual(splitTitle(src), { title: null, body: src });
});

test("splitTitle does not mistake a later H1 for the title", () => {
  const src = "Intro.\n\n# Not the title\n";
  assert.equal(splitTitle(src).title, null);
});

test("a mermaid fence renders as a code block the hydrator can find", () => {
  const html = renderMarkdown("```mermaid\nflowchart LR\n  A --> B\n```\n");
  assert.match(html, /<code class="lang-mermaid">/);
  assert.match(html, /A --&gt; B/);
});

test("a pipe table renders head and body rows", () => {
  const html = renderMarkdown("| Field | Question |\n|---|---|\n| Claim | What? |\n");
  assert.match(html, /<thead><tr><th>Field<\/th><th>Question<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td>Claim<\/td><td>What\?<\/td><\/tr><\/tbody>/);
});
