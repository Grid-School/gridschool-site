/**
 * The overlay: changes made in the browser on top of the JSON files on disk.
 * Both the student app and the admin console read and write through here, so
 * there is exactly one definition of where a board's edits live.
 *
 * When a backend exists, this file becomes the client for it.
 */

export const overlayKey = (slug) => `gridschool.overlay.v1.${slug}`;

const MERGE_KEYS = ["evidence", "tasks", "layout", "nodeOverrides"];

export function readOverlay(slug) {
  try {
    return JSON.parse(localStorage.getItem(overlayKey(slug)) || "{}") || {};
  } catch {
    return {};
  }
}

export function writeOverlay(slug, overlay) {
  try {
    localStorage.setItem(overlayKey(slug), JSON.stringify(overlay));
    return true;
  } catch {
    return false;
  }
}

export function clearOverlay(slug) {
  localStorage.removeItem(overlayKey(slug));
}

/** Shallow patch, with the known map-shaped fields merged rather than replaced. */
export function patchOverlay(slug, patch) {
  const current = readOverlay(slug);
  const next = { ...current, ...patch };
  for (const key of MERGE_KEYS) {
    if (patch[key]) next[key] = { ...(current[key] ?? {}), ...patch[key] };
  }
  writeOverlay(slug, next);
  return next;
}

/** Merge a student file with its overlay. The shape both surfaces read from. */
export function mergeStudent(student, overlay) {
  return {
    ...student,
    ...overlay,
    evidence: { ...(student.evidence ?? {}), ...(overlay.evidence ?? {}) },
    tasks: { ...(student.tasks ?? {}), ...(overlay.tasks ?? {}) },
    layout: { ...(student.layout ?? {}), ...(overlay.layout ?? {}) },
    nodeOverrides: { ...(student.nodeOverrides ?? {}), ...(overlay.nodeOverrides ?? {}) },
    // Lists replace rather than merge: the overlay owns the whole list once it
    // has touched it, which is the only version that can delete an entry.
    extraNodes: overlay.extraNodes ?? student.extraNodes ?? [],
    reviews: overlay.reviews ?? student.reviews ?? [],
    quotaLog: overlay.quotaLog ?? student.quotaLog ?? [],
    readReviews: overlay.readReviews ?? student.readReviews ?? [],
    chat: overlay.chat ?? student.chat ?? { turns: [] },
    memory: overlay.memory ?? student.memory ?? { notes: [], files: [] },
    usage: overlay.usage ?? student.usage ?? [],
  };
}
