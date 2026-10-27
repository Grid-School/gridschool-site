/**
 * Where a signed-in account goes (signin/ and begin/ both ask). Pure: no page, no network, so it is
 * tested on its own (route.test.mjs). `me` is GET /account/me (server accounts_api.py):
 * {email, name, checks: [{id, top, createdAt}], seat: {slug, plan} | null}.
 *
 *   "paid"     a Complete map: POST /account/seat opens it (billing_api.seat_session)
 *   "wait"     a Complete payment is on its way and its map isn't there yet: begin/ waits for it
 *   "free"     a free map, or a saved check to make one from: POST /account/free-seat (free_seat.py)
 *   "password" a Residency board: those sign in with their password on app/
 *   "none"     nothing for this email yet: take the free check, or check the spelling
 *   "signin"   not signed in
 */

export function routeFor(me, { paying = false } = {}) {
  if (!me) return "signin";
  const plan = me.seat?.plan || "";
  if (plan === "complete") return "paid";
  // A Residency board is never changed by a Complete payment (billing_api.py), so there is nothing to wait for.
  if (plan && plan !== "free") return "password";
  if (paying) return "wait";
  if (plan === "free" || (me.checks || []).length) return "free";
  return "none";
}

/** Stripe's own pages send people back to begin/ after paying, so a referrer from there means a payment just went through. */
export function fromStripe(referrer = "") {
  try {
    return /(^|\.)stripe\.com$/i.test(new URL(referrer).hostname);
  } catch {
    return false;
  }
}

const LOCAL = /^(localhost|127\.0\.0\.1)$/;

/**
 * A page on this site from the current one, e.g. sitePath("../app/", location, api, {s: slug}).
 * On this Mac it carries ?api= so the next page talks to the same local API, never production.
 */
export function sitePath(path, here, api, params = {}) {
  const url = new URL(path, here.href);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  if (LOCAL.test(here.hostname) && api) url.searchParams.set("api", api);
  return url.toString();
}
