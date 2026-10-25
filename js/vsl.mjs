/**
 * watch/ (the sales video page), kept pure so it can be tested.
 */

/** How to show LINKS.vslVideo: a file plays in <video>, anything else https is an embed. Null for none. */
export function vslEmbed(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return /\.(mp4|webm|mov)$/i.test(url.pathname) ? { kind: "file", src: url.toString() } : { kind: "embed", src: url.toString() };
}

/** The check's ?from= for someone who watched: "vsl", or "vsl:<ad>" when the page itself came from an ad. */
export function checkSource(from) {
  const ad = String(from || "").replace(/[^\w.-]/g, "").slice(0, 50);
  return ad && ad !== "vsl" ? `vsl:${ad}` : "vsl";
}
