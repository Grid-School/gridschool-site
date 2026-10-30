/**
 * "Didn't get your sign-in email?" on the after-payment page (begin.js; server billing_api.checkout_peek and
 * checkout_fix). Stripe sends a Complete buyer to begin/?session_id=cs_... (ops/stripe-setup.py); holding that id is
 * the proof they paid, so it can show the email we have (masked) and move the map to the right one, within a week
 * of paying. Kept pure apart from the two calls, so recovery.test.mjs can read it.
 */

export const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const KEY = "gridschool.checkout.session";

/** The checkout session from the after-payment link, else the one this tab saw earlier, else "". */
export function sessionFrom(search = "", stored = "") {
  const asked = new URLSearchParams(search).get("session_id") || "";
  if (SESSION_RE.test(asked)) return asked;
  return SESSION_RE.test(stored || "") ? stored : "";
}

/** Read and keep it for this tab only (a reload or the sign-in form coming back still has it). */
export function rememberSession(search, storage = globalThis.sessionStorage) {
  let stored = "";
  try {
    stored = storage?.getItem(KEY) || "";
  } catch {
    /* storage blocked: this page load only */
  }
  const session = sessionFrom(search, stored);
  try {
    if (session) storage?.setItem(KEY, session);
  } catch {
    /* storage blocked */
  }
  return session;
}

export const COPY = {
  ask: "Didn't get your sign-in email?",
  checking: "Looking up your payment…",
  waiting: "We haven't received this payment yet. Give it a minute and try again.",
  have: (masked) => `We sent your sign-in to ${masked}.`,
  check: "Check your spam folder first. If that address is wrong, type the right one and we'll move your map there.",
  right: "That's my email",
  fix: "Send it to this email",
  placeholder: "The right email",
  moved: (email) => `We moved your map to ${email} and sent a new code there.`,
  spam: "Then it's in your inbox or spam folder. Or type that email below and we'll send a new code.",
};

/** What the recovery card says for a peek answer: {title, lead, canFix, why}. */
export function peekView(answer) {
  if (!answer || !answer.email) return { title: COPY.ask, lead: COPY.waiting, canFix: false, why: "" };
  return { title: COPY.have(answer.email), lead: answer.canFix ? COPY.check : "", canFix: Boolean(answer.canFix), why: answer.canFix ? "" : answer.why || "" };
}

async function post(api, path, body) {
  const res = await fetch(`${api}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

/** {email, canFix, why} or null when the payment hasn't arrived yet. Throws on anything else. */
export async function peek(api, session) {
  const { status, ok, data } = await post(api, "/billing/checkout/peek", { session });
  if (status === 404) return null;
  if (!ok) throw new Error(data.error || "We couldn't look that up just now. Try again in a moment.");
  return data;
}

/** Moves the map to `email` and sends the sign-in there. Resolves to {email, sent}; throws with our words. */
export async function fix(api, session, email) {
  const { ok, data } = await post(api, "/billing/checkout/email", { session, email });
  if (!ok) throw new Error(data.error || "That didn't work just now. Try again in a moment.");
  return data;
}
