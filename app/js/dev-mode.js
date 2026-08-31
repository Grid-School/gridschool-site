/**
 * Instructor-only browse mode. Opens every node for reading and turn-in without
 * faking evidence. Progress still comes only from real URLs in the overlay.
 * Device-local: not a student board field, not synced across machines.
 */

const KEY = "gridschool.devUnlock.v1";

export function isDevUnlock() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevUnlock(on) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  return isDevUnlock();
}

export function toggleDevUnlock() {
  return setDevUnlock(!isDevUnlock());
}
