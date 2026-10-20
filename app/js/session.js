/**
 * Auth seam. Demo mode trusts a slug in the URL or in localStorage so the whole
 * platform can be walked end to end without a backend. Replace the three
 * functions with a real provider and nothing else in the app changes.
 */

const KEY = "gridschool.session.v2";
const TOKEN_KEY = "gridschool.persist.token";

export function currentSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw.slug === "string") return raw;
  } catch {
    /* ignore malformed session */
  }
  return null;
}

export function signIn(slug, { role = "student", persistToken: token, plan } = {}) {
  const session = { slug, role, at: Date.now(), demo: slug === "demo" };
  if (token) session.persistToken = token;
  // "free": a free seat has no lesson key; its board opens on the public course copy (boot.js).
  if (plan === "free") session.plan = "free";
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

/** Founding API token. Session wins; otherwise the desk stores it once. */
export function persistToken() {
  const fromSession = currentSession()?.persistToken;
  if (fromSession) return fromSession;
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setPersistToken(token) {
  const value = String(token ?? "").trim();
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
  return value;
}

export function signOut() {
  localStorage.removeItem(KEY);
}

/**
 * Resolve who is looking at the board. Demo signs in from the URL. A real seat
 * only becomes the session when a notebook token is already on this device.
 */
export function resolveSlug() {
  const fromUrl = slugFromUrl();
  if (fromUrl === "demo") {
    signIn("demo");
    return "demo";
  }
  if (fromUrl && persistToken()) {
    // Re-signing from the URL keeps a free seat's plan when it's the same board (boot.js opens
    // free seats without the lesson key only when the session says "free").
    const before = currentSession();
    signIn(fromUrl, { persistToken: persistToken(), plan: before?.slug === fromUrl ? before.plan : undefined });
    return fromUrl;
  }
  if (fromUrl) return fromUrl;
  return currentSession()?.slug ?? null;
}

export function inviteFromUrl() {
  return new URLSearchParams(location.search).get("invite") || "";
}

/**
 * The slug the current URL asks for, if it asks for one. Callers use this to
 * tell a deliberate link apart from a stored session that has gone stale - 
 * a board that existed on one host may not exist on another.
 */
export function slugFromUrl() {
  const asked = new URLSearchParams(location.search).get("s");
  return asked && /^[a-z0-9-]{1,40}$/.test(asked) ? asked : null;
}
