/**
 * The integration seam. Every external service the platform touches lives here
 * and nowhere else. Anything still reading REPLACE_ME renders as "not connected"
 * in the UI instead of pretending to work.
 *
 * When a real link exists, paste it here. No other file changes.
 */

export const LINKS = {
  application: "REPLACE_ME_TALLY_URL",
  foundingCheckout: "REPLACE_ME_CHECKOUT_FOUNDING",
  depositCheckout: "REPLACE_ME_CHECKOUT_DEPOSIT",
  // Stripe Payment Links, one per button (ops/stripe-setup.md says how to make each one).
  // Until a link is real its buttons fall back: Complete to the free check, Residency to residency/.
  // GridSchool Complete, $997 once (12 months). The check's offer and the home and watch pages use it.
  completeCheckout: "https://buy.stripe.com/14A7sL4ro3DndBr4PNdEs01",
  // GridSchool Complete monthly: 7-day free trial, then $97 a month (the webhook stops it at 12).
  completeCheckoutMonthly: "https://buy.stripe.com/dRmbJ16zwei10OF81ZdEs02",
  // GridSchool Residency, $12,000 in full.
  residencyCheckout: "https://buy.stripe.com/fZu4gzcXU2zjeFv2HFdEs03",
  // GridSchool Residency as 3 monthly payments of $4,000 (the webhook tells Aden to stop it after 3).
  residencyCheckoutMonthly: "https://buy.stripe.com/fZu3cv4rogq9eFv5TRdEs04",
  // Gifts (gift/): the same plans, paid once, with two custom fields at checkout, giftemail and giftname
  // (ops/launch-copy.md §1). Until they're real, gift/'s buttons write to support@ instead.
  giftComplete: "https://buy.stripe.com/eVq8wP7DAa1Lapf4PNdEs05",
  giftResidency: "https://buy.stripe.com/28E7sLe1Yfm57d3dmjdEs06",
  giftResidencyMonthly: "https://buy.stripe.com/dRmbJ1aPMgq9gND3LJdEs07",
  // Stripe's customer portal login link: where anyone on a monthly plan cancels or changes their card.
  // Shown on terms/ and residency/; the server's STRIPE_PORTAL_URL is the same link, for emails.
  billingPortal: "https://billing.stripe.com/p/login/fZu00jaPM5Lv9lbeqndEs00",
  // The sales video on watch/ (an embeddable URL: YouTube embed, Loom embed, or a CDN mp4). Placeholder until set.
  vslVideo: "REPLACE_ME_VSL_EMBED",
  // Where a new resident books their kickoff (residency/?paid=1). Falls back to fitCall, then email.
  kickoffCall: "REPLACE_ME_CALCOM_KICKOFF",
  // Aden's face beside the offer on the check result (a square photo, 88px or larger, in assets/).
  // Initials show until it's set.
  adenPhoto: "REPLACE_ME_ADEN_PHOTO",
  // Aden's short welcome video on begin/ (an embeddable URL: Loom or YouTube embed). Hidden until set.
  welcomeVideo: "REPLACE_ME_WELCOME_VIDEO_EMBED",
  fitCall: "REPLACE_ME_CALCOM_FIT_20MIN",
  oneOnOne: "REPLACE_ME_CALCOM_1ON1_45MIN",
  // The free community's public door. The free check shows "Join the community" once this is
  // "https://lab.gridschool.org/community", which redirects to the invite in the server's
  // COMMUNITY_INVITE env. Never put a Discord invite here (tools/check-private-links.mjs).
  community: "REPLACE_ME_COMMUNITY",
  discord: "REPLACE_ME_DISCORD_INVITE",
  discordAsks: "REPLACE_ME_DISCORD_ASKS",
  discordShip: "REPLACE_ME_DISCORD_SHIP",
  // Retired rooms. Kept only because the private-link pipeline (server
  // persist_links.py, ops/site-pull.mjs, tools/check-private-links.mjs) still
  // lists them; no student page links to them.
  discordBugs: "REPLACE_ME_DISCORD_BUGS",
  discordWorld: "REPLACE_ME_DISCORD_WORLD",
  toolPack: "REPLACE_ME_GITHUB_TOOLPACK_INVITE",
  studioRepo: "REPLACE_ME_GITHUB_STUDIO_REPO",
  email: "support@gridschool.org",
  applyEmail: "apply@gridschool.org",
};

/**
 * The legal footing for terms/ and privacy/. These are the only facts in those
 * pages that a person has to supply; everything else is written from how the
 * program actually runs. Anything left as REPLACE_ME shows on the page as a gap
 * rather than as a made-up entity or jurisdiction.
 */
export const LEGAL = {
  entity: "GRID SCHOOL LLC",
  jurisdiction: "Idaho, United States",
  contactAddress: "3100 N. Lakeharbor Lane Ste 176 #160, Boise, Idaho 83703 US",
  effective: "2026-10-25",
  /** Set true only once an ads pixel is actually installed. */
  adTracking: false,
};

