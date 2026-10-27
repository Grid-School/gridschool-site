/**
 * Counts the steps of the free check (server: events.py), first-party only: a
 * random visitor id kept in this browser, no cookies, no third parties, nothing
 * typed. Each step counts once per visit. Counting never blocks or breaks the page.
 * A visit from a Meta ad also carries its click id (fbcFrom, below).
 */

const KEY = "gridschool.visitor.v1";
const FBC_KEY = "gridschool.fbc.v1";
let memoryId = "";
let memoryFbc = "";
const sent = new Set();

/**
 * A visit from a Meta ad arrives with ?fbclid=. Kept in this browser (no cookie) as Meta's click id format,
 * fb.1.<ms first seen>.<fbclid>, and sent with the next counted step, so the server can tell Meta which ad a
 * finished check or a purchase came from (server/meta_capi.py). Nothing else about the visit goes to Meta.
 */
export function fbcFrom(search, stored = "", now = Date.now()) {
  const id = new URLSearchParams(search || "").get("fbclid") || "";
  if (!/^[A-Za-z0-9_-]{8,500}$/.test(id)) return stored;
  return stored.endsWith(`.${id}`) ? stored : `fb.1.${now}.${id}`;
}

function adClick() {
  if (typeof location === "undefined") return "";
  try {
    const stored = localStorage.getItem(FBC_KEY) || "";
    const fbc = fbcFrom(location.search, stored);
    if (fbc && fbc !== stored) localStorage.setItem(FBC_KEY, fbc);
    return fbc;
  } catch {
    memoryFbc = fbcFrom(location.search, memoryFbc);
    return memoryFbc;
  }
}

function withClick() {
  const fbc = adClick();
  return fbc ? { fbc } : {};
}

export function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^v_[\w-]{8,40}$/.test(id)) {
      id = `v_${crypto.getRandomValues(new Uint32Array(3)).join("").slice(0, 24)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ||= `v_${Math.random().toString(36).slice(2, 14)}${Date.now().toString(36)}`;
    return memoryId;
  }
}

export function track(api, name, { source = "", check = "", props } = {}) {
  if (sent.has(name)) return;
  sent.add(name);
  try {
    fetch(`${api}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitor: visitorId(), source, check, events: [{ name, ...(props ? { props } : {}) }], ...withClick() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting is never worth an error */
  }
}
