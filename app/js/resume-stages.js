/**
 * The resume builder's steps and exactly when each one is finished (steps.js draws them).
 *
 * A snapshot is { rec, saves, nodeDone }: the record from GET /resume, the saved versions newest first,
 * and whether the map node's tasks are all checked. Every rule reads only the snapshot.
 *
 *   Start      something is on the record: a job, a project, a line or a question.
 *   Questions  started, and either no question is left or the lines have been written (stopping early
 *              and writing is finishing this step).
 *   Write      at least one line is written.
 *   Check      every line is kept (confirmed).
 *   Save       the newest saved version is today's resume (nothing changed since) and was downloaded.
 *   Finish     the student said "this is my resume" (the node's tasks are done).
 */

export const claimsOf = (rec) => (rec?.graph?.claims || []).filter((c) => c.status !== "rejected");
export const linesOf = (rec) => claimsOf(rec).filter((c) => c.line);

export const started = (rec) => {
  const g = rec?.graph || {};
  return Boolean((g.roles || []).length || (g.projects || []).length || (g.claims || []).length || (g.queue || []).length);
};
export const allConfirmed = (rec) => linesOf(rec).length > 0 && linesOf(rec).every((c) => c.status === "confirmed");
export const changedSinceSave = ({ rec, saves = [] }) =>
  Boolean(saves[0]) && Boolean(rec?.preview) && saves[0].text.trim() !== rec.preview.trim();
export const savedAndDownloaded = ({ rec, saves = [] }) =>
  Boolean(saves[0]) && saves[0].downloads > 0 && !changedSinceSave({ rec, saves });

export const STEPS = [
  { id: "start", label: "Start", done: ({ rec }) => started(rec) },
  { id: "questions", label: "Questions", done: ({ rec }) => started(rec) && (!rec.next || linesOf(rec).length > 0) },
  { id: "write", label: "Write", done: ({ rec }) => linesOf(rec).length > 0 },
  { id: "check", label: "Check", done: ({ rec }) => allConfirmed(rec) },
  { id: "save", label: "Save", done: (s) => savedAndDownloaded(s) },
];
export const FINISH = { id: "finish", label: "Finish", done: ({ nodeDone }) => Boolean(nodeDone) };

/** The steps for where the builder is shown: on its node it ends with Finish. */
export const stepsFor = (embedded) => (embedded ? [...STEPS, FINISH] : STEPS);

/**
 * Ready to send for this title? Three facts, not a feeling: every line kept, a version saved and downloaded,
 * and the job's checklist worked out. Fit is reported, never required (sending is also how we learn).
 * The Send node (views/send.js) opens on `ready`; the resume tool shows the same checks at the top.
 */
export function readiness({ rec, saves = [] }) {
  const needs = (rec?.needs || []).filter((n) => n.state !== "off");
  const shown = needs.filter((n) => n.status === "shown").length;
  const later = needs.filter((n) => n.state === "later").length;
  const checks = [
    { id: "check", label: "Every line checked and kept", ok: allConfirmed(rec), go: linesOf(rec).length ? "check" : "write" },
    { id: "save", label: "A version saved and downloaded", ok: savedAndDownloaded({ rec, saves }), go: "save" },
    { id: "needs", label: "The job's checklist worked out", ok: needs.length > 0, go: "questions" },
  ];
  const ready = checks.every((c) => c.ok);
  const fit = needs.length ? { shown, total: needs.length - later, later } : null;
  const fixable = needs.filter((n) => n.state === "on" && n.status !== "shown").length;
  return {
    ready,
    checks,
    fit,
    verdict: !ready ? "not_yet" : fit && fit.total && shown / fit.total < 0.5 ? "nearly" : "ready",
    note: !ready ? null : fit && fixable ? `${shown} of ${fit.total} on the checklist; ${fixable} you could still fix in the questions.` : fit ? `${shown} of ${fit.total} on the checklist.` : null,
  };
}

/** The resume preview shows only once it has one of their lines on it: a line goes on when it's kept. */
export const hasOutput = (rec) => linesOf(rec).some((c) => c.status === "confirmed");
