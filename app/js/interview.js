/**
 * The interview's rules, apart from the page: how far through the round they are, what an answer just
 * gained them, and the quick answers for a number. Pure, so each is tested on its own.
 *
 * A round is resume_engine.ROUND questions (the server counts answers and skips in rec.round). After one
 * round the page offers to write the lines; the rest of the questions wait for later.
 */

/** Where they are in this round. over: the round is done and questions are still open. */
export function roundState(rec, { keepGoing = false } = {}) {
  const size = rec?.round?.size || 8;
  const done = rec?.round?.done || 0;
  const open = (rec?.graph?.queue || []).filter((q) => q.state === "open").length;
  const left = Math.max(0, size - done);
  const over = done >= size && open > 0 && !keepGoing;
  return {
    size,
    done,
    open,
    over,
    title: done < size ? `Question ${done + 1} of ${Math.min(size, done + open)}` : "One more, if you like",
    after: done < size ? (Math.min(left, open) - 1 > 0 ? `${Math.min(left, open) - 1} after this, then we write your lines.` : "The last one in this round. Then we write your lines.") : "Answer or skip. Write your lines whenever you're ready.",
  };
}

/** One claim as a short line of what we now know: what they did, what came of it, the number. */
export function factLine(claim) {
  const f = claim?.facts || {};
  const did = [f.action, f.object].filter(Boolean).join(" ") || claim?.original || "";
  const bits = [did];
  if (f.result) bits.push(`→ ${f.result}`);
  const nums = (claim?.metrics || []).map((m) => [m.value, m.unit].filter(Boolean).join(" ")).filter(Boolean);
  if (nums.length) bits.push(`· ${nums.join(", ")}`);
  return bits.join(" ").trim();
}

/** What the last answer gained: the lines it changed, and the needs that are now shown on the resume. */
export function gained(before, after, touched = []) {
  const claims = new Map((after?.graph?.claims || []).map((c) => [c.id, c]));
  const lines = touched.map((id) => claims.get(id)).filter(Boolean).map(factLine).filter(Boolean);
  const was = new Map((before?.needs || []).map((n) => [n.id, n.status]));
  const nowShown = (after?.needs || []).filter((n) => n.state === "on" && n.status === "shown" && was.get(n.id) && was.get(n.id) !== "shown").map((n) => n.label);
  return { lines, nowShown };
}

/** Questions that want a number get quick answers they can tap instead of recalling an exact figure. */
export const RANGES = ["about 1–5", "about 5–20", "about 20–100", "100+", "about 10% better", "about half the time"];
export const wantsNumber = (q) => ["R3", "R4", "N1"].includes(q?.node);

/** Add a tapped range to what they've typed, as its own sentence. */
export function addRange(text, range) {
  const t = (text || "").trim();
  return t ? `${t.replace(/[.\s]*$/, "")}. ${range.charAt(0).toUpperCase()}${range.slice(1)}.` : `${range.charAt(0).toUpperCase()}${range.slice(1)}.`;
}
