/**
 * The integration seam. Every external service the platform touches lives here
 * and nowhere else. Anything still reading REPLACE_ME renders as "not connected"
 * in the UI instead of pretending to work.
 *
 * When a real link exists, paste it here. No other file changes.
 */

export const LINKS = {
  application: "REPLACE_ME_TALLY_URL",
  foundingCheckout: "REPLACE_ME_STRIPE_FOUNDING_500",
  depositCheckout: "REPLACE_ME_STRIPE_DEPOSIT_100",
  fitCall: "REPLACE_ME_CALCOM_FIT_20MIN",
  oneOnOne: "REPLACE_ME_CALCOM_1ON1_45MIN",
  discord: "REPLACE_ME_DISCORD_INVITE",
  toolPack: "REPLACE_ME_GITHUB_TOOLPACK_INVITE",
  studioRepo: "REPLACE_ME_GITHUB_STUDIO_REPO",
  jira: "REPLACE_ME_JIRA_BOARD_URL",
  worldServer: "https://github.com/Grid-School/gridschool-world-server",
  worldClient: "https://github.com/Grid-School/gridschool-world-client",
  play: "https://play.gridschool.org",
  email: "support@gridschool.org",
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
  effective: "2026-08-19",
  /** Set true only once an ads pixel is actually installed. */
  adTracking: false,
};

/**
 * Coach. Today talks to Grok through a tiny proxy (`site/server/coach.py`)
 * when `endpoint` is a real URL. Until then the same conversation runs locally
 * so the product is walkable. Rates are xAI list prices as of 2026-08; change
 * them here when xAI does, not in the UI.
 *
 * `monthlyUsd` is the hard cap per student per calendar month. The client
 * refuses a turn that would cross it. Reasoning for the model choice and the
 * memory shape: `app/js/coach/README.md`.
 */
export const COACH = {
  promptUrl: "../data/coach-prompt.md",
  corpusUrl: "../data/coach-corpus.md",
  hosted: false,
  endpoint: "REPLACE_ME_COACH_ENDPOINT",
  model: "grok-4.3",
  monthlyUsd: 50,
  rates: { inputPerM: 1.25, cachedPerM: 0.2, outputPerM: 2.5 },
  maxPasteChars: 24000,
  maxFiles: 3,
  maxFileBytes: 40000,
  maxTurnsKept: 16,
  hostedNote: "Paste an xAI key into site/server/coach.py and point endpoint at it.",
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
 * The API binds to localhost and talks to GridSchool Postgres (643600678330).
 */
export const PERSIST = {
  endpoint: "https://gridschool-persist.2q0rcr0ks5h5e.us-west-2.cs.amazonlightsail.com",
};

export const PRICING = {
  deposit: 100,
  balance: 400,
  founding: 500,
  spots: 5,
  weeks: 8,
};

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
