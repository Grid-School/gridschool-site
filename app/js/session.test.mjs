import test from "node:test";
import assert from "node:assert/strict";
import { persistToken, resolveSlug, setPersistToken, signIn, signOut } from "./session.js";

function installMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function setSearch(search) {
  globalThis.location = { search };
}

test("demo signs in from the URL without a notebook token", () => {
  installMemoryStorage();
  setSearch("?s=demo");
  assert.equal(resolveSlug(), "demo");
});

test("a real slug without a token does not become a session", () => {
  installMemoryStorage();
  setSearch("?s=jane");
  assert.equal(resolveSlug(), "jane");
  assert.equal(persistToken(), "");
});

test("a real slug with a token becomes the session", () => {
  installMemoryStorage();
  setPersistToken("gs_test");
  setSearch("?s=jane");
  assert.equal(resolveSlug(), "jane");
  signOut();
  signIn("jane", { persistToken: "gs_test" });
  setSearch("");
  assert.equal(resolveSlug(), "jane");
});
