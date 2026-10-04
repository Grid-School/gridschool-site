/** Pure task completion rules shared by the graph, step progress, and task UI. */

export function taskAnswersReady(task, saved = {}) {
  return (task?.fields ?? []).every(
    (field) => !field.required || String(saved.answers?.[field.id] ?? "").trim()
  );
}

export function taskIsComplete(task, saved = {}) {
  return saved.state === "done" && taskAnswersReady(task, saved);
}

/**
 * Habits. A `kind: "count"` task ("3 comments a day", "2 posts a week") is a
 * tally that starts over each period, so its state is stored per period under
 * `${task.id}#${periodKey}` and yesterday's count never satisfies today.
 */
export function isCountTask(task) {
  return task?.kind === "count";
}

const pad = (value) => String(value).padStart(2, "0");

/**
 * The period a habit counts in. Day is the student's local calendar date
 * (YYYY-MM-DD); week is the ISO week (2026-W40), Monday to Sunday, so the
 * key flips on the same night everywhere a student opens the board.
 */
export function periodKey(per, date = new Date()) {
  if (per === "week") {
    // ISO 8601: the week belongs to the year that holds its Thursday. The
    // local date is copied into UTC so daylight saving cannot shift a day.
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
    const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
    return `${day.getUTCFullYear()}-W${pad(week)}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Where a task's state lives on `student.tasks`. */
export function taskStateId(task, now = new Date()) {
  if (isCountTask(task)) return `${task.id}#${periodKey(task.per, now)}`;
  return task.weekKey ?? task.id;
}

/** The saved record for a task, read through the one key rule above. */
export function savedTask(student, task, now = new Date()) {
  return student?.tasks?.[taskStateId(task, now)] ?? {};
}

/** How many a habit has this period. */
export function countOf(saved = {}) {
  const count = Number(saved.answers?.count);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/**
 * A node task with its saved state attached, the shape taskRow renders. Count
 * tasks carry their period key as `weekKey`, which is what stateIdOf reads.
 */
export function withSavedState(task, student, now = new Date()) {
  const saved = savedTask(student, task, now);
  return {
    ...task,
    ...(isCountTask(task) ? { weekKey: taskStateId(task, now) } : {}),
    state: saved.state ?? "todo",
    answers: saved.answers ?? {},
  };
}
