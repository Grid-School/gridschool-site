/**
 * Passwordless sign-in for the free map (server: accounts.py, accounts_api.py).
 * Email gets a 6-digit code (or a link in the same email); Google signs in on the
 * spot where it can. Inside Instagram's or Facebook's in-app browser Google blocks
 * sign-in, so the Google button never shows there and email does the whole job.
 *
 * The session token lives in this browser only; losing it just means signing in again.
 */

import { AUTH, isPlaceholder } from "../config.js?v=9300f22-202610261745";
import { visitorId } from "./events.js?v=9300f22-202610261745";

const KEY = "gridschool.account.v1";
const GSI = "https://accounts.google.com/gsi/client";

/** Meta's, LinkedIn's and similar in-app browsers, where Google sign-in fails. */
export function inAppBrowser(ua = navigator.userAgent) {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Line\/|Twitter|Snapchat|TikTok|BytedanceWebview/i.test(ua);
}

export const googleReady = () => !isPlaceholder(AUTH.googleClientId) && !inAppBrowser();

export function session() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return saved?.token?.startsWith("ga_") ? saved : null;
  } catch {
    return null;
  }
}

function remember(value) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    /* private window: signed in for this page only */
  }
}

async function call(api, path, body, token) {
  const res = await fetch(`${api}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Sign-in is unavailable for a moment. Try again.");
  return data;
}

/** Sends a code and a link. Resolves to {sent}: false when the email couldn't go out. */
export const sendCode = (api, email) => call(api, "/account/start", { email });

async function signedIn(promise) {
  const { token, email } = await promise;
  const value = { token, email };
  remember(value);
  return value;
}

/** `from` (where they came from) and the visitor id let the server count the sign-in on the same funnel. */
const who = (from = "") => ({ visitor: visitorId(), from });
export const verifyCode = (api, email, code, from) => signedIn(call(api, "/account/verify", { email, code, ...who(from) }));
export const verifyLink = (api, link, from) => signedIn(call(api, "/account/verify", { link, ...who(from) }));
export const google = (api, credential, from) => signedIn(call(api, "/account/google", { credential, ...who(from) }));

export async function me(api) {
  const current = session();
  if (!current) return null;
  try {
    return await call(api, "/account/me", undefined, current.token);
  } catch {
    remember(null); // expired or revoked: sign in again
    return null;
  }
}

export async function signOut(api) {
  const current = session();
  remember(null);
  if (current) await call(api, "/account/signout", {}, current.token).catch(() => {});
}

/** Draws Google's own button into `el` (its rules: their button, their wording). */
export async function mountGoogle(el, onCredential) {
  if (!googleReady()) return false;
  await new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement("script");
    script.src = GSI;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  }).catch(() => null);
  if (!window.google?.accounts?.id) return false;
  window.google.accounts.id.initialize({
    client_id: AUTH.googleClientId,
    callback: (response) => onCredential(response.credential),
    ux_mode: "popup",
    itp_support: true,
  });
  window.google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "continue_with", shape: "rectangular", width: 280 });
  return true;
}
