/**
 * The morning roles email's routes (server/daily_run_api.py), for the signed-in student.
 *
 *   dailyRunState  GET  /students/:slug/daily-run  {on, last}
 *   setDailyRun    POST /students/:slug/daily-run  {on}: their profile's switch
 *   markClicked    POST /students/:slug/daily-run  {clicked: true}: they opened the app from the email
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=fc7db25-202610310827";
import { persistToken } from "./session.js?v=fc7db25-202610310827";
import { plainError } from "./plain-error.js?v=fc7db25-202610310827";

export function dailyRunReady(slug) {
  return Boolean(slug && slug !== "demo" && persistToken() && PERSIST?.endpoint && !isPlaceholder(PERSIST.endpoint));
}

async function call(method, slug, body) {
  const response = await fetch(`${PERSIST.endpoint.replace(/\/$/, "")}/students/${encodeURIComponent(slug)}/daily-run`, {
    method,
    headers: { Authorization: `Bearer ${persistToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw plainError(response.status, payload);
  return payload;
}

export const dailyRunState = (slug) => call("GET", slug);
export const setDailyRun = (slug, on) => call("POST", slug, { on });

/** Counting never blocks or breaks the page. */
export function markClicked(slug) {
  if (!dailyRunReady(slug)) return;
  call("POST", slug, { clicked: true }).catch(() => {});
}
