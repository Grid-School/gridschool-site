/**
 * Auth seam. Demo mode trusts a slug in the URL or in localStorage so the whole
 * platform can be walked end to end without a backend. Replace the three
 * functions with a real provider and nothing else in the app changes.
 */

const KEY = "gridschool.session.v2";

export function currentSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw.slug === "string") return raw;
  } catch {
    /* ignore malformed session */
  }
  return null;
}

export function signIn(slug, { role = "student" } = {}) {
  const session = { slug, role, at: Date.now(), demo: true };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function signOut() {
  localStorage.removeItem(KEY);
}

/**
 * Resolve who is looking at the board. ?s=<slug> wins so a link can be shared,
 * and it also becomes the stored session.
 */
export function resolveSlug() {
  const fromUrl = slugFromUrl();
  if (fromUrl) {
    signIn(fromUrl);
    return fromUrl;
  }
  return currentSession()?.slug ?? null;
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
