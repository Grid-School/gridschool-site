/**
 * Student-facing words. One file so "done" never means "lit" on one screen and
 * "complete" on another. Instructor-facing chrome can still say instructor.
 *
 * The board still lights a node only when a URL exists. That is the rule. The
 * student does not need the metaphor to follow it.
 */

import { STATUS } from "./graph/model.js";

export const LAW = "A step is done when it has a link.";

export function statusLabel(status) {
  return {
    [STATUS.LIT]: "Done",
    [STATUS.OPEN]: "Current",
    [STATUS.LOCKED]: "Locked",
    [STATUS.FUTURE]: "Later",
  }[status] ?? status;
}

export function trackLabel(track) {
  return track === "depth" ? "Depth" : "Required";
}

const CCVV_LABEL = {
  communication: "Communication",
  comprehension: "Comprehension",
  vision: "Vision",
  verification: "Verification",
};

export function ccvvLabel(id) {
  return CCVV_LABEL[id] ?? id;
}
