/**
 * Step status: one rule for every stepper in the app (the resume, Who you are, images, posts, Prepare,
 * campaigns). Pure, no DOM, so each tool's rules are tested on their own.
 *
 * - A step is done only when its own test says so. Done looks the same everywhere: a solid green circle
 *   with a check, whether or not you're looking at it.
 * - "Here" is a white ring around the step you're on. It's never a fill, so it can't be read as done.
 * - Not done is a hollow circle with its number.
 * - The line between two steps is green only when both ends are done. Green never runs into a step
 *   that isn't finished.
 *
 * A tool declares its steps as data: [{ id, label, done(snapshot) => boolean }]. The view takes a
 * snapshot of what it knows (the record, the saves, the node), asks doneIds(), and draws stepStates().
 */

/** Which steps pass their own test for this snapshot. A step without a test is never done. */
export function doneIds(steps, snapshot) {
  return steps.filter((s) => typeof s.done === "function" && Boolean(s.done(snapshot))).map((s) => s.id);
}

/** What to draw for each step: its number, done, here, and whether the line into it is green. */
export function stepStates(steps, { done = [], here = null } = {}) {
  const finished = new Set(done);
  return steps.map((s, i) => ({
    id: s.id,
    label: s.label,
    n: i + 1,
    done: finished.has(s.id),
    here: s.id === here,
    linked: i > 0 && finished.has(steps[i - 1].id) && finished.has(s.id),
  }));
}

/** The first step that isn't done, or the last step when all are. */
export function firstOpen(steps, done = []) {
  const finished = new Set(done);
  return (steps.find((s) => !finished.has(s.id)) || steps[steps.length - 1])?.id ?? null;
}
