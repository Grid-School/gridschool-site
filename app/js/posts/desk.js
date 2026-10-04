/**
 * Keep only display preferences locally. Assignment history lives on the
 * server. `seen` is developer preview only: the server records nothing for a
 * preview, so this browser remembers which posts it already opened.
 */

const PREFIX = "gs-posts:v1:";
const SEEN_CAP = 500;

export function deskKey(slug) {
  return `${PREFIX}${slug || "local"}`;
}

export function todayKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function loadDesk(storage, slug, today) {
  const blank = { keywords: "", day: today, current: null, seen: [] };
  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(deskKey(slug)) || "null");
  } catch {
    return blank;
  }
  if (!parsed || typeof parsed !== "object") return blank;
  const keywords = typeof parsed.keywords === "string" ? parsed.keywords : "";
  const seen = Array.isArray(parsed.seen) ? parsed.seen.map(String).slice(0, SEEN_CAP) : [];
  if (parsed.day !== today) return { ...blank, keywords, seen };
  return {
    keywords,
    day: today,
    current: parsed.current && typeof parsed.current === "object" ? parsed.current : null,
    seen,
  };
}

export function rememberSeen(seen, id) {
  const value = String(id ?? "");
  if (!value) return seen;
  return [value, ...seen.filter((item) => item !== value)].slice(0, SEEN_CAP);
}

export function saveDesk(storage, slug, desk) {
  storage.setItem(deskKey(slug), JSON.stringify(desk));
}
