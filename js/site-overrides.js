/**
 * Runtime site overrides: links and short node copy the admin edits in the
 * console, served by the persist API so every student board and funnel page
 * sees the change on its next load, no deploy.
 *
 * Precedence: live document from the API, then the repo mirror
 * (data/site-overrides.json, written by ops/site-pull.mjs), then config.js.
 * The mirror is what a local agent reads, and it keeps the published static
 * site truthful when the API is briefly unreachable.
 *
 * Discord invite keys never come from the public document. Paid seats and
 * the admin console fetch them from /site/member. Localhost can also load
 * data/site-overrides.local.json (gitignored).
 *
 * Deep content (lesson prose, read/ modules) is deliberately not editable
 * here; that lives in git where it is reviewed as writing.
 */

import { LINKS, PERSIST, PRIVATE_LINK_KEYS, isPlaceholder, isPrivateLinkKey } from "../config.js";
import { persistToken } from "../app/js/session.js";

/** config.js values as shipped, captured before any mutation. */
const CONFIG_DEFAULTS = Object.freeze({ ...LINKS });

const CACHE_KEY = "gridschool.siteOverrides.v1";
const CACHE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

let currentDoc = { links: {}, copy: { nodes: {} } };
let loaded = null;
let privateLoaded = null;

export function isLocalHost(hostname = globalThis.location?.hostname || "") {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

export function redactPrivateLinks(doc) {
  const links = doc && typeof doc.links === "object" && doc.links ? { ...doc.links } : {};
  for (const key of PRIVATE_LINK_KEYS) delete links[key];
  const nodes =
    doc && typeof doc.copy === "object" && doc.copy && typeof doc.copy.nodes === "object" && doc.copy.nodes
      ? doc.copy.nodes
      : {};
  /* Spread public links onto the document so applySiteOverrides can keep
     passing the whole doc to mutateLinks. Discord keys are already gone. */
  return { ...links, links, copy: { nodes } };
}

export function selectPrivateLinks(links) {
  const selected = {};
  if (!links || typeof links !== "object") return selected;
  for (const [key, value] of Object.entries(links)) {
    if (isPrivateLinkKey(key) && typeof value === "string" && value && !isPlaceholder(value)) {
      selected[key] = value;
    }
  }
  return selected;
}

function normalize(doc) {
  return redactPrivateLinks(doc);
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, doc } = JSON.parse(raw);
    if (!at || Date.now() - at > CACHE_MS) return null;
    return normalize(doc);
  } catch {
    return null;
  }
}

function writeCache(doc) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), doc: normalize(doc) }));
  } catch {
    /* private mode */
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLive() {
  if (isPlaceholder(PERSIST.endpoint)) return null;
  const base = String(PERSIST.endpoint).replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/site`, { cache: "no-store" });
  if (!res.ok) return null;
  const body = await res.json();
  return normalize(body.doc ?? body);
}

async function fetchMirror() {
  const url = new URL("../data/site-overrides.json", import.meta.url);
  const res = await fetchWithTimeout(url, { cache: "no-store" });
  if (!res.ok) return null;
  return normalize(await res.json());
}

async function fetchMember(token) {
  if (!token || isPlaceholder(PERSIST.endpoint)) return null;
  const base = String(PERSIST.endpoint).replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/site/member`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchLocalPrivate() {
  const url = new URL("../data/site-overrides.local.json", import.meta.url);
  const res = await fetchWithTimeout(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function mutateLinks(links, { privateOnly = false } = {}) {
  for (const [key, value] of Object.entries(links || {})) {
    if (privateOnly && !isPrivateLinkKey(key)) continue;
    if (key in CONFIG_DEFAULTS && typeof value === "string" && value && !isPlaceholder(value)) {
      LINKS[key] = value;
    }
  }
}

/**
 * Load the overrides once per page and fold the links into config's LINKS so
 * every existing `link()` call sees them. Safe to call more than once. Never
 * throws: with nothing reachable, config.js stands as shipped.
 */
export function applySiteOverrides() {
  if (loaded) return loaded;
  loaded = (async () => {
    const cached = readCache();
    if (cached) {
      currentDoc = cached;
      mutateLinks(cached.links);
      return currentDoc;
    }
    let doc = null;
    try {
      doc = await fetchLive();
    } catch {
      doc = null;
    }
    if (!doc) {
      try {
        doc = await fetchMirror();
      } catch {
        doc = null;
      }
    }
    currentDoc = doc ?? normalize(null);
    if (doc) writeCache(doc);
    mutateLinks(currentDoc);
    return currentDoc;
  })();
  return loaded;
}

/**
 * Fold Discord invites into LINKS after a paid sign-in, or on localhost from
 * the gitignored local file. Public pages should not call this.
 */
export function applyPrivateLinks({ token, hostname } = {}) {
  if (privateLoaded) return privateLoaded;
  privateLoaded = (async () => {
    const auth = token ?? persistToken();
    if (auth) {
      try {
        const member = await fetchMember(auth);
        if (member?.granted) {
          const links = selectPrivateLinks(member.links);
          mutateLinks(links, { privateOnly: true });
          return { source: "member", links };
        }
      } catch {
        /* fall through to localhost */
      }
    }
    if (isLocalHost(hostname)) {
      try {
        const local = await fetchLocalPrivate();
        const links = selectPrivateLinks(local?.links);
        mutateLinks(links, { privateOnly: true });
        return { source: "local", links };
      } catch {
        return { source: "none", links: {} };
      }
    }
    return { source: "none", links: {} };
  })();
  return privateLoaded;
}

/** The public overrides document as loaded on this page. */
export function siteOverridesDoc() {
  return currentDoc;
}

/** What config.js shipped for a link key, before any override. */
export function configDefaultLink(key) {
  return CONFIG_DEFAULTS[key];
}

/** Force the next applySiteOverrides() on any page to refetch. */
export function dropSiteOverridesCache() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* private mode */
  }
  loaded = null;
  privateLoaded = null;
}

/**
 * Fold copy overrides into a loaded curriculum. Only display fields ever
 * arrive here (the server whitelists title, why, evidence, reading); lesson
 * bodies cannot be overridden by design.
 */
export function applyCopyOverrides(curriculum, doc = currentDoc) {
  const nodes = doc?.copy?.nodes ?? {};
  if (!curriculum?.nodes || !Object.keys(nodes).length) return curriculum;
  return {
    ...curriculum,
    nodes: curriculum.nodes.map((node) =>
      nodes[node.id] ? { ...node, ...nodes[node.id] } : node
    ),
  };
}
