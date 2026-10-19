/**
 * Counts the steps of the free check (server: events.py), first-party only: a
 * random visitor id kept in this browser, no cookies, no third parties, nothing
 * typed. Each step counts once per visit. Counting never blocks or breaks the page.
 */

const KEY = "gridschool.visitor.v1";
let memoryId = "";
const sent = new Set();

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
      body: JSON.stringify({ visitor: visitorId(), source, check, events: [{ name, ...(props ? { props } : {}) }] }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* counting is never worth an error */
  }
}
