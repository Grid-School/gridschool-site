/**
 * Instructor-only media preview. Steps and library rows whose real film is not
 * on the CDN yet can show the placeholder test clip so the page shape can be
 * judged before filming. Students and the public demo never see the stand-in:
 * the flag is device-local and the switch only renders in the instructor rail.
 * Same shape as dev-mode.js on purpose — one localStorage bit, no board field,
 * never synced.
 */

const KEY = "gridschool.previewMedia.v1";

export function isPreviewMedia() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setPreviewMedia(on) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  return isPreviewMedia();
}

export function togglePreviewMedia() {
  return setPreviewMedia(!isPreviewMedia());
}
