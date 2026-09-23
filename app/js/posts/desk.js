/** Keep only display preferences locally. Assignment history lives on the server. */

const PREFIX = "gs-posts:v1:";

export function deskKey(slug) {
  return `${PREFIX}${slug || "local"}`;
}

export function todayKey(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function loadDesk(storage, slug, today) {
  const blank = { keywords: "", day: today, current: null };
  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(deskKey(slug)) || "null");
  } catch {
    return blank;
  }
  if (!parsed || typeof parsed !== "object") return blank;
  const keywords = typeof parsed.keywords === "string" ? parsed.keywords : "";
  if (parsed.day !== today) return { ...blank, keywords };
  return {
    keywords,
    day: today,
    current: parsed.current && typeof parsed.current === "object" ? parsed.current : null,
  };
}

export function saveDesk(storage, slug, desk) {
  storage.setItem(deskKey(slug), JSON.stringify(desk));
}
