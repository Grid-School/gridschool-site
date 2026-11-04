/**
 * The interview's routes (server/interview_api.py): the chat-style intake inside the resume step.
 * Every write sends the version it read; a 409 answers with the current state, which the page takes.
 */

import { PERSIST } from "../../config.js?v=3c8024f-202611042144";
import { persistToken } from "./session.js?v=3c8024f-202611042144";
import { plainError } from "./plain-error.js?v=3c8024f-202611042144";

async function call(method, path, body) {
  const response = await fetch(`${PERSIST.endpoint.replace(/\/$/, "")}${path}`, {
    method,
    headers: { Authorization: `Bearer ${persistToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = plainError(response.status, payload);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

const base = (slug) => `/students/${encodeURIComponent(slug)}/interview`;

export const loadInterview = (slug) => call("GET", base(slug));
/** One turn: {version, question_id, kind: answer|unknown|na|skip, value?, text?, resume_version?, run?}. */
export const sendTurn = (slug, body) => call("POST", `${base(slug)}/turn`, body);
/** History in one go: {resume_version, zip (base64) | text | docx, replace?, run?}. */
export const importHistory = (slug, body) => call("POST", `${base(slug)}/import`, body);
export const markSession = (slug, action) => call("POST", `${base(slug)}/session`, { action });
