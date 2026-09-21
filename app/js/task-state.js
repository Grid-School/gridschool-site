/** Pure task completion rules shared by the graph, step progress, and task UI. */

export function taskAnswersReady(task, saved = {}) {
  return (task?.fields ?? []).every(
    (field) => !field.required || String(saved.answers?.[field.id] ?? "").trim()
  );
}

export function taskIsComplete(task, saved = {}) {
  return saved.state === "done" && taskAnswersReady(task, saved);
}
