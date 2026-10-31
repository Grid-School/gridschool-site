/**
 * Where a link was going before sign-in got in the way. The morning email and the sprint emails link straight to a
 * screen (#/do/today/role/<key>, #/map/b.resume); a reader who isn't signed in on that phone signs in first, by
 * password here or by code on signin/, and should still land on that screen. Kept for 30 minutes in this browser.
 */

const KEY = "gridschool.returnTo";
const MAX_AGE_MS = 30 * 60 * 1000;
const ROUTE = /^#\/[A-Za-z0-9/_.:%-]{1,280}$/;

/** Remember a route like "#/do/today" (anything else is ignored). */
export function rememberRoute(hash, now = Date.now(), store = globalThis.localStorage) {
  if (!ROUTE.test(String(hash || ""))) return;
  try {
    store.setItem(KEY, JSON.stringify({ hash, at: now }));
  } catch {
    /* private window: the board opens on the map instead */
  }
}

/** The remembered route, once, if it's still fresh; "" otherwise. */
export function takeRoute(now = Date.now(), store = globalThis.localStorage) {
  try {
    const saved = JSON.parse(store.getItem(KEY) || "null");
    store.removeItem(KEY);
    if (saved && ROUTE.test(saved.hash) && now - Number(saved.at) <= MAX_AGE_MS) return saved.hash;
  } catch {
    /* nothing kept */
  }
  return "";
}