/**
 * Coach. `endpoint: "persist"` means the coach route on the notebook server
 * (POST <PERSIST.endpoint>/students/<slug>/coach, server/coach_api.py), which
 * answers with Claude and holds each student's monthly allowance. A signed-in
 * student talks to it; the demo board and a device without a token get the
 * practice replies built from the same pack. A full URL here still works for a
 * stand-in server; REPLACE_ME hides the Coach door.
 *
 * `monthlyUsd` and `rates` only drive the practice meter (Claude Sonnet list
 * prices); the hosted coach reports the real month from the server.
 * Reasoning for the memory shape: `app/js/coach/README.md`.
 */
export const COACH = {
  promptUrl: "../data/coach-prompt.md",
  corpusUrl: "../data/coach-corpus.md",
  hosted: true,
  endpoint: "persist",
  model: "claude-sonnet-5-5",
  monthlyUsd: 10,
  rates: { inputPerM: 2, cachedPerM: 0.1, outputPerM: 10 },
  maxPasteChars: 24000,
  maxFiles: 3,
  maxFileBytes: 40000,
  maxTurnsKept: 16,
};

/**
 * Board doors that can be switched off without deleting their code. A door
 * whose switch is off is not drawn and its route lands on the Map. Coach has
 * no flag here: it shows exactly when COACH.endpoint is real.
 */
export const FEATURES = {
  /** The Posts door (daily LinkedIn comment queue). Off while the crawler is off. */
  posts: false,
};

/**
 * Lesson media. Public/funnel videos stay on YouTube; curriculum films live
 * on Lightsail object storage + CDN (gridschool-lessons → gridschool-media).
 * Each lesson entry uses `path` under baseUrl (HLS master + mp4/{360,720,1080,2160}.mp4).
 */
export const MEDIA = {
  provider: "lightsail-cdn",
  baseUrl: "https://dn1lktb897fdd.cloudfront.net/lessons",
  defaultQuality: "1080",
  /** Public YouTube channel for Episode 1 / outreach only — not for lesson embeds. */
  youtubeChannel: "REPLACE_ME_YOUTUBE_CHANNEL",
};

/**
 * Lab notebook. Demo never leaves the browser. Real slugs hydrate/flush to
 * this API when a founding token is in localStorage (`gridschool.persist.token`).
 * Login and invite redeem inject that token. Students never paste it.
 * Hosted at lab.gridschool.org on GridSchool AWS (643600678330).
 */
/**
 * Sign-in (check/account.js). The Google client id is public by design (it is in
 * every page that shows a Google button); the server checks tokens against the
 * same id (GOOGLE_CLIENT_ID in persist.env). While it reads REPLACE_ME the Google
 * button stays hidden and email sign-in does everything.
 */
export const AUTH = {
  googleClientId: "REPLACE_ME_GOOGLE_CLIENT_ID",
};

export const PERSIST = {
  endpoint: localApi() ?? "https://lab.gridschool.org",
};

/** On this Mac only: ?api=http://localhost:<port> points every board call at a local stub server. */
function localApi() {
  if (typeof location === "undefined" || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
  const asked = new URLSearchParams(location.search).get("api");
  return asked && /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/.test(asked) ? asked.replace(/\/$/, "") : null;
}

/**
 * The public prices live in data/intake/offer.json (and server/billing.py,
 * kept equal by server/offer_test.py). These are the Residency's shape for
 * pages that don't load offer.json. Older seats keep the deals they signed.
 */
export const PRICING = {
  spots: 3,
  /** Eight weeks of the intensive, then stay until hired. Source: the offer lock §3. */
  weeks: 8,
  foundingLabel: "Founding rate",
  depositLabel: "Deposit, then the balance",
};

/**
 * Discord rooms named once so later steps can point at a purpose instead of
 * inventing a new channel. Links stay placeholders until the invite exists.
 */
export const CHANNELS = {
  asks: { name: "#asks", purpose: "Questions and anything that is blocking you", linkKey: "discordAsks" },
  ship: { name: "#ship", purpose: "Finished work with a URL", linkKey: "discordShip" },
};

/**
 * Discord invites never ship in public config, public /site, or the committed
 * overrides mirror. Paid seats fetch them after sign-in. Localhost can load
 * site-overrides.local.json.
 */
export const PRIVATE_LINK_KEYS = Object.freeze([
  "discord",
  "discordAsks",
  "discordShip",
  "discordBugs",
  "discordWorld",
]);

export function isPrivateLinkKey(key) {
  return PRIVATE_LINK_KEYS.includes(key);
}

/** True when a config value is still a placeholder. */
export function isPlaceholder(value) {
  return typeof value !== "string" || value.startsWith("REPLACE_ME") || value === "";
}

/** Resolve a link for an href, or null when it is not connected yet. */
export function link(key) {
  const value = LINKS[key];
  return isPlaceholder(value) ? null : value;
}

/** Every unconnected integration, for the setup checklist in admin. */
export function missingIntegrations() {
  return Object.entries(LINKS)
    .filter(([, value]) => isPlaceholder(value))
    .map(([key]) => key);
}
