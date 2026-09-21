import test from "node:test";
import assert from "node:assert/strict";
import { PRIVATE_LINK_KEYS, isPrivateLinkKey } from "../config.js";
import { isLocalHost, redactPrivateLinks, selectPrivateLinks } from "./site-overrides.js";

const leaked = {
  links: {
    discord: "https://discord.gg/secret-invite",
    discordAsks: "https://discord.gg/secret-invite",
    fitCall: "https://cal.com/gridschool/fit",
  },
  copy: { nodes: { "or.start": { title: "Welcome" } } },
};

test("public redact drops every Discord invite and keeps public links", () => {
  const publicDoc = redactPrivateLinks(leaked);
  assert.equal(publicDoc.links.discord, undefined);
  assert.equal(publicDoc.links.discordAsks, undefined);
  assert.equal(publicDoc.links.fitCall, "https://cal.com/gridschool/fit");
  assert.equal(publicDoc.copy.nodes["or.start"].title, "Welcome");
  assert.equal(leaked.links.discord, "https://discord.gg/secret-invite");
});

test("selectPrivateLinks keeps only connected Discord keys", () => {
  const selected = selectPrivateLinks({
    discord: "https://discord.gg/secret-invite",
    discordAsks: "REPLACE_ME_DISCORD_ASKS",
    fitCall: "https://cal.com/gridschool/fit",
  });
  assert.deepEqual(selected, { discord: "https://discord.gg/secret-invite" });
});

test("localhost is the only host that may load the local invite file", () => {
  assert.equal(isLocalHost("localhost"), true);
  assert.equal(isLocalHost("127.0.0.1"), true);
  assert.equal(isLocalHost("gridschool.org"), false);
  assert.equal(isLocalHost("lab.gridschool.org"), false);
  assert.equal(isLocalHost(""), false);
});

test("private key list matches the Discord LINKS keys", () => {
  assert.deepEqual(
    [...PRIVATE_LINK_KEYS],
    ["discord", "discordAsks", "discordShip", "discordBugs", "discordWorld"]
  );
  assert.equal(isPrivateLinkKey("discord"), true);
  assert.equal(isPrivateLinkKey("fitCall"), false);
});
