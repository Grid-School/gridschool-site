import test from "node:test";
import assert from "node:assert/strict";
import { nameOf } from "./telemetry.js?v=afd944f-202610271949";

/* A tiny stand-in for DOM nodes: enough to check that a control is named by what we wrote, never by what was typed. */
function node(tag, { attrs = {}, text = "", parent = null, id = "", value = "" } = {}) {
  const n = {
    tagName: tag.toUpperCase(), id, value, textContent: text, parent,
    getAttribute: (k) => attrs[k] ?? null,
    closest(sel) {
      for (let c = this; c; c = c.parent) {
        if (sel === "[data-private]" && c.getAttribute("data-private") !== null) return c;
        if (sel === "[data-track]" && c.getAttribute("data-track") !== null) return c;
        if (sel === "label" && c.tagName === "LABEL") return c;
      }
      return null;
    },
  };
  return n;
}

test("a control is named by data-track, then its label, never its value", () => {
  globalThis.document = { querySelector: () => null };
  globalThis.CSS = { escape: (s) => s };
  assert.equal(nameOf(node("button", { attrs: { "data-track": "resume.save" }, text: "Save" })), "resume.save");
  assert.equal(nameOf(node("button", { text: "  Save   answer " })), "button:Save answer");
  const box = node("textarea", { attrs: { placeholder: "Paste your whole resume here" }, value: "Maya Torres, 555-0100" });
  assert.equal(nameOf(box), "textarea:Paste your whole resume here");
  assert.ok(!nameOf(box).includes("Maya"));
  const secret = node("span", { text: "maya@example.com", parent: node("div", { attrs: { "data-private": "" } }) });
  assert.equal(nameOf(secret), "(private)");
  assert.equal(nameOf(node("input", {})), "input:unnamed");
});
