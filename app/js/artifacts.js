/**
 * The three things a student owns after the first month. Every later step
 * edits one of them, and the step page says which, so the map reads as
 * "the same three things, again, on a harder ticket" instead of forty-one
 * separate circles. A node with no `artifact` is orientation, Career, or the
 * owned system, which carries its own family label.
 *
 * Doctrine: ops/agentic-systems-engineer.md §20; student text: or.start.
 */

export const ARTIFACTS = {
  ticket: {
    label: "Your ticket on the world",
    edits: "The live system you change through the board. This step adds to what your merged work proves.",
  },
  graph: {
    label: "Your graph tool",
    edits: "nanograph, the parser you built. This step adds a question it can answer.",
  },
  script: {
    label: "Your script",
    edits: "The program that runs your agents. This step adds a constraint, a measurement, or an input to it.",
  },
};

export function artifactOf(node) {
  const key = node?.artifact;
  return key && ARTIFACTS[key] ? { key, ...ARTIFACTS[key] } : null;
}
