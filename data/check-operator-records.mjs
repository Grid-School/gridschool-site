#!/usr/bin/env node
/**
 * Operator records must describe the live staged graph and completion rules.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = {
  plan: readFileSync(join(root, "ops/curriculum-operating-plan.md"), "utf8"),
  doctrine: readFileSync(join(root, "ops/agentic-systems-engineer.md"), "utf8"),
  review: readFileSync(join(root, "ops/review-cheat-sheet.md"), "utf8"),
};

const checks = [
  ["plan", files.plan, /fs\.choose/, "operating plan still names Choose the stack"],
  ["plan", files.plan, /completion: "tasks"|in-app/, "operating plan records in-app completion"],
  ["plan", files.plan, /pj\.ship requires pj\.model only|pj\.ship requires pj\.model ONLY|pj\.ship requires pj\.model only/i, "operating plan dropped fs.ship as a project-ship gate"],
  ["doctrine", files.doctrine, /2026-09-20/, "doctrine has the 2026-09-20 amendment"],
  ["doctrine", files.doctrine, /Publish waits on the defense verdict and on the profile/i, "doctrine records publish waiting on the profile"],
  ["review", files.review, /in-app|answers on this page|answers on the step/i, "review sheet looks for in-app answers"],
];

let failed = 0;
for (const [name, text, pattern, label] of checks) {
  if (!pattern.test(text)) {
    failed += 1;
    console.error(`FAIL ${name}: ${label}`);
  }
}

if (files.plan.includes("fs.* nodes require only `or.setup`") || files.plan.includes("nine `fs.*` nodes require only `or.setup`")) {
  failed += 1;
  console.error("FAIL plan: old nine-way fan-out sentence is still in force");
}

if (failed) {
  process.exit(1);
}
console.log("operator records match the live graph");
