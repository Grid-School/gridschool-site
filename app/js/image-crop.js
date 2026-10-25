/**
 * Pure geometry and state for the profile images tool (views/images.js). No DOM here, so it is tested
 * in node: which part of a photo a LinkedIn-sized crop takes, how far to shrink a phone photo before
 * upload, and which steps of the tool are done.
 */

/**
 * The part of a srcW x srcH image that fills an outW x outH frame, covering it with no bars.
 * zoom >= 1 crops tighter; x and y in [-1, 1] slide the crop from one edge to the other.
 */
export function cropBox(srcW, srcH, outW, outH, { zoom = 1, x = 0, y = 0 } = {}) {
  const scale = Math.max(outW / srcW, outH / srcH) * Math.max(1, zoom);
  const sw = Math.min(srcW, outW / scale);
  const sh = Math.min(srcH, outH / scale);
  const clamp = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
  const sx = (srcW - sw) / 2 + (clamp(x) * (srcW - sw)) / 2;
  const sy = (srcH - sh) / 2 + (clamp(y) * (srcH - sh)) / 2;
  return { sx, sy, sw, sh };
}

/** The size to redraw an upload at so its longest side is at most `max`; null when it already fits. */
export function shrinkTo(width, height, max = 2048) {
  const longest = Math.max(width, height);
  if (!longest || longest <= max) return null;
  const ratio = max / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Whether a picked file needs redrawing before upload: too big for the server, or very large. */
export function needsShrink(file, { width, height }, { maxBytes = 5 * 1024 * 1024, max = 2048 } = {}) {
  return file.size > maxBytes * 0.9 || Boolean(shrinkTo(width, height, max)) || !["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

export const STAGES = [
  { id: "photos", label: "Photos" },
  { id: "headshot", label: "Headshot" },
  { id: "banner", label: "Banner" },
  { id: "post", label: "Download" },
];

/** Steps that are done, from the server's view of their images and whether they downloaded this visit. */
export function doneStages(rec, downloaded = {}) {
  const done = [];
  if (!rec) return done;
  const faces = rec.uploads?.face?.length ?? 0;
  if (faces || rec.uploads?.photo_current) done.push("photos");
  if (rec.picked?.headshot) done.push("headshot");
  if (rec.picked?.banner) done.push("banner");
  if (downloaded.headshot && downloaded.banner) done.push("post");
  return done;
}

/** Where to open: the first step not done. */
export function firstOpen(rec, downloaded = {}) {
  const done = doneStages(rec, downloaded);
  return (STAGES.find((s) => !done.includes(s.id)) ?? STAGES[STAGES.length - 1]).id;
}

/** The image a download uses for a kind: the picked option, else their own current one. */
export function sourceFor(rec, kind) {
  if (!rec) return null;
  const picked = rec.picked?.[kind];
  if (picked) return { id: picked, made: true };
  const own = kind === "headshot" ? rec.uploads?.photo_current ?? rec.uploads?.face?.[0] : rec.uploads?.banner_current;
  return own ? { id: own.id, made: false } : null;
}

/** "3 of 12 this month" for the make button, or null when the plan has none. */
export function allowanceLine(month) {
  if (!month || !month.limit) return null;
  const left = Math.max(0, month.limit - month.used);
  return `${left} of ${month.limit} left this month`;
}
