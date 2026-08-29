/** Returned reviews need four 1–5 CCVV scores. Verdict alone is not enough. */
export function validReviewReturn({ verdict, ccvv }) {
  if (!String(verdict ?? "").trim()) return false;
  if (!ccvv || typeof ccvv !== "object") return false;
  for (const key of ["communication", "comprehension", "vision", "verification"]) {
    const n = Number(ccvv[key]);
    if (!Number.isInteger(n) || n < 1 || n > 5) return false;
  }
  return true;
}
