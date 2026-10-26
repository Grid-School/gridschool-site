/**
 * The resume engine's routes (server/resume_api.py). Every write sends the version it read; a 409
 * answers with the current record, which the page simply takes and keeps going.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=939d963-202610261500";
import { persistToken } from "./session.js?v=939d963-202610261500";

export function resumeReady() {
  return Boolean(persistToken() && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
}

async function call(method, path, body) {
  const response = await fetch(`${PERSIST.endpoint.replace(/\/$/, "")}${path}`, {
    method,
    headers: { Authorization: `Bearer ${persistToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `the server answered ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const base = (slug) => `/students/${encodeURIComponent(slug)}/resume`;

export const loadResume = (slug) => call("GET", base(slug));
export const importResume = (slug, version, { text, docx, replace }) => call("POST", `${base(slug)}/import`, { version, text, docx, replace });
export const startFresh = (slug, version, replace = false) => call("POST", `${base(slug)}/start`, { version, replace: replace || undefined });
export const answerQuestion = (slug, version, questionId, answer) => call("POST", `${base(slug)}/answer`, { version, question_id: questionId, answer });
export const skipQuestion = (slug, version, questionId) => call("POST", `${base(slug)}/answer`, { version, question_id: questionId, skip: true });
export const writeLines = (slug, version) => call("POST", `${base(slug)}/write`, { version });
export const confirmLine = (slug, version, claimId, decision, { text, defense } = {}) =>
  call("POST", `${base(slug)}/confirm`, { version, claim_id: claimId, decision, text, defense });
/* Saved versions: name it, keep it, download it again exactly as saved. */
export const listSaves = (slug) => call("GET", `${base(slug)}/saves`);
export const saveResume = (slug, name) => call("POST", `${base(slug)}/saves`, { name });
export const renderSave = (slug, id, format) => call("POST", `${base(slug)}/saves/${id}/render`, { format });
export const reportProblem = (slug, text, saveId) => call("POST", `${base(slug)}/report`, { text, save_id: saveId ?? null });

/* The console's reads (admin token): one student's run trace, and every student's sends before vs after. */
export const loadTrace = (slug) => call("GET", `${base(slug)}/trace`);
export const loadOutcomes = () => call("GET", "/resume/outcomes");
export const renderResume = (slug, format, targetUrl = "") => call("POST", `${base(slug)}/render`, { format, target_url: targetUrl });
