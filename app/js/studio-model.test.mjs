import test from "node:test";
import assert from "node:assert/strict";
import {
  toolOf,
  projectDone,
  postDone,
  autoPostNode,
  autoProjectNode,
  placeholdersIn,
  launchingTask,
  completionFor,
  weekLine,
  seedHints,
} from "./studio-model.js?v=d177a03-202610252138";

test("the tool comes from the route, projects by default", () => {
  assert.equal(toolOf("posts"), "posts");
  assert.equal(toolOf("projects"), "projects");
  assert.equal(toolOf(undefined), "projects");
  assert.equal(toolOf("m.build-posts.decision"), "projects");
});

test("project nodes: ideas, then a pick that is on the map", () => {
  assert.deepEqual(projectDone({}), []);
  assert.equal(autoProjectNode({}), "ideas");
  const studio = { projects: { ideas: [{ id: "a-1" }], picked: { id: "a-1", node: "pj.a-1" } } };
  assert.deepEqual(projectDone(studio), ["ideas", "pick"]);
  assert.equal(autoProjectNode(studio), "pick");
});

test("posts open on the voice doc first, then ideas, then drafts", () => {
  assert.equal(autoPostNode({}), "voice");
  assert.equal(autoPostNode({ voice: { summary: "dry" } }), "ideas");
  assert.equal(autoPostNode({ voice: { edited: "mine" }, posts: { ideas: [{}] } }), "ideas");
  assert.equal(autoPostNode({ posts: { drafts: [{ id: "d1" }] } }), "drafts");
  assert.deepEqual(postDone({ voice: { summary: "x" }, posts: { ideas: [{}], drafts: [{ status: "draft" }] } }), ["voice", "ideas"]);
  assert.deepEqual(postDone({ posts: { drafts: [{ status: "posted" }] } }), ["drafts"]);
});

test("brackets left in a draft are found, links and short marks are not", () => {
  assert.deepEqual(placeholdersIn("It took [how long] and [link to the repo]."), ["[how long]", "[link to the repo]"]);
  assert.deepEqual(placeholdersIn("x[1] and [ ] and none"), []);
  assert.deepEqual(placeholdersIn(null), []);
});

const GRAPH = {
  nodes: [
    { id: "m.build-posts", title: "Post the build", tasks: [{ id: "m.build-posts.decision", title: "Decision" }] },
    { id: "m.posting-kit", title: "Posting kit", tasks: [{ id: "m.posting-kit.first", fields: [{ id: "url", required: true }] }] },
  ],
};

test("the task that opened the studio is found on the graph", () => {
  assert.equal(launchingTask(GRAPH, "m.posting-kit.first").node.id, "m.posting-kit");
  assert.equal(launchingTask(GRAPH, "nope"), null);
  assert.equal(launchingTask(GRAPH, null), null);
  assert.equal(launchingTask(null, "m.posting-kit.first"), null);
});

test("checking a task: a url field takes the post's link, no fields need nothing", () => {
  const withUrl = GRAPH.nodes[1].tasks[0];
  assert.equal(completionFor(withUrl, {}), null);
  assert.deepEqual(completionFor(withUrl, { url: " https://x.y/p " }), { url: "https://x.y/p" });
  assert.deepEqual(completionFor(GRAPH.nodes[0].tasks[0]), {});
  assert.equal(completionFor({ fields: [{ id: "spec", required: true }] }, { url: "https://x" }), null);
  assert.equal(completionFor(null), null);
});

test("week line and seed hints", () => {
  assert.equal(weekLine({ draft: { used: 5, limit: 80 } }, "draft", "drafts"), "75 drafts left this week");
  assert.equal(weekLine({ draft: { used: 0, limit: 0 } }, "draft", "drafts"), "");
  assert.equal(weekLine(undefined, "draft", "drafts"), "");
  assert.deepEqual(seedHints({ complete: { target: true, interests: false, proof: false } }), ["what you're interested in", "a few confirmed lines on your resume"]);
  assert.deepEqual(seedHints(undefined).length, 3);
});
