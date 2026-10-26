/**
 * Public auth against the lab notebook. No bearer. Redeem and login return
 * the notebook token and the cohort access key so the client can inject both.
 */

import { PERSIST, isPlaceholder } from "../../config.js?v=4f66e99-202610260033";
import { setPersistToken, signIn } from "./session.js?v=4f66e99-202610260033";
import { unlock } from "./gate.js?v=4f66e99-202610260033";

function endpoint() {
  return String(PERSIST.endpoint || "").replace(/\/$/, "");
}

export function authReady() {
  return Boolean(endpoint() && !isPlaceholder(PERSIST.endpoint));
}

async function request(method, path, body) {
  if (!authReady()) {
    const error = new Error("The lab is not connected.");
    error.code = "NO_AUTH";
    throw error;
  }
  const headers = {};
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${endpoint()}${path}`, init);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(payload.error || `auth ${res.status}`);
    error.status = res.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function peekInvite(invite) {
  return request("GET", `/auth/invite?token=${encodeURIComponent(invite)}`);
}

/* email: only used when the seat has none yet (it becomes their sign-in). */
export function redeemInvite(invite, password, email = "") {
  return request("POST", "/auth/redeem", { invite, password, email });
}

export function loginWithPassword(email, password) {
  return request("POST", "/auth/login", { email, password });
}

export function requestLoginLink(email) {
  return request("POST", "/auth/forgot", { email });
}

/** Store both secrets. The student never types them. */
export async function enterSeat(result) {
  const token = result?.persistToken;
  const slug = result?.slug;
  if (!token || !slug) {
    throw new Error("login did not return a seat");
  }
  setPersistToken(token);
  signIn(slug, { persistToken: token, plan: result.plan });
  if (result.accessKey) await unlock(result.accessKey);
  return slug;
}
