/**
 * What a student reads when a server call fails. The server's own messages written for students start with a
 * capital letter ("That image is over 5 MB. Use a smaller one.") and pass through. Internal ones start lower
 * case ("token cannot read this seat", "intake unavailable", "styleShots: upload refs only"), and a bare status
 * has no message at all: those become one plain line that says what to do next. The original stays on
 * `error.detail` for the console. Used by every *-remote.js call(). Tests: plain-error.test.mjs.
 */

const SAFE = /^[A-Z"']/;

export function plainMessage(status, message) {
  const text = String(message || "").trim();
  if (text && SAFE.test(text)) return text;
  if (status === 401) return "You're signed out. Sign in again, and your work will be where you left it.";
  if (status === 403) return "This isn't open on your account. If you think it should be, ask your coach.";
  if (status === 404) return "We couldn't find that. Reload the page; if it's still missing, ask your coach.";
  if (status === 409) return "This changed in another tab or on another device. Reload the page to see the latest.";
  if (status === 429) return "That's a lot at once. Wait a minute, then try again.";
  if (status >= 400 && status < 500) return "That didn't save. Check what you entered and try again. If it keeps happening, ask your coach.";
  return "Something went wrong on our side. Your work is still here. Try again in a minute, or ask your coach.";
}

/** An Error for a failed response, with the plain message, the status, the payload and the original text. */
export function plainError(status, payload) {
  const error = new Error(plainMessage(status, payload?.error));
  error.status = status;
  error.payload = payload;
  error.detail = payload?.error || `status ${status}`;
  return error;
}
