/**
 * Student-facing words. One file so "done" never means "lit" on one screen and
 * "complete" on another. Instructor-facing chrome can still say instructor.
 *
 * The board still lights a node only when a URL exists. That is the rule. The
 * student does not need the metaphor to follow it.
 */

import { STATUS } from "./graph/model.js";

export const RULE = "A step is done when it has a link.";
/** @deprecated use RULE, kept so old imports do not break mid-edit */
export const LAW = RULE;

export function statusLabel(status) {
  return {
    [STATUS.LIT]: "Done",
    [STATUS.OPEN]: "Current",
    [STATUS.LOCKED]: "Locked",
    [STATUS.FUTURE]: "Later",
  }[status] ?? status;
}

export function trackLabel(track) {
  return track === "depth" ? "Depth · optional" : "Required";
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
