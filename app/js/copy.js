/**
 * Student-facing words. One file so "done" never means "lit" on one screen and
 * "complete" on another. Instructor-facing chrome can still say instructor.
 *
 * How a step finishes depends on its class: answers on the page, one link,
 * or a review. The student sees that in ordinary words, not as a lighting rule.
 */

import { STATUS } from "./graph/model.js";

export const RULE = "Each step tells you whether to finish its tasks, save a link, or wait for review.";
/** @deprecated use RULE, kept so old imports do not break mid-edit */
export const LAW = RULE;

export function stepRule(node) {
  if (!node || node.kind === "future") return "";
  if (node.completion === "tasks") return "Finish every task to complete this step.";
  if (node.signoff) return "This step is complete after the reviewer accepts your work.";
  return "Save the required link to complete this step.";
}

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
