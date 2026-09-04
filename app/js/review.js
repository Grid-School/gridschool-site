/**
 * Returned reviews need four 1-5 CCVV scores and a verdict. The outcome, when
 * given, is `accepted` (the node lights) or `changes` (the student gets a fix
 * task and resubmits). Older records have no outcome and read as accepted.
 */
export const REVIEW_OUTCOMES = ["accepted", "changes"];

export function validReviewReturn({ verdict, ccvv, outcome }) {
  if (!String(verdict ?? "").trim()) return false;
  if (outcome !== undefined && !REVIEW_OUTCOMES.includes(outcome)) return false;
  if (!ccvv || typeof ccvv !== "object") return false;
  for (const key of ["communication", "comprehension", "vision", "verification"]) {
    const n = Number(ccvv[key]);
    if (!Number.isInteger(n) || n < 1 || n > 5) return false;
  }
  return true;
}
