/**
 * One line under Today's next action: which family the step belongs to,
 * and whether it is required spine or elective depth.
 * Unknown family returns null; never invent "the world" as a fallback.
 */

const FAMILY_LINE = {
  portfolio: "This week's system · Repo (required)",
  ccvv: "This week's system · Skills (required)",
  capstone: "This week's system · Mission (required)",
  world: "This week's system · The world (depth track)",
  graph: "This week's system · Graph / nanograph (depth)",
};

export function systemLine(node) {
  if (!node) return null;
  if (node.family === "signal" && node.track === "depth") {
    return "This week's system · Career (depth)";
  }
  if (node.family === "signal") return "This week's system · Career (required)";
  return FAMILY_LINE[node.family] ?? null;
}
